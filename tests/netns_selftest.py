"""Integration test on a virtual network (network namespaces + veth + bridge).

Needs no attached devices and does not touch br0 or the physical ports.
Run as root:  sudo python3 -B tests/netns_selftest.py   (requires iperf3 and ethtool)

  [ns wa: 10.99.0.1] va -- va_h --+
                                  +-- brtest (bridge), emulation on va_h / vb_h
  [ns wb: 10.99.0.2] vb -- vb_h --+
"""

import json
import re
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from wanemu.config import Settings  # noqa: E402
from wanemu.emulator import Emulator  # noqa: E402
from wanemu.models import DirectionParams, EmulationConfig  # noqa: E402

FAILS = []


def sh(cmd, check=True):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"{cmd}\n{r.stderr}")
    return r.stdout


def setup():
    teardown()
    for c in [
        "ip netns add wa", "ip netns add wb",
        "ip link add va type veth peer name va_h", "ip link add vb type veth peer name vb_h",
        "ip link set va netns wa", "ip link set vb netns wb",
        "ip link add brtest type bridge stp_state 0 forward_delay 0",
        "ip link set va_h master brtest", "ip link set vb_h master brtest",
        "ip link set va_h up", "ip link set vb_h up", "ip link set brtest up",
        "ip -n wa addr add 10.99.0.1/24 dev va", "ip -n wb addr add 10.99.0.2/24 dev vb",
        "ip -n wa link set va up", "ip -n wb link set vb up",
        "ip -n wa link set lo up", "ip -n wb link set lo up",
    ]:
        sh(c)
    for c in ["ethtool -K va_h gro off gso off tso off", "ethtool -K vb_h gro off gso off tso off",
              "ip netns exec wa ethtool -K va gro off gso off tso off",
              "ip netns exec wb ethtool -K vb gro off gso off tso off"]:
        sh(c, check=False)
    time.sleep(1.5)


def teardown():
    for c in ["ip netns del wa", "ip netns del wb", "ip link del brtest", "ip link del va_h", "ip link del vb_h"]:
        sh(c, check=False)


def ping(count=50, interval=0.02, size=56):
    out = sh(f"ip netns exec wa ping -q -c {count} -i {interval} -s {size} -W 3 10.99.0.2", check=False)
    loss = float(re.search(r"([\d.]+)% packet loss", out).group(1))
    m = re.search(r"= [\d.]+/([\d.]+)/", out)
    return loss, float(m.group(1)) if m else None


def iperf(args):
    sh("ip netns exec wb iperf3 -s -D -1 >/dev/null 2>&1", check=False)
    time.sleep(0.5)
    return json.loads(sh(f"ip netns exec wa iperf3 -c 10.99.0.2 {args} -J", check=False))["end"]


def reordered(count=1500, gap=0.001):
    """Number of UDP packets that arrived out of order (wa -> wb)."""
    helper = Path(__file__).with_name("udp_seq.py")
    rx = subprocess.Popen(["ip", "netns", "exec", "wb", sys.executable, str(helper), "recv", "9999",
                           str(count * gap + 3)], stdout=subprocess.PIPE, text=True)
    time.sleep(0.5)
    sh(f"ip netns exec wa {sys.executable} {helper} send 10.99.0.2 9999 {count} {gap}")
    out, _ = rx.communicate()
    return json.loads(out)


def check(name, ok, detail):
    print(f"[{'OK  ' if ok else 'FAIL'}] {name}: {detail}")
    if not ok:
        FAILS.append(name)


def main():
    tmp = tempfile.mkdtemp()
    emu = Emulator(Settings(iface_a="va_h", iface_b="vb_h", profiles_dir=tmp, state_file=f"{tmp}/state.json"))
    setup()
    try:
        loss, rtt = ping()
        check("no emulation", loss == 0 and rtt < 5, f"loss {loss} %, RTT {rtt} ms")

        emu.start(EmulationConfig(a_to_b=DirectionParams(delay_ms=40), b_to_a=DirectionParams(delay_ms=10)))
        loss, rtt = ping(20)
        check("delay 40 + 10 ms", 49 <= rtt <= 56, f"RTT {rtt} ms")
        check("status running", emu.status()["running"], str(emu.status()["running"]))

        emu.start(EmulationConfig(a_to_b=DirectionParams(loss_mode="random", loss_pct=30)))
        loss, _ = ping(400, 0.005)
        check("random loss 30 %", 22 <= loss <= 38, f"loss {loss} %")

        emu.start(EmulationConfig(a_to_b=DirectionParams(loss_mode="burst", loss_pct=10, loss_burst_len=5)))
        lost = iperf("-u -b 2M -t 5 -l 500")["sum"]["lost_percent"]
        check("burst loss 10 %", 5 <= lost <= 16, f"loss {lost:.1f} %")

        emu.start(EmulationConfig(a_to_b=DirectionParams(rate_kbit=1000)))
        bps = iperf("-t 5")["sum_received"]["bits_per_second"]
        check("rate limit 1000 kbit/s (TCP)", 850e3 <= bps <= 1050e3, f"{bps / 1e3:.0f} kbit/s")

        jit = DirectionParams(delay_ms=20, jitter_ms=10, distribution="normal")
        emu.start(EmulationConfig(a_to_b=jit))
        r = reordered()
        check("jitter without keep_order reorders", r["out_of_order"] > 0, str(r))

        emu.start(EmulationConfig(a_to_b=jit.model_copy(update={"keep_order": True})))
        r = reordered()
        check("jitter with keep_order keeps order", r["out_of_order"] == 0 and r["received"] > 1400, str(r))

        emu.start(EmulationConfig(a_to_b=DirectionParams(delay_ms=20, reorder_pct=25, reorder_correlation_pct=50)))
        r = reordered()
        check("reorder 25 %", r["out_of_order"] > 0, str(r))

        emu.start(EmulationConfig(a_to_b=DirectionParams(mtu=1000)))
        small, _ = ping(5, 0.05, 900)
        big, _ = ping(5, 0.05, 1200)
        check("MTU 1000: small packets pass, large ones dropped", small == 0 and big == 100,
              f"900 B: {small} % loss, 1200 B: {big} % loss")

        emu.stop()
        loss, rtt = ping(20)
        mtu = int(Path("/sys/class/net/vb_h/mtu").read_text())
        check("stop restores the original state", loss == 0 and rtt < 5 and mtu == 1500 and not emu.status()["running"],
              f"loss {loss} %, RTT {rtt} ms, MTU {mtu}")
    finally:
        emu.stop()
        teardown()

    print("\nRESULT:", "all checks passed" if not FAILS else f"{len(FAILS)} failed: {', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()

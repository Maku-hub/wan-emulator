"""Building and running tc / ip commands, reading statistics."""

import json
import shutil
import subprocess
from pathlib import Path

from .models import DirectionParams

TC = shutil.which("tc") or "/usr/sbin/tc"
IP = shutil.which("ip") or "/usr/sbin/ip"

KEEP_ORDER_RATE = "100gbit"


class TcError(RuntimeError):
    pass


def fmt(value: float) -> str:
    """Number without exponent notation or trailing zeros (tc rejects e.g. 1e-05)."""
    s = f"{value:.6f}".rstrip("0").rstrip(".")
    return s or "0"


def pct(value: float) -> str:
    return fmt(value) + "%"


def gemodel_params(loss_pct: float, burst_len: float) -> tuple[float, float]:
    """Gilbert model: mean loss and mean burst length -> (p, r) in percent.

    All packets are lost in the "bad" state, none in the "good" state.
    Mean burst length = 1/r, mean loss = p / (p + r).
    """
    loss = loss_pct / 100.0
    r = 1.0 / burst_len
    p = r * loss / (1.0 - loss)
    return min(p * 100.0, 100.0), r * 100.0


def netem_args(p: DirectionParams) -> list[str]:
    args: list[str] = []

    if p.delay_ms > 0 or p.jitter_ms > 0:
        args += ["delay", fmt(p.delay_ms) + "ms"]
        if p.jitter_ms > 0:
            args.append(fmt(p.jitter_ms) + "ms")
            if p.jitter_correlation_pct > 0:
                args.append(pct(p.jitter_correlation_pct))
            if p.distribution != "none":
                args += ["distribution", p.distribution]

    if p.loss_mode == "random" and p.loss_pct > 0:
        args += ["loss", "random", pct(p.loss_pct)]
        if p.loss_correlation_pct > 0:
            args.append(pct(p.loss_correlation_pct))
    elif p.loss_mode == "burst" and p.loss_pct > 0:
        gp, gr = gemodel_params(p.loss_pct, p.loss_burst_len)
        args += ["loss", "gemodel", pct(gp), pct(gr), "100%", "0%"]

    if p.reorder_pct > 0:
        args += ["reorder", pct(p.reorder_pct)]
        if p.reorder_correlation_pct > 0:
            args.append(pct(p.reorder_correlation_pct))

    if p.duplicate_pct > 0:
        args += ["duplicate", pct(p.duplicate_pct)]
    if p.corrupt_pct > 0:
        args += ["corrupt", pct(p.corrupt_pct)]
    if p.rate_kbit > 0:
        args += ["rate", fmt(p.rate_kbit) + "kbit"]
    elif p.keep_order and p.jitter_ms > 0:
        # With "rate" set, netem never schedules a packet before the previous one,
        # so jitter does not reorder. A very high rate does not limit bandwidth.
        # (A pfifo child qdisc does not prevent reordering on 6.x kernels.)
        args += ["rate", KEEP_ORDER_RATE]

    args += ["limit", str(p.limit)]
    return args


def build_commands(iface: str, p: DirectionParams, default_mtu: int) -> list[list[str]]:
    """Commands that set up emulation on an interface (not executed).

    The qdisc is always deleted and re-added: "tc qdisc replace/change" on an existing
    netem keeps parameters that are not given (e.g. rate or reorder from the previous
    config). Side effect: packets queued at the moment of the change are dropped.
    """
    return [
        [TC, "qdisc", "del", "dev", iface, "root"],
        [TC, "qdisc", "add", "dev", iface, "root", "handle", "1:", "netem", *netem_args(p)],
        [IP, "link", "set", "dev", iface, "mtu", str(p.mtu or default_mtu)],
    ]


def run(cmd: list[str], check: bool = True) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise TcError(f"{' '.join(cmd)}: {res.stderr.strip() or res.stdout.strip()}")
    return res.stdout


def get_mtu(iface: str) -> int:
    return int(read_sys(iface, "mtu") or 0)


def set_mtu(iface: str, mtu: int) -> None:
    if get_mtu(iface) != mtu:
        run([IP, "link", "set", "dev", iface, "mtu", str(mtu)])


def apply(iface: str, p: DirectionParams, default_mtu: int) -> None:
    for cmd in build_commands(iface, p, default_mtu):
        if cmd[0] == IP:
            set_mtu(iface, p.mtu or default_mtu)
        elif cmd[2] == "del":
            run(cmd, check=False)  # nothing to delete is not an error
        else:
            run(cmd)


def clear(iface: str, default_mtu: int) -> None:
    run([TC, "qdisc", "del", "dev", iface, "root"], check=False)
    set_mtu(iface, default_mtu)


def qdiscs(iface: str) -> list[dict]:
    out = run([TC, "-s", "-j", "qdisc", "show", "dev", iface], check=False)
    try:
        return json.loads(out) if out.strip() else []
    except json.JSONDecodeError:
        return []


def root_netem(iface: str) -> dict | None:
    for q in qdiscs(iface):
        if q.get("kind") == "netem" and q.get("root"):
            return q
    return None


def read_sys(iface: str, name: str) -> str | None:
    try:
        return Path(f"/sys/class/net/{iface}/{name}").read_text().strip()
    except OSError:
        return None


def iface_info(iface: str) -> dict:
    def num(name):
        v = read_sys(iface, name)
        try:
            return int(v) if v is not None else None
        except ValueError:
            return None

    stats = {k: num(f"statistics/{k}") for k in ("tx_bytes", "tx_packets", "rx_bytes", "rx_packets", "tx_dropped")}
    return {
        "name": iface,
        "exists": Path(f"/sys/class/net/{iface}").exists(),
        "carrier": read_sys(iface, "carrier") == "1",
        "operstate": read_sys(iface, "operstate"),
        "speed": num("speed"),
        "mtu": num("mtu"),
        **stats,
    }

"""Smoke test of a running panel through the REST API, on the real bridge ports.

Run on the emulator host:  python3 -B tests/api_smoketest.py [http://localhost:8080]

Checks: version, served web files (identical to the repository), default profile list,
starting every profile (status + actual tc config), MTU, statistics, command preview,
validation, profile save / load / delete (including "/" and non-ASCII names), stop.
Emulation is stopped at the end.
"""

import hashlib
import json
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
FAILS = []


def call(method, path, body=None):
    req = urllib.request.Request(BASE + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw and r.headers.get_content_type() == "application/json" else raw)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, raw


def q(name):
    return urllib.parse.quote(name, safe="")


def check(name, ok, detail=""):
    print(f"[{'OK  ' if ok else 'FAIL'}] {name}" + (f": {detail}" if detail else ""))
    if not ok:
        FAILS.append(name)


def tc_show(iface):
    return subprocess.run(["/usr/sbin/tc", "qdisc", "show", "dev", iface],
                          capture_output=True, text=True).stdout


def mtu_of(iface):
    return int(Path(f"/sys/class/net/{iface}/mtu").read_text())


def main():
    local_version = re.search(r'__version__ = "([^"]+)"', (ROOT / "app/wanemu/__init__.py").read_text()).group(1)

    code, st = call("GET", "/api/status")
    check("status", code == 200, f"HTTP {code}")
    check("panel version matches the repository", st.get("version") == local_version,
          f"{st.get('version')} / {local_version}")
    ia, ib = st["iface_a"], st["iface_b"]

    for f in ("index.html", "app.js", "i18n.js", "style.css"):
        code, body = call("GET", "/" + f)
        local = (ROOT / "app/wanemu/static" / f).read_bytes()
        same = hashlib.sha256(body).digest() == hashlib.sha256(local).digest()
        check(f"/{f} identical to the repository", code == 200 and same)

    defaults = [yaml.safe_load(p.read_text(encoding="utf-8")) for p in sorted((ROOT / "profiles").glob("*.yaml"))]
    code, lst = call("GET", "/api/profiles")
    names = [p["name"] for p in lst]
    check("profile list starts with the default profiles, in order",
          names[:len(defaults)] == [d["name"] for d in defaults], f"{len(names)} profiles")
    check("default profiles carry a Polish translation",
          all(p.get("translations", {}).get("pl", {}).get("name") for p in lst[:len(defaults)]))

    for d in defaults:
        code, p = call("GET", "/api/profiles/" + q(d["name"]))
        same = all(p[k][f] == v for k in ("a_to_b", "b_to_a") for f, v in d[k].items())
        code2, st = call("POST", "/api/start", {"config": p, "profile": d["name"]})
        tc_b, tc_a = tc_show(ib), tc_show(ia)
        ok = (code == 200 and same and code2 == 200 and st["running"] and st["profile"] == d["name"]
              and "netem" in tc_a and "netem" in tc_b)
        delay = d["a_to_b"].get("delay_ms", 0)
        if ok and delay:
            # tc prints values below 1 ms in microseconds (0.5 ms -> 500us)
            shown = f"{delay:g}ms" if delay >= 1 else f"{delay * 1000:g}us"
            ok = re.search(rf"delay {shown}", tc_b) is not None
        check(f"profile '{d['name']}': load, start, tc", ok, tc_b.strip().splitlines()[0] if tc_b else "no tc output")

    vpn = next(d["name"] for d in defaults if "1400" in d["name"])
    code, p = call("GET", "/api/profiles/" + q(vpn))
    code, st = call("POST", "/api/start", {"config": p, "profile": vpn, "modified": True})
    check("'modified' flag kept in state", st.get("profile") == vpn and st.get("modified") is True)
    check("MTU 1400 set on the port", mtu_of(ib) == 1400, str(mtu_of(ib)))

    code, s = call("GET", "/api/stats")
    check("statistics", code == 200 and s["running"] and s["a_to_b"]["netem"] is not None
          and s["a_to_b"]["iface"]["name"] == ib and s["b_to_a"]["iface"]["name"] == ia)

    code, pv = call("POST", "/api/preview",
                    {"a_to_b": {"delay_ms": 50, "loss_mode": "burst", "loss_pct": 2, "loss_burst_len": 5}})
    check("command preview", code == 200 and any("gemodel" in c for c in pv["commands"]))
    for name, cfg in [("reorder without delay", {"reorder_pct": 5}),
                      ("burst loss 100 %", {"loss_mode": "burst", "loss_pct": 100}),
                      ("keep_order + reorder", {"delay_ms": 10, "jitter_ms": 5, "keep_order": True, "reorder_pct": 1}),
                      ("value out of range", {"loss_pct": 150})]:
        code, _ = call("POST", "/api/start", {"config": {"a_to_b": cfg}})
        check(f"validation rejects: {name}", code == 422, f"HTTP {code}")

    test_name = "Test / żółć ĄĘ (api_smoketest)"
    body = {"name": test_name, "description": "temporary", "a_to_b": {"delay_ms": 12.5}, "b_to_a": {"rate_kbit": 64},
            "translations": {"pl": {"name": "Test PL", "description": "opis"}}}
    c1, _ = call("PUT", "/api/profiles/" + q(test_name), body)
    c2, p = call("GET", "/api/profiles/" + q(test_name))
    c3, _ = call("DELETE", "/api/profiles/" + q(test_name))
    c4, _ = call("GET", "/api/profiles/" + q(test_name))
    check("profile with '/' and non-ASCII name: save, load, delete",
          (c1, c2, c3, c4) == (200, 200, 200, 404) and p["a_to_b"]["delay_ms"] == 12.5
          and p["b_to_a"]["rate_kbit"] == 64 and p["translations"]["pl"]["name"] == "Test PL",
          f"{c1}/{c2}/{c3}/{c4}")

    code, st = call("POST", "/api/stop")
    check("stop: emulation off, netem removed, MTU restored",
          code == 200 and not st["running"] and "netem" not in tc_show(ia) + tc_show(ib) and mtu_of(ib) == 1500)

    print("\nRESULT:", "all checks passed" if not FAILS else f"{len(FAILS)} failed: {', '.join(FAILS)}")
    sys.exit(1 if FAILS else 0)


if __name__ == "__main__":
    main()

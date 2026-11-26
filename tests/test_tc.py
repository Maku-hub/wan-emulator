"""Unit tests for netem argument generation and validation (no root needed).

Run:  python3 -m pytest tests
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "app"))

from wanemu.models import DirectionParams  # noqa: E402
from wanemu.tc import build_commands, fmt, gemodel_params, netem_args  # noqa: E402


def test_fmt_no_exponent():
    assert fmt(0.00001) == "0.00001"
    assert fmt(10.0) == "10"
    assert fmt(0) == "0"


def test_empty_is_passthrough():
    assert netem_args(DirectionParams()) == ["limit", "10000"]


def test_delay_jitter_distribution():
    p = DirectionParams(delay_ms=80, jitter_ms=20, jitter_correlation_pct=25, distribution="normal")
    assert netem_args(p)[:6] == ["delay", "80ms", "20ms", "25%", "distribution", "normal"]


def test_distribution_ignored_without_jitter():
    assert "distribution" not in netem_args(DirectionParams(delay_ms=10, distribution="normal"))


def test_random_loss():
    a = netem_args(DirectionParams(loss_mode="random", loss_pct=1.5, loss_correlation_pct=10))
    assert a[:4] == ["loss", "random", "1.5%", "10%"]


def test_gemodel_average_loss_and_burst():
    p, r = gemodel_params(2, 5)
    assert r == pytest.approx(20)
    assert p / (p + r) == pytest.approx(0.02)
    a = netem_args(DirectionParams(loss_mode="burst", loss_pct=2, loss_burst_len=5))
    assert a[:2] == ["loss", "gemodel"] and a[4:6] == ["100%", "0%"]


def test_rate_reorder_duplicate_corrupt():
    a = netem_args(DirectionParams(delay_ms=10, reorder_pct=5, reorder_correlation_pct=50,
                                   duplicate_pct=0.5, corrupt_pct=0.1, rate_kbit=512))
    s = " ".join(a)
    assert "reorder 5% 50%" in s and "duplicate 0.5%" in s and "corrupt 0.1%" in s and "rate 512kbit" in s


def test_keep_order_uses_rate():
    a = netem_args(DirectionParams(delay_ms=20, jitter_ms=10, keep_order=True))
    assert "rate" in a
    a = netem_args(DirectionParams(delay_ms=20, jitter_ms=10, keep_order=True, rate_kbit=512))
    assert a.count("rate") == 1 and "512kbit" in a
    assert "rate" not in netem_args(DirectionParams(delay_ms=20, jitter_ms=10))


def test_commands_delete_then_add_and_set_mtu():
    cmds = build_commands("eth9", DirectionParams(delay_ms=5, mtu=1400), 1500)
    assert cmds[0][1:3] == ["qdisc", "del"]
    assert cmds[1][1:3] == ["qdisc", "add"] and "netem" in cmds[1]
    assert cmds[2][-2:] == ["mtu", "1400"]
    assert build_commands("eth9", DirectionParams(), 1500)[2][-1] == "1500"


def test_validation():
    with pytest.raises(ValueError):
        DirectionParams(reorder_pct=5)  # no delay
    with pytest.raises(ValueError):
        DirectionParams(loss_mode="burst", loss_pct=100)
    with pytest.raises(ValueError):
        DirectionParams(delay_ms=10, jitter_ms=5, keep_order=True, reorder_pct=1)
    with pytest.raises(ValueError):
        DirectionParams(loss_pct=150)

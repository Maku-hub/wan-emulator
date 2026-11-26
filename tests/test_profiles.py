"""Default profile files and profile storage (no root needed)."""

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "app"))

from wanemu.models import Profile  # noqa: E402
from wanemu.profiles import ProfileStore, slug  # noqa: E402

DEFAULTS = sorted((ROOT / "profiles").glob("*.yaml"))


def test_default_profiles_are_valid_and_translated():
    assert len(DEFAULTS) >= 1
    names = set()
    for f in DEFAULTS:
        p = Profile.model_validate(yaml.safe_load(f.read_text(encoding="utf-8")))
        assert p.name not in names, f"duplicate profile name {p.name}"
        names.add(p.name)
        pl = p.translations.get("pl", {})
        assert pl.get("name") and pl.get("description"), f"{f.name}: missing Polish translation"


def test_store_roundtrip(tmp_path):
    store = ProfileStore(str(tmp_path))
    name = "Test / żółć (roundtrip)"
    store.save(Profile(name=name, description="d", translations={"pl": {"name": "x", "description": "y"}},
                       a_to_b={"delay_ms": 12.5}, b_to_a={"rate_kbit": 64}))
    assert [p["name"] for p in store.list()] == [name]
    p = store.get(name)
    assert p.a_to_b.delay_ms == 12.5 and p.b_to_a.rate_kbit == 64 and p.translations["pl"]["name"] == "x"

    # saving again under the same name overwrites the same file
    store.save(Profile(name=name, a_to_b={"delay_ms": 1}))
    assert len(list(tmp_path.glob("*.yaml"))) == 1 and store.get(name).a_to_b.delay_ms == 1

    assert store.delete(name) and store.get(name) is None and not store.delete(name)


def test_slug():
    assert slug("3G / słaby zasięg") == "3g_slaby_zasieg"
    assert slug("///") == "profile"

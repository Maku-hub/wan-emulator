"""Application settings, read from a YAML file (default: /etc/wanemu/config.yaml)."""

import os
from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass
class Settings:
    # Bridge port on side A. B -> A traffic leaves through this interface.
    iface_a: str = "eth1"
    # Bridge port on side B. A -> B traffic leaves through this interface.
    iface_b: str = "eth2"
    # MTU restored when emulation is stopped
    default_mtu: int = 1500
    profiles_dir: str = "/var/lib/wanemu/profiles"
    state_file: str = "/var/lib/wanemu/state.json"


def load_settings() -> Settings:
    path = Path(os.environ.get("WANEMU_CONFIG", "/etc/wanemu/config.yaml"))
    data = {}
    if path.is_file():
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    known = {k: v for k, v in data.items() if k in Settings.__dataclass_fields__}
    return Settings(**known)

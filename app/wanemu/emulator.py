"""Emulation control: start / stop / status / statistics."""

import json
import shlex
import threading
import time
from pathlib import Path

from . import tc
from .config import Settings
from .models import EmulationConfig


class Emulator:
    def __init__(self, settings: Settings):
        self.s = settings
        self.lock = threading.Lock()
        self.state_path = Path(settings.state_file)

    # A -> B traffic leaves through the side B interface, and vice versa.
    def _targets(self, cfg: EmulationConfig):
        return [(self.s.iface_b, cfg.a_to_b), (self.s.iface_a, cfg.b_to_a)]

    def preview(self, cfg: EmulationConfig) -> list[str]:
        lines = []
        for iface, params in self._targets(cfg):
            for cmd in tc.build_commands(iface, params, self.s.default_mtu):
                lines.append(shlex.join(["tc" if cmd[0] == tc.TC else "ip", *cmd[1:]]))
        return lines

    def start(self, cfg: EmulationConfig, profile: str | None = None, modified: bool = False) -> None:
        with self.lock:
            try:
                for iface, params in self._targets(cfg):
                    tc.apply(iface, params, self.s.default_mtu)
            except tc.TcError:
                self._clear_all()
                raise
            self._save_state({"config": cfg.model_dump(), "profile": profile, "modified": bool(profile and modified),
                              "started": time.time()})

    def stop(self) -> None:
        with self.lock:
            self._clear_all()
            self.state_path.unlink(missing_ok=True)

    def _clear_all(self) -> None:
        for iface in (self.s.iface_a, self.s.iface_b):
            tc.clear(iface, self.s.default_mtu)

    def _save_state(self, data: dict) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.state_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    def _load_state(self) -> dict | None:
        try:
            return json.loads(self.state_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None

    def running(self) -> bool:
        # Read from the actual tc state, not from memory
        return any(tc.root_netem(i) for i in (self.s.iface_a, self.s.iface_b))

    def status(self) -> dict:
        running = self.running()
        state = self._load_state() if running else None
        return {
            "running": running,
            "profile": state.get("profile") if state else None,
            "modified": bool(state.get("modified")) if state else False,
            "started": state.get("started") if state else None,
            "config": state.get("config") if state else None,
            "iface_a": self.s.iface_a,
            "iface_b": self.s.iface_b,
        }

    def stats(self) -> dict:
        def direction(iface: str) -> dict:
            q = tc.root_netem(iface)
            return {
                "iface": tc.iface_info(iface),
                "netem": None if q is None else {
                    "bytes": q.get("bytes"),
                    "packets": q.get("packets"),
                    "drops": q.get("drops"),
                    "overlimits": q.get("overlimits"),
                    "backlog": q.get("backlog"),
                    "qlen": q.get("qlen"),
                },
            }

        return {
            "time": time.time(),
            "running": self.running(),
            "a_to_b": direction(self.s.iface_b),
            "b_to_a": direction(self.s.iface_a),
        }

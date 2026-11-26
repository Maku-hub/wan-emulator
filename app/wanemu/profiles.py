"""Profile storage: one YAML file per profile."""

import re
from pathlib import Path

import yaml

from .models import Profile

# Transliteration of Polish letters for file names
_PL = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")


def slug(name: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "_", name.translate(_PL)).strip("_").lower()
    return s or "profile"


class ProfileStore:
    def __init__(self, directory: str):
        self.dir = Path(directory)
        self.dir.mkdir(parents=True, exist_ok=True)

    def _files(self):
        return sorted(self.dir.glob("*.yaml"))

    def _load(self, path: Path) -> Profile | None:
        try:
            return Profile.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
        except Exception:
            return None

    def _find(self, name: str) -> Path | None:
        for f in self._files():
            p = self._load(f)
            if p and p.name == name:
                return f
        return None

    def list(self) -> list[dict]:
        out = []
        for f in self._files():
            p = self._load(f)
            if p:
                out.append({"name": p.name, "description": p.description, "translations": p.translations})
        return out  # ordered by file name: default profiles (01_..., 02_...) first

    def get(self, name: str) -> Profile | None:
        f = self._find(name)
        return self._load(f) if f else None

    def save(self, profile: Profile) -> None:
        path = self._find(profile.name)
        if path is None:
            base = slug(profile.name)
            path = self.dir / f"{base}.yaml"
            n = 2
            while path.exists():
                path = self.dir / f"{base}_{n}.yaml"
                n += 1
        d = profile.model_dump()
        keys = ("name", "description", "translations", "a_to_b", "b_to_a") if d["translations"] \
            else ("name", "description", "a_to_b", "b_to_a")
        text = yaml.safe_dump({k: d[k] for k in keys}, allow_unicode=True, sort_keys=False)
        tmp = path.with_suffix(".tmp")
        tmp.write_text(text, encoding="utf-8")
        tmp.replace(path)

    def delete(self, name: str) -> bool:
        f = self._find(name)
        if f:
            f.unlink()
            return True
        return False

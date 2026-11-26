"""FastAPI application: REST API and the web panel's static files."""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .config import load_settings
from .emulator import Emulator
from .models import EmulationConfig, Profile, StartRequest
from .profiles import ProfileStore
from .tc import TcError

settings = load_settings()
emulator = Emulator(settings)
profiles = ProfileStore(settings.profiles_dir)

app = FastAPI(title="WAN Emulator", version=__version__)


@app.exception_handler(TcError)
def _tc_error(_, exc: TcError):
    return JSONResponse(status_code=500, content={"detail": f"tc error: {exc}"})


@app.get("/api/status")
def get_status():
    return {**emulator.status(), "version": __version__}


@app.get("/api/stats")
def get_stats():
    return emulator.stats()


@app.post("/api/start")
def start(req: StartRequest):
    emulator.start(req.config, req.profile, req.modified)
    return emulator.status()


@app.post("/api/stop")
def stop():
    emulator.stop()
    return emulator.status()


@app.post("/api/preview")
def preview(cfg: EmulationConfig):
    return {"commands": emulator.preview(cfg)}


@app.get("/api/profiles")
def list_profiles():
    return profiles.list()


@app.get("/api/profiles/{name:path}")
def get_profile(name: str):
    p = profiles.get(name)
    if p is None:
        raise HTTPException(404, f"Profile not found: {name}")
    return p


@app.put("/api/profiles/{name:path}")
def save_profile(name: str, profile: Profile):
    if profile.name != name:
        raise HTTPException(400, "Profile name in the URL and in the body must be the same")
    profiles.save(profile)
    return {"ok": True}


@app.delete("/api/profiles/{name:path}")
def delete_profile(name: str):
    if not profiles.delete(name):
        raise HTTPException(404, f"Profile not found: {name}")
    return {"ok": True}


app.mount("/", StaticFiles(directory=Path(__file__).parent / "static", html=True), name="static")

"""FastAPI backend لـ Blink Sphere.
يخدم المكعب الثنائي + النتائج المحسوبة مسبقًا (fallback اصطناعي).
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse

APP_DIR = Path(__file__).resolve().parent.parent  # backend/
DATA_DIR = APP_DIR.parent / "public" / "data"

app = FastAPI(title="Blink Sphere API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# تحميل一次 عند بدء التشغيل
# ---------------------------------------------------------------------------
_CUBE: np.ndarray | None = None
_METADATA: dict | None = None
_PRECOMPUTED: dict | None = None
_ICE_MAPS: dict | None = None
_REF_SPECTRA: dict | None = None


def _load_all() -> None:
    global _CUBE, _METADATA, _PRECOMPUTED, _ICE_MAPS, _REF_SPECTRA
    meta_path = DATA_DIR / "metadata.json"
    if not meta_path.exists():
        return
    with open(meta_path, encoding="utf-8") as f:
        _METADATA = json.load(f)
    nx, ny, nw = _METADATA["nx"], _METADATA["ny"], _METADATA["nwave"]
    cube_path = DATA_DIR / "cube.bin"
    if cube_path.exists():
        raw = np.fromfile(cube_path, dtype=np.float32)
        if raw.size == nx * ny * nw:
            _CUBE = raw.reshape(ny, nx, nw)
    pre_path = DATA_DIR / "precomputed.json"
    if pre_path.exists():
        with open(pre_path, encoding="utf-8") as f:
            _PRECOMPUTED = json.load(f)
    ice_path = DATA_DIR / "ice_maps.json"
    if ice_path.exists():
        with open(ice_path, encoding="utf-8") as f:
            _ICE_MAPS = json.load(f)
    ref_path = DATA_DIR / "reference_spectra.json"
    if ref_path.exists():
        with open(ref_path, encoding="utf-8") as f:
            _REF_SPECTRA = json.load(f)


@app.on_event("startup")
def _startup() -> None:
    _load_all()


# ---------------------------------------------------------------------------
# endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {"status": "ok", "cube_loaded": _CUBE is not None, "synthetic": bool(_METADATA and _METADATA.get("synthetic"))}


@app.get("/metadata")
def metadata() -> dict:
    if _METADATA is None:
        raise HTTPException(status_code=500, detail="metadata not loaded")
    return _METADATA


@app.get("/cube/slice")
def cube_slice(z: int = 0) -> dict:
    """يعيد شريحة واحدة (المكعب بالكامل للقناة z) كقائمة."""
    if _CUBE is None:
        raise HTTPException(status_code=500, detail="cube not loaded")
    z = max(0, min(z, _CUBE.shape[2] - 1))
    sl = _CUBE[:, :, z]
    return {"z": z, "data": sl.tolist(), "shape": [int(sl.shape[0]), int(sl.shape[1])]}


@app.get("/cube/band")
def cube_band(band: int = 0) -> dict:
    """مُعادل لـ /cube/slice (للتوافق مع الواجهة)."""
    return cube_slice(z=band)


@app.get("/spectrum/{x}/{y}")
def spectrum(x: int, y: int) -> dict:
    """طيف بكسل واحد (nwave,) + أطوال الموجة."""
    if _CUBE is None or _METADATA is None:
        raise HTTPException(status_code=500, detail="cube not loaded")
    nx, ny = _METADATA["nx"], _METADATA["ny"]
    x = max(0, min(x, nx - 1))
    y = max(0, min(y, ny - 1))
    spec = _CUBE[y, x, :].tolist()
    return {"x": x, "y": y, "flux": spec, "wavelength_um": _METADATA["wavelength_um"]}


@app.get("/ice/{icetype}")
def ice_map(icetype: str) -> dict:
    if _ICE_MAPS is None:
        raise HTTPException(status_code=500, detail="ice maps not loaded")
    key = icetype
    # accept aliases
    alias = {"h2o": "H2O_ice", "co2": "CO2_ice", "co": "CO_ice"}
    key = alias.get(icetype.lower(), icetype)
    if key not in _ICE_MAPS:
        raise HTTPException(status_code=404, detail=f"ice map {icetype} not found")
    return {"icetype": icetype, "data": _ICE_MAPS[key]}


@app.get("/anomalies")
def anomalies() -> dict:
    if _PRECOMPUTED is None:
        raise HTTPException(status_code=500, detail="precomputed not loaded")
    return _PRECOMPUTED


@app.get("/reference-spectra")
def reference_spectra() -> dict:
    if _REF_SPECTRA is None:
        raise HTTPException(status_code=500, detail="reference spectra not loaded")
    return _REF_SPECTRA


@app.post("/match")
def match_spectrum(payload: dict) -> dict:
    """مقارنة طيف مستخدم مع أطياف مرجعية عبر cosine similarity."""
    if _REF_SPECTRA is None:
        raise HTTPException(status_code=500, detail="reference spectra not loaded")
    user_flux = payload.get("flux")
    if not user_flux or len(user_flux) != len(_REF_SPECTRA["wavelength_um"]):
        raise HTTPException(status_code=400, detail="flux length mismatch")
    u = np.array(user_flux, dtype=float)
    un = u / (np.linalg.norm(u) + 1e-12)
    results = []
    for name, spec in _REF_SPECTRA["spectra"].items():
        v = np.array(spec, dtype=float)
        vn = v / (np.linalg.norm(v) + 1e-12)
        sim = float(np.dot(un, vn))
        results.append({"name": name, "similarity": sim})
    results.sort(key=lambda r: -r["similarity"])
    return {"matches": results[:3]}


@app.get("/cube/thumb")
def cube_thumb(band: int = 0) -> dict:
    """إرجاع بيانات القناة للصورة المصغرة (repr صغيرة)."""
    return cube_slice(z=band)


# نقطة نهاية ثابتة لملف بيانات تجريبي لو احتاج الواجهة
@app.get("/data/{filename}")
def data_file(filename: str) -> FileResponse:
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="file not found")
    return FileResponse(path)

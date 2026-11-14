"""
prepare_data.py — يولّد مكعبًا طيفيًا اصطناعيًا واقعيًا (fallback) لـ SPHEREx Spectral Lab.

المكونات:
  - نجوم (طيف بودي أسود بدرجات حرارة مختلفة)
  - أقزام بنية (امتصاص ميثان/ماء عند 1.6 و2.2 و3.3 ميكرون)
  - مجرات (كسر 4000Å، خطوط انبعاث، انزياح أحمر متنوع)
  - سحابة جليد extended (امتصاص H2O 3.0، CO2 4.27، CO 4.67 ميكرون)

النواتج (تُحفظ في public/data/):
  - cube.bin              : Float32، شكل (ny, nx, nwave)
  - metadata.json         : أطوال الموجة، الإحداثيات، حجم البكسل
  - precomputed.json      : نتائج anomaly / ice depths / flags مرتبة

تشغيل: python scripts/prepare_data.py
"""

from __future__ import annotations

import json
import math
import os
import sys
from dataclasses import dataclass

import numpy as np

# إصلاح ترميز stdout على Windows (cp1252) للنصوص العربية
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    from astropy.io import fits  # noqa: F401  (مستعد للداتا الحقيقية لاحقًا)
except Exception:  # pragma: no cover - astropy اختياري في مرحلة التحضير الاصطناعي
    fits = None

# ---------------------------------------------------------------------------
# الإعدادات
# ---------------------------------------------------------------------------
NX, NY = 128, 128            # حجم المكعب (يظل معقولًا للسلة الجانبية + المتصفح)
NWAVE = 102                  # قنوات SPHEREx
WAVE_MIN, WAVE_MAX = 0.75, 5.0  # ميكرون

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "data")
os.makedirs(DATA_DIR, exist_ok=True)

RNG = np.random.default_rng(42)


# ---------------------------------------------------------------------------
# أطوال الموجة (م proportional-log، أقرب للمنطق تحت الأحمر الحقيقي)
# ---------------------------------------------------------------------------
def make_wavelengths(n: int, wmin: float, wmax: float) -> np.ndarray:
    return np.geomspace(wmin, wmax, n)


WAVE = make_wavelengths(NWAVE, WAVE_MIN, WAVE_MAX)


# ---------------------------------------------------------------------------
# نماذج طيفية مرجعية مبسطة (مصطنعة بوضوح) — تُعاد أخذ عيناتها على أطوال موجة SPHEREx
# ---------------------------------------------------------------------------
def blackbody(wave_um: float, temp_k: float) -> float:
    """إشعاع بودي أسود (وحدات نسبية)."""
    h = 6.62607015e-34
    c = 2.99792458e8
    k = 1.380649e-23
    lam = wave_um * 1e-6
    nu = c / lam
    return (2 * h * nu**3 / c**2) / (np.expm1(h * nu / (k * temp_k)) + 1e-300)


def absorption_feature(wave: np.ndarray, center: float, width: float, depth: float) -> np.ndarray:
    """خط امتصاص غاوسي."""
    return depth * np.exp(-0.5 * ((wave - center) / width) ** 2)


def reference_spectrum(name: str, wave: np.ndarray) -> np.ndarray:
    """يُعيد طيفًا مرجعيًا مبسطًا (مصطنع) باسمه."""
    if name == "star_g2":  # شمسي مشابه
        s = np.array([blackbody(w, 5778) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 0.76, 0.02, 0.15)  # O2 A-band
        return np.clip(s, 0, None)
    if name == "star_k5":  # نجم برتقالي بارد
        s = np.array([blackbody(w, 4400) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 0.76, 0.02, 0.2)
        s -= absorption_feature(wave, 1.6, 0.05, 0.1)
        return np.clip(s, 0, None)
    if name == "bd_l":  # قزم بني L
        s = np.array([blackbody(w, 2200) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 1.4, 0.1, 0.5)  # ماء
        s -= absorption_feature(wave, 1.9, 0.15, 0.6)  # ماء
        s -= absorption_feature(wave, 3.3, 0.2, 0.7)  # ميثان
        return np.clip(s, 0, None)
    if name == "bd_t":  # قزم بني T (ميثان قوي)
        s = np.array([blackbody(w, 1300) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 1.4, 0.1, 0.7)
        s -= absorption_feature(wave, 1.9, 0.15, 0.8)
        s -= absorption_feature(wave, 2.2, 0.1, 0.5)
        s -= absorption_feature(wave, 3.3, 0.2, 0.9)  # ميثان قوي
        return np.clip(s, 0, None)
    if name == "galaxy":  # مجرة من دون انزياح أحمر كبير
        s = np.array([blackbody(w, 4500) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 0.4, 0.02, 0.4)  # كسر 4000Å (مبدئي)
        s += 0.15 * np.exp(-0.5 * ((wave - 0.6563) / 0.01) ** 2)  # H-alpha
        return np.clip(s, 0, None)
    if name == "ice_cloud":  # سحابة جليد باردة
        s = np.array([blackbody(w, 20) for w in wave])
        s *= 1.0 / (s.max() + 1e-12)
        s -= absorption_feature(wave, 3.0, 0.15, 0.8)  # H2O جليد
        s -= absorption_feature(wave, 4.27, 0.1, 0.7)  # CO2 جليد
        s -= absorption_feature(wave, 4.67, 0.1, 0.6)  # CO جليد
        return np.clip(s, 0, None)
    # افتراضي: بودي أسود محايد
    s = np.array([blackbody(w, 5000) for w in wave])
    s *= 1.0 / (s.max() + 1e-12)
    return np.clip(s, 0, None)


REFERENCE_NAMES = ["star_g2", "star_k5", "bd_l", "bd_t", "galaxy", "ice_cloud"]


# ---------------------------------------------------------------------------
# بناء المكعب الاصطناعي
# ---------------------------------------------------------------------------
@dataclass
class Source:
    x: float
    y: float
    flux: float
    kind: str  # star_g2 | star_k5 | bd_l | bd_t | galaxy | ice_cloud
    sigma: float = 2.0  # عرض punkt source بالبكسل


def build_cube() -> np.ndarray:
    cube = np.zeros((NY, NX, NWAVE), dtype=np.float32)

    # خلفية كونية خافتة + ضوضاء
    background = np.array([blackbody(w, 30) for w in WAVE], dtype=np.float32)
    background = background / (background.max() + 1e-12)
    cube += background[None, None, :] * 0.02
    cube += RNG.normal(0, 0.002, size=(NY, NX, NWAVE)).astype(np.float32)

    # قائمة المصادر
    sources: list[Source] = []
    for _ in range(120):  # نجوم عادية
        sources.append(
            Source(
                float(RNG.uniform(5, NX - 5)),
                float(RNG.uniform(5, NY - 5)),
                float(RNG.uniform(0.5, 3.0)),
                RNG.choice(["star_g2", "star_k5"], p=[0.7, 0.3]),
                float(RNG.uniform(1.5, 2.5)),
            )
        )
    for _ in range(30):  # أقزام بنية
        sources.append(
            Source(
                float(RNG.uniform(5, NX - 5)),
                float(RNG.uniform(5, NY - 5)),
                float(RNG.uniform(0.3, 1.5)),
                RNG.choice(["bd_l", "bd_t"], p=[0.5, 0.5]),
                float(RNG.uniform(1.5, 2.5)),
            )
        )
    for _ in range(15):  # مجرات
        sources.append(
            Source(
                float(RNG.uniform(5, NX - 5)),
                float(RNG.uniform(5, NY - 5)),
                float(RNG.uniform(0.4, 2.0)),
                "galaxy",
                float(RNG.uniform(2.5, 4.0)),
            )
        )

    # سحابة جليد ممتدة في منتصف lower-left
    ice_cx, ice_cy = NX * 0.3, NY * 0.7
    ice_radius = 20.0

    yy, xx = np.mgrid[0:NY, 0:NX]
    for src in sources:
        ref = reference_spectrum(src.kind, WAVE)
        # ملف مكاني غاوسي للنقطة
        d2 = (xx - src.y) ** 2 + (yy - src.x) ** 2
        spatial = np.exp(-0.5 * d2 / (src.sigma**2))
        cube += (spatial[:, :, None] * src.flux * ref[None, None, :]).astype(np.float32)

    # تأثير السحابة الجليدية على كل بكسل داخلها (امتصاص مضروب)
    ice_mask = (xx - ice_cx) ** 2 + (yy - ice_cy) ** 2 < ice_radius**2
    ice_ref = reference_spectrum("ice_cloud", WAVE)
    # السحابة تضيف انبعاثًا باردًا خفيفًا وتمتص في خطوط الجليد
    ice_emission = ice_ref * 0.05
    cube[ice_mask] += ice_emission[None, :]
    # تعزيز الامتصاص في خطوط الجليد للبكسلات داخل السحابة
    for wl, depth in [(3.0, 0.6), (4.27, 0.5), (4.67, 0.4)]:
        idx = int(np.argmin(np.abs(WAVE - wl)))
        cube[ice_mask, idx] *= 1.0 - depth

    # بعض الشواذ الاصطناعية (weird objects) للكشف عنها
    for _ in range(8):
        sx = float(RNG.uniform(10, NX - 10))
        sy = float(RNG.uniform(10, NY - 10))
        weird = np.array([blackbody(w, RNG.uniform(100, 6000)) for w in WAVE])
        weird *= RNG.uniform(0.5, 2.0) / (weird.max() + 1e-12)
        d2 = (xx - sy) ** 2 + (yy - sx) ** 2
        spatial = np.exp(-0.5 * d2 / (3.0**2))
        cube += (spatial[:, :, None] * RNG.uniform(1.0, 3.0) * weird[None, None, :]).astype(np.float32)

    cube = np.clip(cube, 0, None)
    return cube.astype(np.float32)


# ---------------------------------------------------------------------------
# حسابات مسبقة (تُخزن في JSON للمتصفح)
# ---------------------------------------------------------------------------
def continuum_fit(wave: np.ndarray, flux: np.ndarray, line_center: float, half_width: float) -> float:
    """يُعيد عمق الامتصاص (= optical depth تقريبًا) باستخدام خط أساس خطي من القنوات المجاورة."""
    left_mask = (wave > line_center - 2 * half_width) & (wave < line_center - half_width)
    right_mask = (wave > line_center + half_width) & (wave < line_center + 2 * half_width)
    if left_mask.sum() < 2 or right_mask.sum() < 2:
        return 0.0
    x_l = wave[left_mask]
    y_l = flux[left_mask]
    x_r = wave[right_mask]
    y_r = flux[right_mask]
    x = np.concatenate([x_l, x_r])
    y = np.concatenate([y_l, y_r])
    if np.ptp(x) < 1e-6:
        return 0.0
    slope, intercept = np.polyfit(x, y, 1)
    continuum = slope * line_center + intercept
    observed = float(np.interp(line_center, wave, flux))
    if continuum <= 0:
        return 0.0
    tau = -math.log(max(observed / continuum, 1e-6))
    return max(tau, 0.0)


def compute_ice_maps(cube: np.ndarray, wave: np.ndarray) -> dict:
    lines = [
        ("H2O_ice", 3.0, 0.25),
        ("CO2_ice", 4.27, 0.2),
        ("CO_ice", 4.67, 0.2),
    ]
    ny, nx, _ = cube.shape
    out = {}
    for name, center, hw in lines:
        amap = np.zeros((ny, nx), dtype=np.float32)
        for y in range(ny):
            for x in range(nx):
                amap[y, x] = continuum_fit(wave, cube[y, x], center, hw)
        out[name] = amap.astype(np.float32).tolist()
    return out


def compute_anomaly(cube: np.ndarray) -> dict:
    """كشف الشذوذ بـ numpy-only: انحراف كل طيف عن متوسط الحقل الطيفي (Z-score per channel).
    يُعيد خريطة شذوذ (0..1) + قائمة top flags."""
    ny, nx, nw = cube.shape
    X = cube.reshape(-1, nw).astype(np.float64)
    # متوسط الحقل الطيفي عبر كل البكسلات
    mean_spec = X.mean(axis=0)
    std_spec = X.std(axis=0) + 1e-9
    # Z-score لكل بكسل لكل قناة، ثم أخذ أقصى انحراف مطلق كدرجة شذوذ للبكسل
    Z = np.abs((X - mean_spec[None, :]) / std_spec[None, :])
    anomaly = Z.max(axis=1).reshape(ny, nx)
    # normalize to 0..1
    a_min, a_max = float(anomaly.min()), float(anomaly.max())
    if a_max - a_min < 1e-9:
        anomaly_n = np.zeros_like(anomaly)
    else:
        anomaly_n = (anomaly - a_min) / (a_max - a_min)
    # top-N flags
    flat = anomaly_n.reshape(-1)
    top_idx = np.argsort(-flat)[:50]
    flags = []
    for idx in top_idx:
        y, x = divmod(int(idx), nx)
        flags.append({"x": int(x), "y": int(y), "score": float(flat[idx])})
    return {"anomaly_map": anomaly_n.astype(np.float32).tolist(), "flags": flags}


# ---------------------------------------------------------------------------
#incipal
# ---------------------------------------------------------------------------
def main() -> None:
    print(f"إنتاج أطوال الموجة: {WAVE_MIN}–{WAVE_MAX} µm، {NWAVE} قناة")
    cube = build_cube()
    print(f"حجم المكعب: {cube.shape} dtype={cube.dtype} max={float(cube.max()):.4f}")

    # 1) المكعب الثنائي
    cube_path = os.path.join(DATA_DIR, "cube.bin")
    cube.tofile(cube_path)
    print("تم حفظ", cube_path)

    # 2) metadata
    metadata = {
        "nx": NX,
        "ny": NY,
        "nwave": NWAVE,
        "wavelength_um": WAVE.tolist(),
        "wave_min": float(WAVE.min()),
        "wave_max": float(WAVE.max()),
        "ra_center": 0.0,
        "dec_center": 0.0,
        "pixel_scale_arcsec": 6.0,
        "synthetic": True,
        "source": "synthetic fallback (prepare_data.py)",
    }
    with open(os.path.join(DATA_DIR, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
    print("تم حفظ metadata.json")

    # 3) أطياف مرجعية
    refs = {name: reference_spectrum(name, WAVE).tolist() for name in REFERENCE_NAMES}
    with open(os.path.join(DATA_DIR, "reference_spectra.json"), "w", encoding="utf-8") as f:
        json.dump({"wavelength_um": WAVE.tolist(), "spectra": refs}, f, ensure_ascii=False, indent=2)
    print("تم حفظ reference_spectra.json")

    # 4) خرائط الجليد
    ice_maps = compute_ice_maps(cube, WAVE)
    with open(os.path.join(DATA_DIR, "ice_maps.json"), "w", encoding="utf-8") as f:
        json.dump(ice_maps, f, ensure_ascii=False)
    print("تم حفظ ice_maps.json")

    # 5) الشذوذ والمرشحين
    anomaly = compute_anomaly(cube)
    with open(os.path.join(DATA_DIR, "precomputed.json"), "w", encoding="utf-8") as f:
        json.dump(anomaly, f, ensure_ascii=False)
    print("تم حفظ precomputed.json (مرشحين:", len(anomaly["flags"]), ")")

    print("\nانتهى التحضير الاصطناعي بنجاح. الملفات في", DATA_DIR)


if __name__ == "__main__":
    main()

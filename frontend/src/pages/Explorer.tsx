/**
 * Explorer — الأدوات 1+2+3 على عارض واحد.
 * يحمل المكعب الثنائي + النتائج المحسوبة من الباك إند (fallback اصطناعي),
 * ويرسم ألوان तरفي مباشرة على كانفاس، ثم يعرض طيف البكسل المختار + مطابقة + خرائط الجليد.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useLang } from "@/components/LangContext";
import {
  Eye, Play, RefreshCw, Maximize, Layout, Wifi, Cpu, ShieldAlert, BarChart3, Flame,
} from "lucide-react";
import CanvasViewer from "@/components/CanvasViewer";
import SpectrumPanel from "@/components/SpectrumPanel";

const API_UNUSED = ""; // لا يوجد أي استدعاء للباك إند — كل البيانات تُقرأ من /data/ مباشرة (static deploy)

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function plasma(t: number): { r: number; g: number; b: number } {
  // تقريبي لباقة plasma لخرائط الجليد
  const c = [
    [0.50, 0.05, 0.75],
    [0.63, 0.23, 0.77],
    [0.71, 0.42, 0.73],
    [0.76, 0.60, 0.64],
    [0.79, 0.76, 0.52],
    [0.86, 0.89, 0.35],
    [0.99, 0.91, 0.19],
  ];
  const i = Math.min(Math.floor(t * (c.length - 1)), c.length - 1);
  const j = Math.min(i + 1, c.length - 1);
  const f = t * (c.length - 1) - i;
  return {
    r: c[i][0] * (1 - f) + c[j][0] * f,
    g: c[i][1] * (1 - f) + c[j][1] * f,
    b: c[i][2] * (1 - f) + c[j][2] * f,
  };
}

export default function ExplorerPage() {
  const { lang, t, dir } = useLang();
  const [meta, setMeta] = useState<any>(null);
  const [cube, setCube] = useState<Float32Array | null>(null);
  const [iceMaps, setIceMaps] = useState<any>(null);
  const [precomputed, setPrecomputed] = useState<any>(null);
  const [refs, setRefs] = useState<Record<string, number[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selX, setSelX] = useState<number | null>(null);
  const [selY, setSelY] = useState<number | null>(null);
  const [flux, setFlux] = useState<number[] | null>(null);

  // حالة الجليد
  const [iceType, setIceType] = useState<string | null>("H2O_ice");
  const [iceOpacity, setIceOpacity] = useState(0.5);
  const [iceVisible, setIceVisible] = useState(false);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [mRes, cubeRes, iceRes, preRes, refRes] = await Promise.all([
        fetch("/data/metadata.json"),
        fetch("/data/cube.bin"),
        fetch("/data/ice_maps.json"),
        fetch("/data/precomputed.json"),
        fetch("/data/reference_spectra.json"),
      ]);
      const meta = await mRes.json();
      const ab = await cubeRes.arrayBuffer();
      const cube = new Float32Array(ab);
      const ice = await iceRes.json();
      const pre = await preRes.json();
      const ref = await refRes.json();
      setMeta(meta);
      setCube(cube);
      setIceMaps(ice);
      setPrecomputed(pre);
      setRefs(ref.spectra);
    } catch (e: any) {
      setError(e.message || "فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePixelSelect = useCallback((x: number, y: number) => {
    setSelX(x);
    setSelY(y);
    if (!cube || !meta) return;
    const nx = meta.nx, nwave = meta.nwave;
    const spec = new Array(nwave);
    const base = (y * nx + x) * nwave; // المخزن (ny, nx, nwave)
    for (let ch = 0; ch < nwave; ch++) {
      spec[ch] = cube[base + ch];
    }
    setFlux(spec);
  }, [cube, meta]);

  // استلام البكسل المختار من صفحة المرشحين
  useEffect(() => {
    if (!cube || !meta) return;
    const saved = localStorage.getItem("spl_selected_pixel");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (typeof p.x === "number" && typeof p.y === "number") {
          localStorage.removeItem("spl_selected_pixel");
          handlePixelSelect(p.x, p.y);
        }
      } catch {
        // تجاهل خطأ التحليل
      }
    }
  }, [cube, meta, handlePixelSelect]);

  // إعادة رسم خريطة الجليد الحرارية فوق الصورة
  useEffect(() => {
    const canvas = heatCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !iceVisible || !iceType || !iceMaps || !meta) {
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const nx = meta.nx, ny = meta.ny;
    canvas.width = nx;
    canvas.height = ny;
    const data = iceMaps[iceType];
    if (!data) return;
    // إيجاد حد أقصى للتصفيف
    let maxV = 0;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if (data[y][x] > maxV) maxV = data[y][x];
    const img = ctx.createImageData(nx, ny);
    const d = img.data;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        const t = maxV > 0 ? Math.min(1, data[y][x] / maxV) : 0;
        const c = plasma(t);
        const a = Math.round(t * iceOpacity * 255);
        const base = i * 4;
        d[base] = Math.round(c.r * 255);
        d[base + 1] = Math.round(c.g * 255);
        d[base + 2] = Math.round(c.b * 255);
        d[base + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [iceVisible, iceType, iceOpacity, iceMaps, meta]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-space-400">
        <div className="animate-spin w-10 h-10 border-4 border-nebula-500/30 border-t-nebula-500 rounded-full mb-3" />
        <p>{t("loading")}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-red-400 font-semibold mb-2">{t("error")}</h2>
        <p className="text-sm text-space-400 mb-4 max-w-xs">{error}</p>
        <button className="btn btn-outline" onClick={loadData}>{t("retry")}</button>
      </div>
    );
  }
  if (!meta || !cube) {
    return <div className="flex flex-col items-center justify-center h-full text-space-500">{t("loading")}</div>;
  }

  const nx = meta.nx, ny = meta.ny, nwave = meta.nwave;
  const synthetic = !!meta.synthetic;

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:gap-4 gap-3">
        {/* البطاقة اليسرى: العارض + التحكم */}
        <div className="flex-1 min-w-0 card border-space-800">
          <div className="p-3 border-b border-space-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-nebula-400" />
              <h2 className="font-semibold text-space-100">العارض الطيفي — مزج ألوان</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-outline text-xs px-2 py-1.5" onClick={loadData}>
                <RefreshCw className="w-3 h-3" /> إعادة تحميل
              </button>
              {synthetic && <span className="badge-synthetic text-xs">{t("syntheticBadge")}</span>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
            <div className="md:col-span-2 min-h-[420px] relative">
              <CanvasViewer
                cube={cube}
                nx={nx}
                ny={ny}
                nwave={nwave}
                wavelength={meta.wavelength_um}
                onPixelSelect={handlePixelSelect}
                selectedX={selX}
                selectedY={selY}
              />
              {/* طبقة الجليد الحرارية فوق الكانفاس */}
              {iceVisible && iceType && (
                <canvas
                  ref={heatCanvasRef}
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none crisp-image"
                  style={{ zIndex: 10, imageRendering: "pixelated" }}
                />
              )}
              {selX != null && selY != null && (
                <div className="absolute top-2 right-2 z-20 flex flex-col gap-1">
                  <span className="text-xs font-mono bg-space-900/80 px-2 py-1 rounded border border-space-700 text-nebula-400">
                    ({selX}, {selY})
                  </span>
                </div>
              )}
            </div>

            {/* أدوات الجليد */}
            <div className="space-y-3 p-3">
              <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-2">صائد الجليد (أداة 3)</h3>
              <div className="space-y-2">
                {[
                  { key: "H2O_ice", label: "H₂O ~3.0 µm" },
                  { key: "CO2_ice", label: "CO₂ ~4.27 µm" },
                  { key: "CO_ice", label: "CO ~4.67 µm" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setIceVisible(true);
                      setIceType(opt.key);
                    }}
                    className={`w-full text-left px-3 py-2 rounded border rounded-lg text-sm transition ${
                      iceType === opt.key
                        ? "bg-nebula-500/20 border-nebula-500 text-nebula-300"
                        : "bg-space-800 border-space-800 text-space-300 hover:bg-space-700"
                    }`}
                  >
                    <Flame className="w-3 h-3 mr-2" style={{ color: opt.key === "H2O_ice" ? "#22d3ee" : opt.key === "CO2_ice" ? "#f472b6" : "#a78bfa" }} />
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => setIceVisible(false)}
                  className="w-full text-left px-3 py-2 rounded border border-space-800 text-sm text-space-500 hover:bg-space-700"
                >
                  إخفاء الخريطة
                </button>
                <div className="pt-2">
                  <label className="text-[10px] text-space-500 block mb-1">درجة الشفافية</label>
                  <input
                    type="range" min={0} max={1} step={0.05} value={iceOpacity}
                    onChange={(e) => setIceOpacity(parseFloat(e.target.value))}
                    className="w-full accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
              <div className="mt-3 p-2 rounded bg-space-800/50 border border-space-800">
                <p className="text-[10px] text-space-400 mb-1">طريقة الحساب:</p>
                <p className="text-xs text-space-300">خط أساس خطي من القنوات المجاورة للخط، τ = −ln(F/contin).</p>
              </div>
            </div>
          </div>
        </div>

        {/* البطاقة اليمنى: الطيف + المطابقة + الجليد القيم */}
        <div className="md:w-[420px] min-w-[360px] flex flex-col gap-3">
          <SpectrumPanel
            wavelength={meta.wavelength_um}
            flux={flux}
            x={selX}
            y={selY}
            referenceSpectra={refs}
            synthetic={synthetic}
          />
          <div className="card p-3 border-space-800">
            <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-3">المرشحون الشاذون (أداة 4 مبدئي)</h3>
            <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
              {(precomputed?.flags || []).slice(0, 8).map((f: any, i: number) => (
                <div
                  key={i}
                  onClick={() => handlePixelSelect(f.x, f.y)}
                  className="text-xs px-2.5 py-2 rounded border border-space-800/50 bg-space-800/40 cursor-pointer hover:bg-space-700 transition flex items-center justify-between"
                >
                  <div>
                    <span className="font-mono text-space-300">({f.x},{f.y})</span>
                    <span className="ml-2 text-[10px] text-space-500">score {f.score?.toFixed(2) ?? "—"}</span>
                  </div>
                  <BarChart3 className="w-3 h-3 text-space-600" />
                </div>
              ))}
              {(precomputed?.flags || []).length === 0 && (
                <p className="text-xs text-space-500 italic">لا توجد مرشحين بعد.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-space-500 text-center">
        {synthetic ? "بيان اصطناعي تجريبي —للواجهة فقط. غير مقصود كقياسات حقيقية." : "بيان حقيقي من أرشيف NASA/IPAC IRSA."}
      </div>
    </div>
  );
}

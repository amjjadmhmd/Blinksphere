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
import SpectralAssistant from "@/components/SpectralAssistant";

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
  const { lang, t } = useLang();
  const ar = lang === "ar";
  const [meta, setMeta] = useState<any>(null);
  const [cube, setCube] = useState<Float32Array | null>(null);
  const [iceMaps, setIceMaps] = useState<any>(null);
  const [precomputed, setPrecomputed] = useState<any>(null);
  const [refs, setRefs] = useState<Record<string, number[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadPct, setLoadPct] = useState(0);
  const [loadNote, setLoadNote] = useState<string>("");

  const [selX, setSelX] = useState<number | null>(null);
  const [selY, setSelY] = useState<number | null>(null);
  const [flux, setFlux] = useState<number[] | null>(null);
  const [analysis, setAnalysis] = useState<{ matches: { name: string; sim: number }[]; depths: Record<string, number> } | null>(null);

  // حالة الجليد
  const [iceType, setIceType] = useState<string | null>("H2O_ice");
  const [iceOpacity, setIceOpacity] = useState(0.5);
  const [iceVisible, setIceVisible] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const heatCanvasRef = useRef<HTMLCanvasElement>(null);

  const handleAnalysis = useCallback(
    (a: { matches: { name: string; sim: number }[]; depths: Record<string, number> }) => setAnalysis(a),
    []
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setLoadPct(0);
      setLoadNote("metadata");
      const [mRes, iceRes, preRes, refRes] = await Promise.all([
        fetch("/data/metadata.json"),
        fetch("/data/ice_maps.json"),
        fetch("/data/precomputed.json"),
        fetch("/data/reference_spectra.json"),
      ]);
      const meta = await mRes.json();
      setLoadNote("cube");

      // تدفّق المكعب مع نسبة تقدم حقيقية (6.4 MB)
      const cubeRes = await fetch("/data/cube.bin");
      if (!cubeRes.ok) throw new Error(`cube.bin: HTTP ${cubeRes.status}`);
      const total = Number(cubeRes.headers.get("content-length") || 0) || 6684672;
      const reader = cubeRes.body?.getReader();
      let buf: Uint8Array;
      if (reader) {
        const chunks: Uint8Array[] = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            setLoadPct(Math.min(100, Math.round((received / total) * 100)));
          }
        }
        buf = new Uint8Array(received);
        let off = 0;
        for (const c of chunks) {
          buf.set(c, off);
          off += c.byteLength;
        }
      } else {
        buf = new Uint8Array(await cubeRes.arrayBuffer());
      }
      // نسخة متوافقة مع Float32Array (التخزين قد لا يكون مصفوفاً بـ 4 بايت)
      const cube = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

      setLoadNote("ice");
      setLoadPct(100);
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

  // ابدأ الجولة تلقائياً أول زيارة فقط
  useEffect(() => {
    try {
      if (!localStorage.getItem("blink_tour_done")) setTourStep(0);
    } catch {
      /* ignore */
    }
  }, []);

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

  // إعادة رسم خريطة الجليد / الشذوذ الحرارية فوق الصورة
  useEffect(() => {
    const canvas = heatCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !iceVisible || !iceType || !meta) {
      if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    const nx = meta.nx, ny = meta.ny;
    canvas.width = nx;
    canvas.height = ny;
    // خريطة الشذوذ من أداة 4 أو خريطة جليد من أداة 3
    const data: number[][] | undefined =
      iceType === "anomaly" ? precomputed?.anomaly_map : iceMaps?.[iceType];
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
  }, [iceVisible, iceType, iceOpacity, iceMaps, precomputed, meta]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-space-400 px-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between text-xs mb-2">
            <span>
              {loadNote === "cube"
                ? t("loading")
                : loadNote === "ice"
                ? ar
                  ? "تحضير خرائط الجليد ونتائج الشذوذ…"
                  : "Preparing ice maps and anomaly results…"
                : ar
                ? "قراءة بيانات المكعب…"
                : "Reading cube data…"}
            </span>
            <span className="font-mono text-space-300">{loadNote === "cube" ? `${loadPct}%` : ""}</span>
          </div>
          <div className="h-2 rounded-full bg-space-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-nebula-500 to-nebula-300 transition-all duration-200"
              style={{ width: `${loadNote === "cube" ? Math.max(loadPct, 4) : 100}%` }}
            />
          </div>
          <p className="text-[11px] text-space-500 mt-2 text-center">
            {ar
              ? "6.4 MB · 128×128×102 قناة · يُحمَّل مرة واحدة ويُخزَّن مؤقتاً في المتصفح"
              : "6.4 MB · 128×128×102 channels · downloaded once and cached by the browser"}
          </p>
        </div>
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

  const anomalyScore: number | null = (() => {
    if (selX == null || selY == null || !precomputed) return null;
    const flagged = (precomputed.flags || []).find((f: any) => f.x === selX && f.y === selY);
    if (flagged && typeof flagged.score === "number") return flagged.score;
    const m = precomputed.anomaly_map;
    if (Array.isArray(m) && m[selY] && typeof m[selY][selX] === "number") return m[selY][selX];
    return null;
  })();

  // جولة إرشادية للحكام — 4 خطوات
  const TOUR: { title: string; body: string; run: null | (() => void) }[] = [
    {
      title: ar ? "1. اختر preset «ميثان»" : "1. Pick the “Methane” preset",
      body: ar
        ? "من شريط «ألوان جاهزة» أعلى الصورة: اضغط «ميثان» لترى الغاز بألوانه (1.6 / 2.2 / 3.3 µm)."
        : "In the “Presets” row above the image, press “Methane” to see the gas in its own colors (1.6 / 2.2 / 3.3 µm).",
      run: null,
    },
    {
      title: ar ? "2. اضغط على نقطة مضيئة" : "2. Click a bright marker",
      body: ar
        ? "كل دائرة ملوّنة فوق الصورة = مرشح للرصد. اضغط واحدة لقراءة طيفها."
        : "Each colored circle on the image is a candidate. Click one to read its spectrum.",
      run: () => {
        const f = precomputed?.flags?.[0];
        if (f) handlePixelSelect(f.x, f.y);
      },
    },
    {
      title: ar ? "3. شاهد التطابق الطيفي" : "3. Check the spectral match",
      body: ar
        ? "في اللوحة اليمنى: طيف البكسل + أفضل 3 تطابقات مرجعية بنسبة التشابه."
        : "In the right panel: the pixel's spectrum plus the top-3 reference matches with similarity scores.",
      run: null,
    },
    {
      title: ar ? "4. فعّل خريطة الجليد" : "4. Turn on the ice map",
      body: ar
        ? "اضغط H₂O ~3.0 µm لإظهار خريطة الامتصاص فوق الصورة مع مفتاح الألوان."
        : "Press H₂O ~3.0 µm to overlay the absorption map on the image, with its color legend.",
      run: () => {
        setIceVisible(true);
        setIceType("H2O_ice");
      },
    },
  ];

  const goTour = (next: number) => {
    if (next >= TOUR.length) {
      setTourStep(-1);
      try {
        localStorage.setItem("blink_tour_done", "1");
      } catch {
        /* ignore */
      }
      return;
    }
    setTourStep(next);
    const step = TOUR[next];
    if (step.run) {
      try {
        step.run();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:gap-4 gap-3">
        {/* البطاقة اليسرى: العارض + التحكم */}
        <div className="flex-1 min-w-0 card border-space-800">
          <div className="p-3 border-b border-space-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-nebula-400" />
              <h2 className="font-semibold text-space-100">{ar ? "العارض الطيفي — مزج ألوان" : "Spectral Viewer — RGB blending"}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn btn-outline text-xs px-2 py-1.5" onClick={loadData}>
                <RefreshCw className="w-3 h-3" /> {ar ? "إعادة تحميل" : "Reload"}
              </button>
              <button
                className={`btn btn-outline text-xs px-2 py-1.5 ${showMarkers ? "border-nebula-500 text-nebula-300" : ""}`}
                onClick={() => setShowMarkers((v) => !v)}
                title={ar ? "علامات المرشحين الـ50 فوق الصورة" : "50 candidate markers over the image"}
              >
                <BarChart3 className="w-3 h-3" />{" "}
                {showMarkers ? (ar ? "إخفاء المرشحين" : "Hide candidates") : ar ? "إظهار المرشحين" : "Show candidates"}
              </button>
              <button className="btn btn-outline text-xs px-2 py-1.5 text-nebula-300 border-nebula-500/60" onClick={() => goTour(0)}>
                {ar ? "جولة سريعة" : "Quick tour"}
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
                markers={(precomputed?.flags || []).map((f: any) => ({ x: f.x, y: f.y, score: f.score }))}
                showMarkers={showMarkers}
                onMarkerClick={handlePixelSelect}
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
              <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-2">
                {ar ? "صائد الجليد (أداة 3)" : "Ice Hunter (tool 3)"}
              </h3>
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
                  {ar ? "إخفاء الخريطة" : "Hide map"}
                </button>
                <button
                  onClick={() => {
                    setIceVisible(true);
                    setIceType("anomaly");
                  }}
                  className={`w-full text-left px-3 py-2 rounded border rounded-lg text-sm transition ${
                    iceType === "anomaly"
                      ? "bg-nebula-500/20 border-nebula-500 text-nebula-300"
                      : "bg-space-800 border-space-800 text-space-300 hover:bg-space-700"
                  }`}
                >
                  <BarChart3 className="w-3 h-3 mr-2 inline" />
                  {ar ? "خريطة الشذوذ (أداة 4)" : "Anomaly map (tool 4)"}
                </button>
                <div className="pt-2">
                  <label className="text-[10px] text-space-500 block mb-1">{ar ? "درجة الشفافية" : "Opacity"}</label>
                  <input
                    type="range" min={0} max={1} step={0.05} value={iceOpacity}
                    onChange={(e) => setIceOpacity(parseFloat(e.target.value))}
                    className="w-full accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
                {/* Legend — مفتاح ألوان خريطة الجليد / الشذوذ */}
                {iceType && (() => {
                  const map = iceType === "anomaly" ? precomputed?.anomaly_map : iceMaps?.[iceType];
                  let maxV = 0;
                  if (Array.isArray(map)) {
                    for (let y = 0; y < map.length; y++) {
                      const row = map[y];
                      if (!Array.isArray(row)) continue;
                      for (let x = 0; x < row.length; x++) if (row[x] > maxV) maxV = row[x];
                    }
                  }
                  return (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] text-space-500 mb-1">
                        <span>
                          {iceType === "anomaly"
                            ? ar
                              ? "مقياس الشذوذ (درجة)"
                              : "Anomaly scale (score)"
                            : ar
                            ? "مفتاح الخريطة (τ)"
                            : "Map legend (τ)"}
                        </span>
                        <span className="font-mono">
                          {iceType === "anomaly" ? "anomaly" : iceType.replace("_ice", "")}
                        </span>
                      </div>
                      <div
                        className="h-2.5 rounded border border-space-700"
                        style={{ background: "linear-gradient(90deg,#800080,#a855f7,#f59e0b,#fde047)" }}
                      />
                      <div className="flex justify-between text-[9px] text-space-500 mt-0.5">
                        <span className="font-mono">0.000</span>
                        <span className="font-mono">{maxV.toFixed(3)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="mt-3 p-2 rounded bg-space-800/50 border border-space-800">
                <p className="text-[10px] text-space-400 mb-1">{ar ? "طريقة الحساب:" : "Method:"}</p>
                <p className="text-xs text-space-300">
                  {ar
                    ? "خط أساس خطي من القنوات المجاورة للخط، τ = −ln(F/contin)."
                    : "Linear continuum from channels adjacent to the line, τ = −ln(F/contin)."}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* البطاقة اليمنى: الطيف + المطابقة + الجليد القيم */}
        <div className="w-full lg:w-[390px] lg:min-w-[360px] flex flex-col gap-3">
          <SpectrumPanel
            wavelength={meta.wavelength_um}
            flux={flux}
            x={selX}
            y={selY}
            referenceSpectra={refs}
            synthetic={synthetic}
            onAnalysis={handleAnalysis}
          />
          <SpectralAssistant
            lang={lang}
            context={{
              x: selX ?? 0,
              y: selY ?? 0,
              wavelength: meta.wavelength_um as number[],
              flux,
              iceDepths: analysis?.depths ?? null,
              matches: analysis?.matches ?? null,
              anomalyScore,
              synthetic,
            }}
          />
          <div className="card p-3 border-space-800">
            <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-3">
              {ar ? "المرشحون الشاذون (أداة 4 مبدئي)" : "Anomalous candidates (tool 4 preview)"}
            </h3>
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
                <p className="text-xs text-space-500 italic">{ar ? "لا توجد مرشحون بعد." : "No candidates yet."}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 text-xs text-space-500 text-center">
        {synthetic
          ? ar
            ? "بيان اصطناعي تجريبي — للواجهة فقط، وليس قياسات حقيقية."
            : "Synthetic / demo data — for interface testing, not real measurements."
          : ar
          ? "بيان حقيقي من أرشيف NASA/IPAC IRSA."
          : "Real data from the NASA/IPAC IRSA archive."}
      </div>

      {/* جولة إرشادية */}
      {tourStep >= 0 && tourStep < TOUR.length && (
        <div className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] rounded-xl border border-nebula-500/50 bg-space-900/95 backdrop-blur p-4 shadow-2xl shadow-nebula-500/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-nebula-300">
              {ar ? "جولة سريعة" : "Quick tour"} {tourStep + 1}/{TOUR.length}
            </span>
            <button
              className="text-[11px] text-space-500 hover:text-space-300"
              onClick={() => {
                setTourStep(-1);
                try {
                  localStorage.setItem("blink_tour_done", "1");
                } catch {
                  /* ignore */
                }
              }}
            >
              {ar ? "تخطي" : "Skip"}
            </button>
          </div>
          <h4 className="text-sm font-bold text-space-100 mb-1">{TOUR[tourStep].title}</h4>
          <p className="text-xs text-space-300 leading-relaxed mb-3">{TOUR[tourStep].body}</p>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {TOUR.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === tourStep ? "bg-nebula-400" : "bg-space-700"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              {tourStep > 0 && (
                <button className="btn btn-outline text-xs px-2 py-1" onClick={() => goTour(tourStep - 1)}>
                  {ar ? "السابق" : "Back"}
                </button>
              )}
              <button className="btn btn-primary text-xs px-3 py-1" onClick={() => goTour(tourStep + 1)}>
                {tourStep === TOUR.length - 1 ? (ar ? "تم" : "Done") : ar ? "التالي" : "Next"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

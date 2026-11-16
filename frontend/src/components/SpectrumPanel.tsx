/**
 * SpectrumPanel — أداة 2 (البصمة الطيفية) وجزء من أداة 3 (الجليد).
 * يعرض طيف البكسل المختار على Plotly، يقارنه بالمرجعيات (cosine similarity)،
 * ويظهر أفضل 3 تطابقات + قياسات عمق الجليد.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Search, FlaskConical, Thermometer, Flame, AlertTriangle, Volume2, Square } from "lucide-react";
import { useLang } from "@/components/LangContext";

interface SpectrumPanelProps {
  wavelength: number[];
  flux: number[] | null;
  x: number | null;
  y: number | null;
  referenceSpectra: Record<string, number[]> | null;
  synthetic: boolean;
  onAnalysis?: (a: { matches: { name: string; sim: number }[]; depths: Record<string, number> }) => void;
}

const ICE_LINES = [
  { key: "H2O", center: 3.0, label: { ar: "H₂O جليد ~3.0 µm", en: "H₂O ice ~3.0 µm" }, color: "#22d3ee" },
  { key: "CO2", center: 4.27, label: { ar: "CO₂ جليد ~4.27 µm", en: "CO₂ ice ~4.27 µm" }, color: "#f472b6" },
  { key: "CO", center: 4.67, label: { ar: "CO جليد ~4.67 µm", en: "CO ice ~4.67 µm" }, color: "#a78bfa" },
];

function cosine(u: number[], v: number[]): number {
  let dot = 0, nu = 0, nv = 0;
  for (let i = 0; i < u.length; i++) {
    dot += u[i] * v[i];
    nu += u[i] * u[i];
    nv += v[i] * v[i];
  }
  const denom = Math.sqrt(nu) * Math.sqrt(nv);
  return denom > 0 ? dot / denom : 0;
}

function nearestIndex(wave: number[], value: number): number {
  return wave.reduce((best, w, i) => Math.abs(w - value) < Math.abs(wave[best] - value) ? i : best, 0);
}

function continuumDepth(wave: number[], flux: number[], center: number, halfWidth: number): number {
  const lIdx = wave.map((w, i) => ({ w, i })).filter(({ w }) => w > center - 2 * halfWidth && w < center - halfWidth);
  const rIdx = wave.map((w, i) => ({ w, i })).filter(({ w }) => w > center + halfWidth && w < center + 2 * halfWidth);
  if (lIdx.length < 2 || rIdx.length < 2) return 0;
  const xs = [...lIdx, ...rIdx].map(({ i }) => wave[i]);
  const ys = [...lIdx, ...rIdx].map(({ i }) => flux[i]);
  const xm = xs.reduce((a, b) => a + b, 0) / xs.length;
  const ym = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxx = 0, sxy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxx += (xs[i] - xm) ** 2;
    sxy += (xs[i] - xm) * (ys[i] - ym);
  }
  const slope = sxx > 1e-9 ? sxy / sxx : 0;
  const intercept = ym - slope * xm;
  const cont = slope * center + intercept;
  const obs = flux[nearestIndex(wave, center)] ?? 0;
  if (cont <= 0) return 0;
  const tau = -Math.log(Math.max(obs / cont, 1e-6));
  return Math.max(tau, 0);
}

export default function SpectrumPanel({
  wavelength,
  flux,
  x,
  y,
  referenceSpectra,
  synthetic,
  onAnalysis,
}: SpectrumPanelProps) {
  const { lang } = useLang();
  const ar = lang === "ar";
  const plotRef = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<{ name: string; sim: number }[]>([]);
  const [depths, setDepths] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  const [plotLoading, setPlotLoading] = useState(true);
  const audioRef = useRef<{ ctx: AudioContext; osc: OscillatorNode } | null>(null);

  const drawPlot = useCallback(async () => {
    const el = plotRef.current;
    if (!el || !flux || !wavelength) return;
    setPlotLoading(true);
    try {
      // Plotly (النسخة الأساسية: scatter فقط) تُحمَّل عند الطلب لتقليل الحزمة الأولية
      const mod: any = await import("plotly.js-basic-dist-min");
      const Plotly = mod.default ?? mod;
      if (!plotRef.current) return;
    const data = [
      {
        x: wavelength,
        y: flux,
        type: "scatter",
        mode: "lines",
        name: ar ? "الطيف المقاس" : "Measured spectrum",
        line: { color: "#6366f1", width: 2 },
      },
    ];
    const layout = {
      title: ar ? `الطيف عند البكسل (${x}, ${y})` : `Spectrum at pixel (${x}, ${y})`,
      xaxis: { title: ar ? "الطول الموجي (µm)" : "Wavelength (µm)", gridcolor: "#1e293b" },
      yaxis: { title: ar ? "الكتلة النسبية" : "Relative flux", gridcolor: "#1e293b" },
      plot_bgcolor: "#020617",
      paper_bgcolor: "#020617",
      font: { color: "#cbd5e1", family: "Tahoma, Segoe UI, sans-serif" },
      margin: { l: 50, r: 20, t: 50, b: 50 },
      hovermode: "closest",
    } as any;
      await Plotly.newPlot(plotRef.current, data, layout, { responsive: true, displayModeBar: false });
      setPlotLoading(false);
    } catch {
      setPlotLoading(false);
    }
  }, [flux, wavelength, x, y, ar]);

  useEffect(() => {
    drawPlot();
  }, [drawPlot]);

  const runMatch = useCallback(() => {
    if (!flux || !referenceSpectra) return;
    const u = flux;
    const scored = Object.entries(referenceSpectra).map(([name, spec]) => {
      if (spec.length !== u.length) return { name, sim: -2 };
      return { name, sim: cosine(u, spec) };
    });
    scored.sort((a, b) => b.sim - a.sim);
    setMatches(scored.slice(0, 3));
  }, [flux, referenceSpectra]);

  useEffect(() => {
    runMatch();
  }, [runMatch]);

  useEffect(() => {
    if (!flux || !wavelength) return;
    const d: Record<string, number> = {};
    for (const line of ICE_LINES) {
      d[line.key] = continuumDepth(wavelength, flux, line.center, 0.2);
    }
    setDepths(d);
  }, [flux, wavelength]);

  useEffect(() => {
    if (!onAnalysis) return;
    if (!flux) {
      onAnalysis({ matches: [], depths: {} });
      return;
    }
    onAnalysis({ matches, depths });
  }, [matches, depths, flux, onAnalysis]);

  /**
   * أداة 7 — Sonification: تحويل الطيف إلى صوت.
   * كل قناة طيفية = نغمة قصيرة: التردد من الطول الموجي (الأزرق أعلى)،
   * والجهارة من الكتلة النسبية. المدة الكلية ~6 ثوان.
   */
  const stopSound = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    try {
      a.osc.stop();
    } catch {
      /* already stopped */
    }
    try {
      a.ctx.close();
    } catch {
      /* ignore */
    }
    audioRef.current = null;
    setPlaying(false);
  }, []);

  const playSpectrum = useCallback(() => {
    if (playing) {
      stopSound();
      return;
    }
    if (!flux || !wavelength || flux.length < 2) return;
    const AC: typeof AudioContext =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;

    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0;

    const wMin = Math.min(...wavelength);
    const wMax = Math.max(...wavelength);
    const fMax = Math.max(...flux);
    const fMin = Math.min(...flux);
    const fRange = fMax - fMin || 1;

    const duration = 6; // ثوان
    const dt = duration / flux.length;
    const t0 = ctx.currentTime + 0.05;

    // تردد مسموع: 220–1100 هرتز (الطول الموجي الأقصر = تردد أعلى)
    for (let i = 0; i < flux.length; i++) {
      const t = t0 + i * dt;
      const wNorm = (wavelength[i] - wMin) / (wMax - wMin || 1);
      const freq = 220 + (1 - wNorm) * 880;
      const amp = 0.02 + 0.16 * ((flux[i] - fMin) / fRange);
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(amp, t);
    }

    // انتهاء سلس
    gain.gain.setValueAtTime(0, t0 + duration);

    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
    osc.onended = () => {
      audioRef.current = null;
      setPlaying(false);
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    };

    audioRef.current = { ctx, osc };
    setPlaying(true);
  }, [flux, wavelength, playing, stopSound]);

  // أوقف الصوت عند إغلاق اللوحة أو تغيير البكسل
  useEffect(() => stopSound, [stopSound, x, y]);

  return (
    <div className="card h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2 gap-2">
        <h3 className="font-semibold text-space-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-nebula-400" />{" "}
          {ar ? "البصمة الطيفية — البكسل" : "Spectral fingerprint — pixel"} ({x ?? "—"}, {y ?? "—"})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={playSpectrum}
            disabled={!flux}
            className={`btn btn-outline text-[11px] px-2.5 py-1.5 gap-1.5 ${
              playing ? "border-nebula-400 text-nebula-300" : ""
            }`}
            title={
              ar
                ? "أداة الصوت: تحويل الطيف إلى نغمات (تردد من الطول الموجي، جهارة من الكتلة)"
                : "Sonification: map wavelength to pitch and flux to loudness"
            }
            aria-pressed={playing}
          >
            {playing ? <Square className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
            {playing ? (ar ? "إيقاف الصوت" : "Stop sound") : ar ? "اسمع الطيف" : "Hear the spectrum"}
          </button>
          {synthetic && (
            <span className="badge-synthetic" title={ar ? "بيان اصطناعي لغرض التطوير" : "Synthetic data for development"}>
              {ar ? "تجريبي / اصطناعي" : "Demo / synthetic"}
            </span>
          )}
        </div>
      </div>
      {playing && (
        <p className="text-[10px] text-nebula-300 mb-2">
          {ar
            ? "يعزف 102 قناة: تردد أعلى للطول الموجي الأقصر، وجهارة أعلى للكتلة الأكبر (~6 ثوان)"
            : "Playing 102 channels: shorter wavelength = higher pitch, brighter flux = louder (~6 s)"}
        </p>
      )}

      <div className="flex-1 min-h-[300px] relative">
        <div ref={plotRef} className="w-full h-full" />
        {(plotLoading || !flux) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-space-900/60 text-space-400 text-xs gap-2 pointer-events-none">
            <div className="animate-spin w-6 h-6 border-2 border-nebula-500/30 border-t-nebula-500 rounded-full" />
            {flux
              ? ar
                ? "جارٍ تحميل مكتبة الرسم البياني…"
                : "Loading chart library…"
              : ar
              ? "اختر بكسلًا لعرض طيفه"
              : "Select a pixel to show its spectrum"}
          </div>
        )}
      </div>

      {matches.length > 0 && (
        <div className="border-t border-space-800 p-3 space-y-2">
          <p className="text-xs font-medium text-space-300 mb-1">{ar ? "أفضل 3 تطابقات (تشابه جيب التمام):" : "Top-3 matches (cosine similarity):"}</p>
          <div className="space-y-1.5">
            {matches.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-space-300">{m.name}</span>
                <span className={`font-mono text-nebula-400 ${m.sim > 0.8 ? "text-green-400" : ""}`}>
                  {(m.sim * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border-t border-space-800 p-3 space-y-2">
        <p className="text-xs font-medium text-space-300 mb-1">{ar ? "عمق الامتصاص (الجليد):" : "Absorption depth (ice):"}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ICE_LINES.map((line) => (
            <div key={line.key} className="flex items-center justify-between p-1.5 rounded bg-space-800/50 border border-space-800/50">
              <div className="flex items-center gap-2">
                <Flame className="w-3 h-3 text-space-500" style={{ color: line.color }} />
                <span className="text-xs text-space-300">{line.label[lang]}</span>
              </div>
              <span className="text-xs font-mono text-space-100">{depths[line.key]?.toFixed(3) ?? "—"} τ</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

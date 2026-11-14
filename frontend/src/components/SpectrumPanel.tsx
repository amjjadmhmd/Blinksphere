/**
 * SpectrumPanel — أداة 2 (البصمة الطيفية) وجزء من أداة 3 (الجليد).
 * يعرض طيف البكسل المختار على Plotly، يقارنه بالمرجعيات (cosine similarity)،
 * ويظهر أفضل 3 تطابقات + قياسات عمق الجليد.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import Plotly from "plotly.js-dist-min";
import { Search, Mic, FlaskConical, Thermometer, Flame, AlertTriangle } from "lucide-react";

interface SpectrumPanelProps {
  wavelength: number[];
  flux: number[] | null;
  x: number | null;
  y: number | null;
  referenceSpectra: Record<string, number[]> | null;
  synthetic: boolean;
}

const ICE_LINES = [
  { key: "H2O", center: 3.0, label: "H₂O جليد ~3.0 µm", color: "#22d3ee" },
  { key: "CO2", center: 4.27, label: "CO₂ جليد ~4.27 µm", color: "#f472b6" },
  { key: "CO", center: 4.67, label: "CO جليد ~4.67 µm", color: "#a78bfa" },
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
}: SpectrumPanelProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [matches, setMatches] = useState<{ name: string; sim: number }[]>([]);
  const [depths, setDepths] = useState<Record<string, number>>({});

  const drawPlot = useCallback(() => {
    if (!plotRef.current || !flux || !wavelength) return;
    const data = [
      {
        x: wavelength,
        y: flux,
        type: "scatter",
        mode: "lines",
        name: "الطيف المقاس",
        line: { color: "#6366f1", width: 2 },
      },
    ];
    const layout = {
      title: `الطيف عند البكسل (${x}, ${y})`,
      xaxis: { title: "الطول الموجي (µm)", gridcolor: "#1e293b" },
      yaxis: { title: "الكتلة النسبية", gridcolor: "#1e293b" },
      plot_bgcolor: "#020617",
      paper_bgcolor: "#020617",
      font: { color: "#cbd5e1", family: "Tahoma, Segoe UI, sans-serif" },
      margin: { l: 50, r: 20, t: 50, b: 50 },
      hovermode: "closest",
    } as any;
    Plotly.newPlot(plotRef.current, data, layout, { responsive: true });
  }, [flux, wavelength, x, y]);

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

  return (
    <div className="card h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-space-100 flex items-center gap-2">
          <Search className="w-4 h-4 text-nebula-400" /> البصمة الطيفية — البكسل ({x ?? "—"}, {y ?? "—"})
        </h3>
        {synthetic && (
          <span className="badge-synthetic" title="بيان اصطناعي لغرض التطوير">{synthetic ? "تجريبي / اصطناعي" : ""}</span>
        )}
      </div>

      <div className="flex-1 min-h-[300px] relative">
        <div ref={plotRef} className="w-full h-full" />
      </div>

      {matches.length > 0 && (
        <div className="border-t border-space-800 p-3 space-y-2">
          <p className="text-xs font-medium text-space-300 mb-1">أفضل 3 تطابقات (تشابه جيب التمام):</p>
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
        <p className="text-xs font-medium text-space-300 mb-1">عمق الامتصاص (الجليد):</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {ICE_LINES.map((line) => (
            <div key={line.key} className="flex items-center justify-between p-1.5 rounded bg-space-800/50 border border-space-800/50">
              <div className="flex items-center gap-2">
                <Flame className="w-3 h-3 text-space-500" style={{ color: line.color }} />
                <span className="text-xs text-space-300">{line.label}</span>
              </div>
              <span className="text-xs font-mono text-space-100">{depths[line.key]?.toFixed(3) ?? "—"} τ</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

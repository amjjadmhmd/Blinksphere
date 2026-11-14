/**
 * CanvasViewer — أداة 1: Spectral RGB Synthesizer.
 * يرسم المكعب على كانفاس باستخدام 3 قنوات يختارها المستخدم، مع تمديد percentiles/asinh ووضع النسبة (ratio).
 */

import { useEffect, useRef, useState, useCallback } from "react";
import {
  SlidersHorizontal,
  Palette,
  Image,
  Settings as SettingsIcon,
  Scissors,
  Link,
} from "lucide-react";

interface CanvasViewerProps {
  cube: Float32Array;
  nx: number;
  ny: number;
  nwave: number;
  wavelength: number[];
  onPixelSelect: (x: number, y: number) => void;
  selectedX?: number | null;
  selectedY?: number | null;
}

function percentile(sorted: Float32Array, p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const idx = (p / 100) * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function band2D(cube: Float32Array, nx: number, ny: number, nwave: number, ch: number): Float32Array {
  // المكعب مخزن بالترتيب (ny, nx, nwave) → index = (y*nx + x)*nwave + ch
  const out = new Float32Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    const row = y * nx;
    for (let x = 0; x < nx; x++) {
      out[row + x] = cube[(row + x) * nwave + ch];
    }
  }
  return out;
}

function stretchChannel(band: Float32Array, pLow: number, pHigh: number, asinhCoeff: number): Float32Array {
  const sorted = Float32Array.from(band).sort((a, b) => a - b);
  const lo = percentile(sorted, pLow);
  const hi = percentile(sorted, pHigh);
  const range = hi - lo;
  const out = new Float32Array(band.length);
  const scale = range > 1e-9 ? 1 / range : 1;
  const asinhMax = asinhCoeff > 0 ? Math.asinh(asinhCoeff) : 1;
  for (let i = 0; i < band.length; i++) {
    let v = (band[i] - lo) * scale;
    v = Math.max(0, Math.min(1, v));
    if (asinhCoeff > 0) v = Math.asinh(v * asinhCoeff) / asinhMax;
    out[i] = v;
  }
  return out;
}

export default function CanvasViewer({
  cube,
  nx,
  ny,
  nwave,
  wavelength,
  onPixelSelect,
  selectedX,
  selectedY,
}: CanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [rCh, setRCh] = useState(20);
  const [gCh, setGCh] = useState(45);
  const [bCh, setBCh] = useState(70);
  const [pLow, setPLow] = useState(1);
  const [pHigh, setPHigh] = useState(99);
  const [asinhCoeff, setAsinhCoeff] = useState(6);
  const [brightness, setBrightness] = useState(1.0);
  const [ratioMode, setRatioMode] = useState(false);
  const [ratioNum, setRatioNum] = useState(30);
  const [ratioDen, setRatioDen] = useState(40);

  const presets = [
    { label: "ميثان", channels: [28, 45, 62] as [number, number, number] }, // ~1.6, 2.2, 3.3 µm
    { label: "ماء", channels: [36, 50, 45] as [number, number, number] }, // ~1.4, 1.9, ref
    { label: "جليد", channels: [60, 78, 88] as [number, number, number] }, // ~3.0, 4.27, 4.67 µm
  ];

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const width = nx;
    const height = ny;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    let rBand: Float32Array;
    let gBand: Float32Array;
    let bBand: Float32Array;

    if (ratioMode) {
      rBand = band2D(cube, nx, ny, nwave, ratioNum);
      gBand = band2D(cube, nx, ny, nwave, ratioDen);
      bBand = new Float32Array(nx * ny);
    } else {
      rBand = band2D(cube, nx, ny, nwave, rCh);
      gBand = band2D(cube, nx, ny, nwave, gCh);
      bBand = band2D(cube, nx, ny, nwave, bCh);
    }

    const rS = stretchChannel(rBand, pLow, pHigh, asinhCoeff);
    const gS = stretchChannel(gBand, pLow, pHigh, asinhCoeff);
    const bS = stretchChannel(bBand, pLow, pHigh, asinhCoeff);

    const img = ctx.createImageData(width, height);
    const d = img.data;
    const n = width * height;
    for (let i = 0; i < n; i++) {
      let r = rS[i] * brightness;
      let g = gS[i] * brightness;
      let b = bS[i] * brightness;
      if (ratioMode) {
        const rat = Math.min(1, r);
        r = rat;
        g = rat * 0.9;
        b = rat * 0.7;
      }
      r = Math.max(0, Math.min(255, r * 255));
      g = Math.max(0, Math.min(255, g * 255));
      b = Math.max(0, Math.min(255, b * 255));
      const base = i * 4;
      d[base] = r;
      d[base + 1] = g;
      d[base + 2] = b;
      d[base + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [cube, nx, ny, nwave, rCh, gCh, bCh, pLow, pHigh, asinhCoeff, brightness, ratioMode, ratioNum, ratioDen]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) ctxRef.current = canvas.getContext("2d");
  }, []);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || selectedX == null || selectedY == null) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.save();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(selectedX, selectedY, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeRect(selectedX - 4, selectedY - 4, 8, 8);
    ctx.restore();
  }, [selectedX, selectedY]);

  const handleClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    onPixelSelect(Math.max(0, Math.min(nx - 1, x)), Math.max(0, Math.min(ny - 1, y)));
  };

  const chLabel = (ch: number) => `${wavelength[ch]?.toFixed(2) ?? "?"} µm`;

  const presetHandler = (channels: [number, number, number]) => {
    setRCh(channels[0]);
    setGCh(channels[1]);
    setBCh(channels[2]);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* شريط التحكم R/G/B */}
      <div className="flex flex-wrap gap-3 p-3 border-b border-space-800 bg-space-900/80 backdrop-blur z-10">
        <div className="flex items-center gap-2 text-xs font-medium text-space-300 uppercase tracking-wider">
          <Image className="w-3 h-3" /> قنوات R/G/B
        </div>
        {[rCh, gCh, bCh].map((ch, i) => (
          <div key={i} className="flex flex-col gap-1">
            <label className="text-[10px] text-space-500 uppercase">{["R", "G", "B"][i]}</label>
            <div className="flex items-end gap-1">
              <input
                type="range"
                min={0}
                max={nwave - 1}
                value={ch}
                onChange={(ev) => {
                  const v = Number(ev.target.value);
                  if (i === 0) setRCh(v);
                  if (i === 1) setGCh(v);
                  if (i === 2) setBCh(v);
                }}
                className="w-24 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-space-300 min-w-[40px] text-right">{chLabel(ch)}</span>
            </div>
          </div>
        ))}
        <div className="flex items-end gap-2 ml-3">
          <button
            onClick={() => setRatioMode((m) => !m)}
            className={`btn btn-outline text-xs px-2 py-1.5 ${ratioMode ? "bg-nebula-500/20 border-nebula-500 text-nebula-300" : ""}`}
          >
            <Link className="w-3 h-3 mr-1" /> نسبة
          </button>
          {ratioMode && (
            <>
              <div className="flex items-end gap-1">
                <span className="text-[10px] text-space-500">num</span>
                <input
                  type="range"
                  min={0}
                  max={nwave - 1}
                  value={ratioNum}
                  onChange={(ev) => setRatioNum(Number(ev.target.value))}
                  className="w-16 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="flex items-end gap-1">
                <span className="text-[10px] text-space-500">den</span>
                <input
                  type="range"
                  min={0}
                  max={nwave - 1}
                  value={ratioDen}
                  onChange={(ev) => setRatioDen(Number(ev.target.value))}
                  className="w-16 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </>
          )}
        </div>
        <div className="ml-auto flex items-end gap-2">
          <button
            onClick={() => presetHandler(presets[0].channels)}
            className="btn btn-outline text-xs px-2 py-1.5 gap-1"
            title="ميثان"
          >
            <Scissors className="w-3 h-3" /> ميثان
          </button>
          <button
            onClick={() => presetHandler(presets[1].channels)}
            className="btn btn-outline text-xs px-2 py-1.5 gap-1"
            title="بخار ماء"
          >
            <Palette className="w-3 h-3" /> ماء
          </button>
          <button
            onClick={() => presetHandler(presets[2].channels)}
            className="btn btn-outline text-xs px-2 py-1.5 gap-1"
            title="جليد"
          >
            <SlidersHorizontal className="w-3 h-3" /> جليد
          </button>
        </div>
      </div>

      {/* تمديد السطوع */}
      <div className="flex flex-wrap gap-3 p-3 border-b border-space-800 bg-space-900/60 backdrop-blur z-10">
        <div className="flex items-center gap-2 text-xs font-medium text-space-300 uppercase tracking-wider">
          <SettingsIcon className="w-3 h-3" /> تمديد السطوع
        </div>
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-[10px] text-space-500">percentile</span>
          <input
            type="range"
            min={0}
            max={50}
            value={pLow}
            step={1}
            onChange={(ev) => setPLow(Number(ev.target.value))}
            className="w-20 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] text-space-500 ml-1">{pLow}–{pHigh}</span>
        </div>
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-[10px] text-space-500">asinh</span>
          <input
            type="range"
            min={0}
            max={20}
            value={asinhCoeff}
            step={0.5}
            onChange={(ev) => setAsinhCoeff(Number(ev.target.value))}
            className="w-20 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] text-space-500 ml-1">×{asinhCoeff}</span>
        </div>
        <div className="flex items-center gap-2 min-w-[140px]">
          <span className="text-[10px] text-space-500">السطوع</span>
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.1}
            value={brightness}
            onChange={(ev) => setBrightness(Number(ev.target.value))}
            className="w-20 accent-nebula-500 h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-[10px] text-space-500 ml-1">{brightness.toFixed(1)}</span>
        </div>
      </div>

      {/* الكانفاس */}
      <div className="flex-1 flex items-center justify-center bg-space-800/50 rounded-xl border border-space-800 overflow-hidden relative p-1">
        <canvas
          ref={canvasRef}
          className="crisp-image w-full h-full max-w-full max-h-[60vh] object-contain"
          onClick={handleClick}
          style={{
            imageRendering: "pixelated",
            width: "100%",
            height: "auto",
            maxHeight: "60vh",
            cursor: "crosshair",
          }}
        />
        <div className="absolute bottom-2 left-2 text-[10px] text-space-500 bg-black/40 px-1.5 py-0.5 rounded">
          {nx}×{ny} بكسل
        </div>
      </div>
    </div>
  );
}

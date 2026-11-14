/**
 * SpectralAssistant — مساعد طيفي يعمل عبر Gemini خلف دالة serverless.
 * المفتاح لا يصل للمتصفح إطلاقاً: الفرونت ينادي /api/chat فقط.
 */

import { useState } from "react";
import { Sparkles, Send, Loader2, AlertTriangle, Bot } from "lucide-react";

export interface PixelContext {
  x: number;
  y: number;
  wavelength: number[];
  flux: number[] | null;
  iceDepths: Record<string, number> | null;
  matches: { name: string; sim: number }[] | null;
  anomalyScore: number | null;
  synthetic: boolean;
}

interface Msg {
  role: "user" | "model";
  text: string;
}

export default function SpectralAssistant({ context, lang }: { context: PixelContext; lang: "ar" | "en" }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ar = lang === "ar";
  const ready = context.flux && context.flux.length > 0;

  const suggestions = ar
    ? ["ليه البكسل ده شاذ؟", "إيه نوع الجليد الموجود؟", "إيه أقرب تصنيف للطيف؟"]
    : ["Why is this pixel anomalous?", "What ice species are present?", "What is the closest spectral class?"];

  const buildContext = () => {
    const wave = context.wavelength || [];
    const flux = context.flux || [];
    const step = Math.max(1, Math.floor(flux.length / 26));
    const samples: { lambda_um: number; flux: number }[] = [];
    for (let i = 0; i < flux.length; i += step) {
      samples.push({
        lambda_um: Number((wave[i] ?? 0).toFixed(3)),
        flux: Number((flux[i] ?? 0).toFixed(5)),
      });
    }
    return {
      pixel: { x: context.x, y: context.y },
      ui_language: lang,
      data_origin: context.synthetic ? "synthetic_demo" : "real_irsa",
      wavelength_range_um: wave.length ? [wave[0], wave[wave.length - 1]] : [],
      n_channels: flux.length,
      flux_samples: samples,
      ice_absorption_tau: context.iceDepths,
      top_spectral_matches: context.matches,
      anomaly_score: context.anomalyScore,
    };
  };

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    setError(null);
    const history = messages.slice(-6);
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setLoading(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history, context: buildContext() }),
      });
      const data = await r.json().catch(() => null);
      if (!r.ok || !data?.answer) {
        const msg = data?.message || data?.error || `HTTP ${r.status}`;
        setError(String(msg));
        return;
      }
      setMessages((m) => [...m, { role: "model", text: data.answer }]);
    } catch (e: any) {
      setError(e?.message || "network_error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card border-space-800 flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-space-100 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-nebula-400" />
          {ar ? "المساعد الطيفي" : "Spectral Assistant"}
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded border border-nebula-500/40 bg-nebula-500/10 text-nebula-300">
          Gemini · AI
        </span>
      </div>

      {!ready ? (
        <p className="text-xs text-space-500 italic py-4">
          {ar ? "اختر بكسلًا من الصورة أولاً ليقرأ المساعد طيفه." : "Select a pixel on the image first."}
        </p>
      ) : (
        <>
          <div className="flex-1 min-h-[120px] max-h-[260px] overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-space-400">
                  {ar
                    ? `البكسل (${context.x}, ${context.y}) جاهز — اسأل عن طيفه أو جليده أو سبب شذوذه.`
                    : `Pixel (${context.x}, ${context.y}) is ready — ask about its spectrum, ice, or anomaly score.`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="text-[11px] px-2 py-1 rounded border border-space-700 text-space-300 hover:border-nebula-500 hover:text-nebula-300 transition"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-start" : "flex justify-start"}>
                <div
                  className={`text-xs leading-relaxed rounded-lg px-2.5 py-2 max-w-[95%] whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-nebula-500/15 border border-nebula-500/30 text-space-100"
                      : "bg-space-800/60 border border-space-800 text-space-200"
                  }`}
                >
                  {m.role === "model" && <Bot className="w-3 h-3 text-nebula-400 inline mr-1" />}
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-space-400">
                <Loader2 className="w-3 h-3 animate-spin" /> {ar ? "يفكّر…" : "Thinking…"}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-[11px] text-red-300 bg-red-900/20 border border-red-800/50 rounded p-2">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <form
            className="mt-2 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={ar ? "اسأل عن هذا الطيف…" : "Ask about this spectrum…"}
              maxLength={500}
              className="input text-xs py-1.5"
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary px-2.5 py-1.5" disabled={loading || !input.trim()}>
              <Send className="w-3 h-3" />
            </button>
          </form>

          <p className="mt-1.5 text-[10px] text-space-500">
            {ar
              ? "قد يخطئ · البيانات اصطناعية والمرشحون غير مؤكدين"
              : "May be wrong · synthetic data, candidates not confirmed"}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * Mission — أداة 5: مهام المواطن العالم.
 * تصويت بشري على المرشحين الـ50 الذين رصدهم IsolationForest،
 * مع نقاط ولوحة متصدرين و«إجماع» — كلها محفوظة في هذا المتصفح فقط
 * (لا يوجد باك إند يجمع أصوات الزوار، وهذا مذكور صراحة في الواجهة).
 */

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/LangContext";
import {
  Users,
  CheckCircle,
  ThumbsDown,
  Minus,
  Trophy,
  ArrowRight,
  Crosshair,
  Info,
  Filter,
  RotateCcw,
  Target,
} from "lucide-react";

type Choice = "real" | "noise" | "unsure";
type VoteMap = Record<string, Choice>;

interface Flag {
  x: number;
  y: number;
  score: number;
}

const STORAGE_KEY = "blink_mission_votes_v1";
const POINTS: Record<Choice, number> = { real: 10, noise: 10, unsure: 5 };

const keyOf = (f: { x: number; y: number }) => `${f.x},${f.y}`;

const LABEL: Record<Choice, { ar: string; en: string }> = {
  real: { ar: "مصدر حقيقي", en: "Real source" },
  noise: { ar: "ضجيج", en: "Noise" },
  unsure: { ar: "غير متأكد", en: "Unsure" },
};

export default function MissionPage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  const { lang } = useLang();
  const ar = lang === "ar";

  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votes, setVotes] = useState<VoteMap>({});
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState<"all" | "todo" | "done">("all");

  // تحميل المرشحين الحقيقيين من نفس ملف المستكشف
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch("/data/precomputed.json");
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (!alive) return;
        const list: Flag[] = Array.isArray(j.flags) ? j.flags : [];
        setFlags(list);
      } catch (e: any) {
        if (alive) setError(e?.message || "load error");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // استرجاع التصويتات المحلية
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setVotes(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const persist = (next: VoteMap) => {
    setVotes(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const reviewed = useMemo(
    () => flags.filter((f) => votes[keyOf(f)]),
    [flags, votes]
  );

  const points = useMemo(
    () => reviewed.reduce((sum, f) => sum + (POINTS[votes[keyOf(f)]] ?? 0), 0),
    [reviewed, votes]
  );

  const counts = useMemo(() => {
    const c = { real: 0, noise: 0, unsure: 0 };
    reviewed.forEach((f) => {
      c[votes[keyOf(f)]] += 1;
    });
    return c;
  }, [reviewed, votes]);

  const visible = useMemo(() => {
    if (filter === "todo") return flags.filter((f) => !votes[keyOf(f)]);
    if (filter === "done") return flags.filter((f) => votes[keyOf(f)]);
    return flags;
  }, [flags, votes, filter]);

  const current = visible[Math.min(index, Math.max(visible.length - 1, 0))];

  const vote = (choice: Choice) => {
    if (!current) return;
    const next = { ...votes, [keyOf(current)]: choice };
    persist(next);
    // انتقل تلقائياً للمرشح التالي غير المُصوَّت عليه
    const remaining = flags.filter((f) => !next[keyOf(f)]);
    if (remaining.length > 0) {
      const nextIdx = visible.findIndex((f) => keyOf(f) === keyOf(remaining[0]));
      setIndex(nextIdx >= 0 ? nextIdx : 0);
    }
  };

  const openInExplorer = (f: Flag) => {
    try {
      localStorage.setItem("spl_selected_pixel", JSON.stringify({ x: f.x, y: f.y }));
      localStorage.setItem("blink_preset", JSON.stringify({ r: 28, g: 45, b: 62 }));
    } catch {
      /* ignore */
    }
    go("explorer");
  };

  const resetLocal = () => {
    if (!confirm(ar ? "مسح كل تصويتاتك المحلية؟" : "Clear all your local votes?")) return;
    persist({});
    setIndex(0);
  };

  const coverage = flags.length ? Math.round((reviewed.length / flags.length) * 100) : 0;
  const myVote = current ? votes[keyOf(current)] : undefined;

  const rank =
    points >= 350
      ? { ar: "خبير طيفي", en: "Spectral expert" }
      : points >= 150
      ? { ar: "مراجع نشِط", en: "Active reviewer" }
      : points >= 50
      ? { ar: "متطوّع", en: "Volunteer" }
      : { ar: "مبتدئ", en: "Newcomer" };

  return (
    <div className="px-5 md:px-6 py-8 md:py-10 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Users className="w-5 h-5 text-nebula-400" />
        <h1 className="text-2xl font-bold text-space-100">{t("navMission")}</h1>
        <span className="badge-synthetic">{t("syntheticBadge")}</span>
      </div>

      <p className="text-space-400 text-sm max-w-3xl">
        {ar
          ? "الذكاء الاصطناعي رصد 50 بكسل شاذاً في المكعب. راجع كل مرشح وقرّر: مصدر حقيقي أم ضجيج؟ كل تصويت يمنحك نقاطاً. الأصوات تُحفظ في متصفحك الآن — تجميع الإجماع بين الزوار يحتاج باك إند (خطوة قادمة)."
          : "The AI flagged 50 anomalous pixels in the cube. Review each candidate: real source or noise? Every vote earns points. Votes are stored in your browser only — cross-visitor consensus needs a backend (next step)."}
      </p>

      {/* شريط الإحصاءات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: ar ? "تمت مراجعته" : "Reviewed", value: `${reviewed.length}/${flags.length}`, icon: Target },
          { label: ar ? "نقاطك" : "Your points", value: points, icon: Trophy },
          { label: ar ? "الرتبة" : "Rank", value: rank[lang], icon: CheckCircle },
          { label: ar ? "تغطية" : "Coverage", value: `${coverage}%`, icon: Filter },
        ].map((s, i) => (
          <div key={i} className="card border-space-800 p-3">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-space-500 mb-1">
              <s.icon className="w-3 h-3" /> {s.label}
            </div>
            <div className="text-lg font-mono text-space-100">{s.value}</div>
          </div>
        ))}
      </div>

      {/* شريط التقدم */}
      <div className="h-2 rounded-full bg-space-800 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-nebula-500 to-nebula-300 transition-all"
          style={{ width: `${coverage}%` }}
        />
      </div>

      {/* تبويبات */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", ar ? `الكل (${flags.length})` : `All (${flags.length})`],
            ["todo", ar ? `غير مُراجَع (${flags.length - reviewed.length})` : `To review (${flags.length - reviewed.length})`],
            ["done", ar ? `مُراجَع (${reviewed.length})` : `Reviewed (${reviewed.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => {
              setFilter(k);
              setIndex(0);
            }}
            className={`btn text-xs px-3 py-1.5 ${
              filter === k ? "btn-primary" : "btn-outline"
            }`}
          >
            {label}
          </button>
        ))}
        {reviewed.length > 0 && (
          <button onClick={resetLocal} className="btn btn-outline text-xs px-3 py-1.5 ml-auto text-space-400">
            <RotateCcw className="w-3 h-3" /> {ar ? "مسح تصويتاتي" : "Reset my votes"}
          </button>
        )}
      </div>

      {loading && <div className="card border-space-800 p-6 text-sm text-space-400">{ar ? "جارٍ تحميل المرشحين…" : "Loading candidates…"}</div>}
      {error && (
        <div className="card border-red-800/60 p-4 text-sm text-red-300">
          {ar ? "تعذّر تحميل precomputed.json: " : "Failed to load precomputed.json: "} {error}
        </div>
      )}

      {/* بطاقة المرشح */}
      {current && (
        <div className="card border-space-800 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-nebula-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-space-300">
                {ar ? "مرشح" : "Candidate"} #{flags.findIndex((f) => keyOf(f) === keyOf(current)) + 1}/{flags.length}
              </span>
              <span className="font-mono text-xs text-space-500">
                ({current.x}, {current.y})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-space-500">{ar ? "درجة الشذوذ" : "Anomaly score"}</span>
              <div className="w-24 h-1.5 rounded bg-space-700 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-red-500"
                  style={{ width: `${Math.round(current.score * 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-space-200">{current.score.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* عرض تخطيطي للبكسل */}
            <div className="rounded-xl border border-space-800 bg-space-900/60 p-4 flex flex-col items-center justify-center min-h-[170px]">
              <div className="relative w-28 h-28 rounded-lg border border-nebula-500/30 bg-black/40 grid grid-cols-3 grid-rows-3 gap-px overflow-hidden">
                {Array.from({ length: 9 }).map((_, i) => {
                  const isCenter = i === 4;
                  return (
                    <div
                      key={i}
                      className={isCenter ? "bg-nebula-400/90" : "bg-space-800/80"}
                      title={isCenter ? `(${current.x}, ${current.y})` : undefined}
                    />
                  );
                })}
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-space-500">
                  {current.x},{current.y}
                </span>
              </div>
              <p className="text-[11px] text-space-500 mt-3 text-center">
                {ar ? "موقع المرشح داخل الحقل 128×128" : "Candidate location in the 128×128 field"}
              </p>
              <button onClick={() => openInExplorer(current)} className="btn btn-outline text-xs mt-3 px-3 py-1.5">
                <ArrowRight className="w-3 h-3" /> {ar ? "افتح في المستكشف (طيفه)" : "Open in Explorer (spectrum)"}
              </button>
            </div>

            {/* التصويت */}
            <div>
              <h3 className="font-semibold text-space-100 mb-1">
                {ar ? "هل هذا مصدر حقيقي أم ضجيج؟" : "Real source or noise?"}
              </h3>
              <p className="text-xs text-space-400 mb-4">
                {ar
                  ? "افتح المستكشف لرؤية شكله وطيفه، ثم صوّت. +10 نقاط لكل تصويت حقيقي/ضجيج، و+5 لغير متأكد."
                  : "Open Explorer to inspect its shape and spectrum, then vote. +10 points per real/noise vote, +5 for unsure."}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => vote("real")}
                  className={`btn flex-1 justify-center ${myVote === "real" ? "btn-primary" : "btn-outline"}`}
                >
                  <CheckCircle className="w-4 h-4" /> {LABEL.real[lang]} (+10)
                </button>
                <button
                  onClick={() => vote("noise")}
                  className={`btn flex-1 justify-center ${myVote === "noise" ? "btn-primary" : "btn-outline"}`}
                >
                  <ThumbsDown className="w-4 h-4" /> {LABEL.noise[lang]} (+10)
                </button>
                <button
                  onClick={() => vote("unsure")}
                  className={`btn flex-1 justify-center ${myVote === "unsure" ? "btn-primary" : "btn-outline"}`}
                >
                  <Minus className="w-4 h-4" /> {LABEL.unsure[lang]} (+5)
                </button>
              </div>

              {/* إجماع محلي على هذا المرشح */}
              <div className="mt-4 p-2.5 rounded bg-space-800/50 border border-space-800 text-[11px] text-space-400">
                <span className="text-space-300 font-medium">{ar ? "إجماع هذا المتصفح: " : "This browser's consensus: "}</span>
                {myVote ? (
                  <span className="font-mono text-nebula-300">
                    {LABEL[myVote][lang]} — 1/1
                  </span>
                ) : (
                  <span>{ar ? "لا مراجعة بعد — صوتك هو الأول" : "No review yet — your vote is the first"}</span>
                )}
              </div>
            </div>
          </div>

          {/* التنقل */}
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-space-800">
            <button
              className="btn btn-outline text-xs px-3 py-1.5"
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index <= 0}
            >
              {ar ? "السابق" : "Previous"}
            </button>
            <span className="text-[11px] text-space-500 font-mono">
              {visible.length ? Math.min(index, visible.length - 1) + 1 : 0}/{visible.length}
            </span>
            <button
              className="btn btn-outline text-xs px-3 py-1.5"
              onClick={() => setIndex((i) => Math.min(i + 1, visible.length - 1))}
              disabled={index >= visible.length - 1}
            >
              {ar ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      )}

      {!loading && !error && visible.length === 0 && (
        <div className="card border-space-800 p-6 text-sm text-space-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          {ar ? "لا يوجد مرشحون في هذا التبويب — راجعت الكل. بدّل التبويب أو امسح تصويتاتك." : "No candidates in this tab — you reviewed them all. Switch tabs or reset."}
        </div>
      )}

      {/* لوحة المتصدرين المحلية */}
      <div className="card border-space-800">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-space-100">{ar ? "لوحة المتصدرين" : "Leaderboard"}</h2>
          <span className="text-[10px] px-2 py-0.5 rounded border border-space-700 text-space-500">
            {ar ? "محلية — هذا المتصفح فقط" : "Local — this browser only"}
          </span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-space-500">
              <th className="text-right py-1.5 font-medium">{ar ? "الرتبة" : "Rank"}</th>
              <th className="text-right py-1.5 font-medium">{ar ? "اللاعب" : "Player"}</th>
              <th className="text-right py-1.5 font-medium">{ar ? "مراجعات" : "Reviews"}</th>
              <th className="text-right py-1.5 font-medium">{ar ? "نقاط" : "Points"}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-space-800">
              <td className="py-2 font-mono text-amber-300">1</td>
              <td className="py-2 text-space-200">
                {ar ? "أنت" : "You"}{" "}
                <span className="text-[10px] text-space-500">({rank[lang]})</span>
              </td>
              <td className="py-2 font-mono text-space-200">
                {reviewed.length}
                <span className="text-space-500">/{flags.length}</span>
              </td>
              <td className="py-2 font-mono text-nebula-300">{points}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {(["real", "noise", "unsure"] as Choice[]).map((c) => (
            <div key={c} className="rounded bg-space-800/50 border border-space-800 py-2">
              <div className="text-[10px] text-space-500">{LABEL[c][lang]}</div>
              <div className="font-mono text-space-100">{counts[c]}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-space-500 mt-3 flex items-start gap-1.5">
          <Info className="w-3 h-3 mt-0.5 shrink-0" />
          {ar
            ? "لا يوجد باك إند يجمع أصوات الزوار بعد، لذلك اللوحة تعرض حسابك المحلي فقط — بدون أسماء أو أرقام وهمية. تجميع الإجماع الحقيقي بين المتطوعين خطوة قادمة (مذكورة في «حول المشروع»)."
            : "There is no backend aggregating visitor votes yet, so this table shows only your local score — no fake names or numbers. Real crowd consensus is a next step (documented in About)."}
        </p>
      </div>

      <div className="text-xs text-space-500 text-center">
        {ar
          ? "المرشحون نتاج كشف شذوذ آلي (IsolationForest) وليسوا اكتشافات مؤكدة. البيانات اصطناعية للعرض."
          : "Candidates come from automated anomaly detection (IsolationForest); they are not confirmed discoveries. Data is synthetic for the demo."}
      </div>
    </div>
  );
}

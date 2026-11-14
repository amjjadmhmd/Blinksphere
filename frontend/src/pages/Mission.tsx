import { useState } from "react";
import { useLang } from "@/components/LangContext";
import { Users, Mic, CheckCircle, ThumbsDown, Minus } from "lucide-react";

export default function MissionPage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  const { lang } = useLang();
  const [vote, setVote] = useState<string | null>(null);
  const [voted, setVoted] = useState(false);

  const current = { id: "T-01", title: { ar: "هل هذا مصدر حقيقي أم ضجيج؟", en: "Real source or noise?" } };

  const handleVote = (choice: string) => {
    setVote(choice);
    setVoted(true);
    const history = JSON.parse(localStorage.getItem("spl_votes") || "[]");
    history.push({ taskId: current.id, choice, at: new Date().toISOString() });
    localStorage.setItem("spl_votes", JSON.stringify(history));
  };

  const votes = JSON.parse(localStorage.getItem("spl_votes") || "[]");

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-nebula-400" />
        <h1 className="text-2xl font-bold text-space-100">{t("navMission")}</h1>
      </div>
      <p className="text-space-400">
        الذكاء الاصطناعي يقوم بالتصفية أولاً، والمتطوع يرى المرشحين فقط ويصوّت: حقيقي أم ضجيج أم غير متأكد.
      </p>

      <div className="card border-space-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs font-medium text-space-300 uppercase tracking-wider">مهمة سريعة #{current.id}</span>
          <span className="badge-synthetic text-xs">{t("syntheticBadge")}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 rounded-xl border border-space-800 bg-space-800/40 flex items-center justify-center text-space-500">
            <Mic className="w-12 h-12 opacity-50" /> مقطوعة المصدر + طيفه
          </div>
          <div>
            <h3 className="font-semibold text-space-100 mb-2">{current.title[lang]}</h3>
            <p className="text-sm text-space-400 mb-6">راجع الصورة والطيف، ثم اختر:</p>
            <div className="flex gap-3">
              <button onClick={() => handleVote("real")} className="btn btn-primary flex-1 disabled:opacity-50" disabled={voted}>
                <CheckCircle className="w-4 h-4 mr-2" /> حقيقي
              </button>
              <button onClick={() => handleVote("noise")} className="btn btn-outline flex-1 disabled:opacity-50" disabled={voted}>
                <ThumbsDown className="w-4 h-4 mr-2" /> ضجيج
              </button>
              <button onClick={() => handleVote("unsure")} className="btn btn-outline flex-1 disabled:opacity-50" disabled={voted}>
                <Minus className="w-4 h-4 mr-2" /> غير متأكد
              </button>
            </div>
          </div>
        </div>
        {voted && (
          <div className="mt-4 p-3 rounded bg-green-900/20 border border-green-800/50">
            <CheckCircle className="w-4 h-4 text-green-400 mr-2" />
            <span className="text-sm text-green-200">تم تسجيل التصويت ({vote}). شكراً لمساهمتك!</span>
          </div>
        )}
      </div>

      <div className="card border-space-800 p-4">
        <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-3">الأصوات المسجلة (محلي)</h3>
        <div className="text-xs text-space-400">
          إجمالي الأصوات في هذا المتصفح: <span className="font-mono text-space-100">{votes.length}</span>
        </div>
      </div>
    </div>
  );
}

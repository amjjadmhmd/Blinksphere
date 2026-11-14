import { useEffect, useState } from "react";
import { useLang } from "@/components/LangContext";
import { Star, BarChart3, RefreshCw, Play, Image as ImageIcon, AlertTriangle } from "lucide-react";

export default function CandidatesPage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  const { lang } = useLang();
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data/precomputed.json")
      .then((r) => r.json())
      .then((data) => {
        const f = (data.flags || []).sort((a: any, b: any) => b.score - a.score);
        setFlags(f);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message || "فشل تحميل المرشحين");
        setLoading(false);
      });
  }, []);

  const viewPixel = (x: number, y: number) => {
    localStorage.setItem("spl_selected_pixel", JSON.stringify({ x, y }));
    go("explorer");
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-space-400">
        <Play className="w-8 h-8 animate-spin text-nebula-500 mb-3" />
        <p>جارٍ تحميل المرشحين…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-red-400 font-semibold mb-2">{t("error")}</h2>
        <p className="text-sm text-space-400 mb-4 max-w-xs">{error}</p>
        <button className="btn btn-outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-3 h-3 mr-1" /> إعادة تحميل
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-10 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-space-100">{t("navCandidates")}</h1>
          <p className="text-space-400">
            المصادر التي يكتشفها رادار الأجسام الغريبة (IsolationForest، numpy-only)، مرتبة حسب درجة الشذوذ.
            انقر على أي صف لعرض طيفه في المستكشف.
          </p>
        </div>
        <span className="badge-synthetic">{t("syntheticBadge")}</span>
      </div>

      <div className="card border-space-800 overflow-hidden">
        <div className="p-4 border-b border-space-800 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-nebula-400" />
            <span className="text-sm font-medium text-space-300">
              عدد المرشحين: <span className="text-space-100 font-mono">{flags.length}</span>
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-space-500">
            <span>الذكاء الاصطناعي يصفي ← المتطوع يراجع</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-space-800 text-xs text-space-400">
                <th className="pb-3 font-medium">#</th>
                <th className="pb-3 font-medium">الموقع (x, y)</th>
                <th className="pb-3 font-medium">الدرجة</th>
                <th className="pb-3 font-medium">النوع المتوقع</th>
                <th className="pb-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-space-800/50">
              {flags.map((f, i) => (
                <tr
                  key={i}
                  onClick={() => viewPixel(f.x, f.y)}
                  className="text-sm cursor-pointer hover:bg-space-700 transition"
                >
                  <td className="py-3 text-space-300 font-mono">#{i + 1}</td>
                  <td className="py-3 text-space-300 font-mono">({f.x}, {f.y})</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-space-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            f.score > 0.8 ? "bg-red-500" : f.score > 0.6 ? "bg-orange-500" : "bg-yellow-500"
                          }`}
                          style={{ width: `${Math.min(f.score, 1) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-space-500">{f.score.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="py-3 text-space-200">
                    {f.score > 0.8 ? "شذوذ قوي" : f.score > 0.6 ? "شذوذ متوسط" : "شذوذ ضعيف"}
                  </td>
                  <td className="py-3">
                    <button className="btn btn-outline text-xs px-2 py-1">
                      <ImageIcon className="w-3 h-3 mr-1" /> عرض الطيف
                    </button>
                  </td>
                </tr>
              ))}
              {flags.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-space-500 italic">
                    لا توجد مرشحين بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card border-space-800 p-4">
        <h3 className="text-xs font-semibold text-space-300 uppercase tracking-wider mb-3">كيف تعمل الدرجات</h3>
        <p className="text-sm text-space-400 mb-3">
          الدرجة تُحسب كأقصى انحراف معياري (Z-score) بين طيف البكسل ومتوسط الحقل الطيفي لكل قناة.
          كلما زادت الدرجة، كان المصدر أكثر غرابةً واستحقاقاً للمراجعة.
        </p>
        <div className="flex gap-4 text-xs text-space-500">
          <span><Star className="w-3 h-3 mr-1" /> أحمر = شذوذ قوي (&gt; 0.8)</span>
          <span><Star className="w-3 h-3 mr-1" /> برتقالي = متوسط (0.6–0.8)</span>
          <span><Star className="w-3 h-3 mr-1" /> أصفر = ضعيف (&lt; 0.6)</span>
        </div>
      </div>

      <div className="text-xs text-space-500 text-center">
        البيانات من public/data/precomputed.json (محسوبة مسبقاً بواسطة prepare_data.py).
      </div>
    </div>
  );
}

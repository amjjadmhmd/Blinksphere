import { useLang } from "@/components/LangContext";
import { Star, Sparkles, Droplets, AlertCircle, Image, Activity, Users } from "lucide-react";

export default function HomePage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  const { lang } = useLang();
  const feature = [
    { key: "toolRgb", icon: Image, descKey: "toolRgb", text: { ar: "اضبط 3 قنوات طيفية وألون المكعب فوراً في المتصفح.", en: "Pick any 3 of 102 spectral channels and render RGB in-browser instantly." } },
    { key: "toolMatch", icon: Activity, descKey: "toolMatch", text: { ar: "اضغط على بكسل، قارن طيفه بمكتبة مرجعية، واحصل على أفضل 3 تطابقات.", en: "Click a pixel, compare its spectrum to reference templates, get top-3 matches." } },
    { key: "toolIce", icon: Droplets, descKey: "toolIce", text: { ar: "ارسم عمق الامتصاص لجليد الماء وثاني أكسيد الكربون وأول أكسيد الكربون على الخريطة.", en: "Map absorption depth for H₂O, CO₂, and CO ice across the field." } },
    { key: "toolRadar", icon: AlertCircle, descKey: "toolRadar", text: { ar: "اكتشف المصادر الشاذة باستخدام IsolationForest وراجع المرشحين علمياً.", en: "Flag anomalous sources with IsolationForest and review candidates." } },
    { key: "toolMission", icon: Users, descKey: "toolMission", text: { ar: "صوّت على مرشحين الذكاء الاصطناعي وساهم في اتفاق الجماعة (consensus).", en: "Vote on AI-flagged candidates and help build community consensus." } },
    { key: "toolRedshift", icon: Sparkles, descKey: "toolRedshift", text: { ar: "ناسب قوالب المجرات لتقدير الانزياح الأحمر وراقب منحنى χ² مقابل z.", en: "Fit galaxy templates to estimate redshift and inspect χ² vs z." } },
  ];

  return (
    <div className="px-6 py-10 space-y-8 max-w-5xl mx-auto">
      <div className="space-y-4">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("homeTitle")}</h1>
        <p className="text-space-400 text-lg max-w-2xl">{t("homeSub")}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="badge-synthetic">{t("syntheticBadge")}</span>
          <span className="text-xs text-space-500">— البدء بالبيان الاصطناعي للواجهة، ثم الربط بالبيان الحقيقي من IRSA.</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {feature.map((f) => (
          <div key={f.key} className="card">
            <div className="w-10 h-10 rounded bg-space-800 flex items-center justify-center text-nebula-400 mb-3">
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-space-100 mb-1">{t(f.descKey)}</h3>
            <p className="text-sm text-space-400">{f.text[lang]}</p>
          </div>
        ))}
      </div>

      <div className="card border-space-700">
        <h2 className="section-title">البدء السريع</h2>
        <ol className="list-disc list-inside text-space-400 space-y-2 text-sm">
          <li>تأكد من تشغيل الباك إند: <code className="bg-space-800 px-1.5 py-0.5 rounded">uvicorn backend.app.main:app --reload</code></li>
          <li>شغّل الواجهة: <code className="bg-space-800 px-1.5 py-0.5 rounded">cd frontend && npm run dev</code></li>
          <li>افتح الصفحة الرئيسية وانتقل إلى "المستكشف".</li>
        </ol>
        <div className="mt-4 flex gap-3">
          <button className="btn btn-primary" onClick={() => go("explorer")}>
            {t("startExplorer")} <ArrowRightIcon />
          </button>
        </div>
      </div>

      <div className="text-xs text-space-500 text-center mt-8">
        NASA / IPAC IRSA — SPHEREx public data · Synthetic fallback used until real IRSA loader is connected.
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1">
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

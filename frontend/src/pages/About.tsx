import { useLang } from "@/components/LangContext";
import { BookOpen, FlaskConical, AlertTriangle, Globe } from "lucide-react";

export default function AboutPage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  return (
    <div className="px-6 py-10 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-nebula-400" />
        <h1 className="text-2xl font-bold text-space-100">{t("navAbout")}</h1>
      </div>

      <div className="card border-space-800 p-6 space-y-4">
        <h2 className="font-semibold text-space-100">مصادر البيانات</h2>
        <ul className="list-disc list-inside text-space-300 space-y-2 text-sm">
          <li>NASA/IPAC IRSA — أرشيف تلسكوب SPHEREx العام (Spectral Images / Quick Release).</li>
          <li>أطوال الموجة تُقرأ من WCS-WAVE / جدول النظر في ملف FITS (لا تُفترض قيم ثابتة).</li>
          <li>كتب مرجعية مفتوحة: SpeX Prism (الأقزام البنية)، Pickles (النجوم)، قوالب مجرات (EAZY)، أطياف جليد مفتوحة.</li>
        </ul>
        <div className="pt-2 border-t border-space-800">
          <p className="text-xs text-space-400 font-medium">الحالة الحالية:</p>
          <p className="text-sm text-space-300">الواجهة تعمل حالياً على بيان اصطناعي (fallback) مولّد بواسطة <code className="bg-space-800 px-1 rounded">scripts/prepare_data.py</code>. خط المعالجة (pipeline) جاهز لقراءة ملفات FITS الحقيقية من أرشيف IRSA عبر <code className="bg-space-800 px-1 rounded">astroquery</code> و <code className="bg-space-800 px-1 rounded">astropy</code> — يكفي تبديل مصدر البيانات دون تغيير أي كود في الواجهة.</p>
        </div>
      </div>

      <div className="card border-space-800 p-6 space-y-4">
        <h2 className="font-semibold text-space-100">الحدود العلمية</h2>
        <ul className="list-disc list-inside text-space-300 space-y-2 text-sm">
          <li>دقة الانزياح الأحمر من 102 قناة تقريبية ولا تغني عن التحليل الطيفي عالي الدقة.</li>
          <li>مطابقة البصمة تعتمد على قوالب مرجعية مبسطة (مصطنعة لو لم تتوفر المصادر المفتوحة).</li>
          <li>كشف الأجسام الشاذة (IsolationForest) يُظهر <strong>مرشحين للمراجعة فقط</strong> — وهي قائمة مرشحين وليست اكتشافات مؤكدة علمياً.</li>
        </ul>
      </div>

      <div className="card border-space-800 p-6 space-y-4">
        <h2 className="font-semibold text-space-100">أمانة البيانات (Synthetic vs Real)</h2>
        <div className="flex gap-4">
          <div className="flex-1 p-4 rounded bg-space-800 border border-space-800/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="badge-synthetic text-xs">{t("syntheticBadge")}</span>
            </div>
            <p className="text-sm text-space-300">يُستخدم في جميع الأدوات حتى الآن للسماح ببناء الواجهة واختبارها فوراً.</p>
          </div>
          <div className="flex-1 p-4 rounded bg-space-800 border border-space-800/50">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-1 rounded bg-green-900/30 text-green-300 border border-green-800">حقيقي (IRSA)</span>
            </div>
            <p className="text-sm text-space-300">سيُجلب عبر <code className="bg-space-800 px-1 rounded">astroquery.ipac.irsa</code> + خدمات SIA/TAP عند توفر النطاقات الزمنية والشبكة.</p>
          </div>
        </div>
      </div>

      <div className="text-xs text-space-500 text-center">
        NASA / IPAC IRSA · Blink Sphere · مساحة ناسا للتطبيقات
      </div>
    </div>
  );
}

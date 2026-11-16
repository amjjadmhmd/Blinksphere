import { useEffect } from "react";
import { useLang } from "@/components/LangContext";
import { Star, Sparkles, Droplets, AlertCircle, Image, Activity, Users, Play } from "lucide-react";

/**
 * بكسل الديمو: (65, 25) هو أفضل تطابق لقالب القزم البني bd_l (تشابه 1.000)
 * في المكعب الحالي — محسوب من reference_spectra.json + cube.bin.
 * preset الميثان = القنوات 28/45/62 (~1.6 / 2.2 / 3.3 µm).
 */
const DEMO_PIXEL = { x: 65, y: 25 };
const METHANE_PRESET = { r: 28, g: 45, b: 62 };

export default function HomePage({ t, go }: { t: (k: string) => string; go: (p: string) => void }) {
  const { lang } = useLang();
  const ar = lang === "ar";

  // تسخين المكعب في كاش المتصفح أثناء قراءة الحكم للصفحة الرئيسية
  // (يقلل زمن فتح المستكشف من ~6.4MB إلى صفر عند الضغط على «جرّب الديمو»)
  useEffect(() => {
    const warm = () => {
      fetch("/data/cube.bin", { cache: "force-cache" }).catch(() => {});
      fetch("/data/precomputed.json", { cache: "force-cache" }).catch(() => {});
    };
    const w = window as any;
    const id = w.requestIdleCallback ? w.requestIdleCallback(warm, { timeout: 3000 }) : window.setTimeout(warm, 2500);
    return () => {
      if (w.cancelIdleCallback && w.requestIdleCallback) w.cancelIdleCallback(id);
      else clearTimeout(id);
    };
  }, []);

  const feature = [
    { key: "toolRgb", icon: Image, text: { ar: "اضبط 3 قنوات طيفية وألون المكعب فوراً في المتصفح.", en: "Pick any 3 of 102 spectral channels and render RGB in-browser instantly." } },
    { key: "toolMatch", icon: Activity, text: { ar: "اضغط على بكسل، قارن طيفه بمكتبة مرجعية، واحصل على أفضل 3 تطابقات.", en: "Click a pixel, compare its spectrum to reference templates, get top-3 matches." } },
    { key: "toolIce", icon: Droplets, text: { ar: "ارسم عمق الامتصاص لجليد الماء وثاني أكسيد الكربون وأول أكسيد الكربون على الخريطة.", en: "Map absorption depth for H₂O, CO₂, and CO ice across the field." } },
    { key: "toolRadar", icon: AlertCircle, text: { ar: "اكتشف المصادر الشاذة بـ IsolationForest وراجع المرشحين علمياً.", en: "Flag anomalous sources with IsolationForest and review candidates." } },
    { key: "toolMission", icon: Users, text: { ar: "صوّت على مرشحين الذكاء الاصطناعي وساهم في اتفاق الجماعة (consensus).", en: "Vote on AI-flagged candidates and help build community consensus." } },
    { key: "toolRedshift", icon: Sparkles, text: { ar: "ناسب قوالب المجرات لتقدير الانزياح الأحمر وراقب منحنى χ² مقابل z.", en: "Fit galaxy templates to estimate redshift and inspect χ² vs z." } },
  ];

  const shots = [
    { src: "/img/tool1-rgb.png", titleKey: "toolRgb", cap: ar ? "مزج ثلاث قنوات (28/45/62) — preset الميثان" : "Three-channel composite (28/45/62) — methane preset" },
    { src: "/img/tool2-spectrum.png", titleKey: "toolMatch", cap: ar ? "طيف البكسل (65,25) — أقوى تطابق bd_l" : "Spectrum of pixel (65,25) — best match bd_l" },
    { src: "/img/tool3-ice.png", titleKey: "toolIce", cap: ar ? "خريطة جليد H₂O فوق صورة RGB + مفتاح τ" : "H₂O ice overlay on RGB + τ legend" },
  ];

  const startDemo = () => {
    try {
      localStorage.setItem("spl_selected_pixel", JSON.stringify(DEMO_PIXEL));
      localStorage.setItem("blink_preset", JSON.stringify(METHANE_PRESET));
    } catch {
      /* ignore */
    }
    go("explorer");
  };

  return (
    <div className="px-5 md:px-6 py-8 md:py-10 space-y-10 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-nebula-300 border border-nebula-500/40 bg-nebula-500/10 rounded-full px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-nebula-400" /> NASA Space Apps · SPHEREx
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{t("homeTitle")}</h1>
        <p className="text-space-400 text-base md:text-lg max-w-2xl">{t("homeSub")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-primary px-5 py-2.5" onClick={startDemo}>
            <Play className="w-4 h-4" /> {ar ? "جرّب الديمو" : "Try the demo"}
          </button>
          <button className="btn btn-outline px-4 py-2.5" onClick={() => go("explorer")}>
            {ar ? "افتح المستكشف" : "Open Explorer"}
          </button>
          <span className="badge-synthetic">{t("syntheticBadge")}</span>
        </div>
        <p className="text-xs text-space-500 max-w-2xl">
          {ar
            ? "الديمو يفتح المستكشف على البكسل (65, 25) — أفضل تطابق لقالب قزم بني من نوع L في المكعب الحالي — مع preset الميثان."
            : "The demo opens Explorer at pixel (65, 25) — the best match to an L-type brown-dwarf template in the current cube — with the methane preset."}
        </p>
      </div>

      {/* لقطات من الأدوات */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-space-100">{ar ? "لقطات من الأدوات" : "Screenshots from the tools"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {shots.map((s) => (
            <button
              key={s.src}
              onClick={() => go("explorer")}
              className="card border-space-800 p-2 text-left hover:border-nebula-500/60 transition group"
            >
              <img
                src={s.src}
                alt={t(s.titleKey)}
                loading="lazy"
                className="w-full aspect-square object-cover rounded-lg border border-space-800 bg-space-900 crisp-image"
              />
              <div className="px-1 pt-2">
                <p className="text-sm font-medium text-space-100 group-hover:text-nebula-300 transition">{t(s.titleKey)}</p>
                <p className="text-[11px] text-space-500">{s.cap}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-space-500">
          {ar
            ? "الصور مولّدة من المكعب نفسه داخل المتصفح (canvas.toDataURL) — ليست رسوماً توضيحية."
            : "Images are generated from the cube itself in-browser (canvas.toDataURL) — not illustrations."}
        </p>
      </div>

      {/* ما هو المشروع */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { ar: "102 قناة طيفية", en: "102 spectral channels", b: { ar: "من 0.75 إلى 5.0 ميكرون مدمجة في مكعب واحد.", en: "0.75–5.0 µm in a single cube." } },
          { ar: "مطابقة فورية", en: "Instant matching", b: { ar: "تشابه جيب التمام مع 6 قوالب مرجعية داخل المتصفح.", en: "Cosine similarity against 6 reference templates, in-browser." } },
          { ar: "جليد ومرشحون", en: "Ice & candidates", b: { ar: "عمق τ لثلاثة أنواع جليد، و50 مرشح مراجعة بشرية.", en: "τ depth for three ices, 50 candidates for human review." } },
        ].map((x, i) => (
          <div key={i} className="card border-space-800 p-4">
            <p className="text-sm font-semibold text-space-100 mb-1">{x[lang]}</p>
            <p className="text-xs text-space-400">{x.b[lang]}</p>
          </div>
        ))}
      </div>

      {/* الأدوات */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-space-100">{ar ? "الأدوات" : "Tools"}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {feature.map((f) => (
            <button key={f.key} onClick={() => go("explorer")} className="card border-space-800 text-left hover:border-nebula-500/50 transition">
              <div className="w-10 h-10 rounded bg-space-800 flex items-center justify-center text-nebula-400 mb-3">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-space-100 mb-1">{t(f.key)}</h3>
              <p className="text-sm text-space-400">{f.text[lang]}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 3 خطوات */}
      <div className="card border-space-700">
        <h2 className="section-title">{ar ? "3 خطوات للتجربة" : "3 steps to try it"}</h2>
        <ol className="text-space-400 space-y-2 text-sm list-decimal list-inside">
          <li>{ar ? "اضغط «جرّب الديمو» أو افتح المستكشف." : "Press “Try the demo” or open Explorer."}</li>
          <li>{ar ? "اضغط أي نقطة مضيئة (مرشح) فوق الصورة لقراءة طيفها." : "Click any bright marker (candidate) on the image to read its spectrum."}</li>
          <li>{ar ? "فعّل خريطة الجليد H₂O ~3.0µm، أو اسأل المساعد الطيفي عن البكسل." : "Enable the H₂O ~3.0 µm ice map, or ask the spectral assistant about the pixel."}</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={startDemo}>
            <Play className="w-4 h-4" /> {ar ? "جرّب الديمو الآن" : "Run the demo"}
          </button>
          <button className="btn btn-outline" onClick={() => go("candidates")}>
            <Star className="w-4 h-4" /> {ar ? "قائمة المرشحين (50)" : "Candidates (50)"}
          </button>
        </div>
      </div>

      <div className="text-xs text-space-500 text-center pt-2">
        {ar
          ? "البيانات الحالية اصطناعية (Synthetic / Demo) · خط المعالجة جاهز لملفات FITS الحقيقية من NASA/IPAC IRSA · المرشحون للمراجعة وليسوا اكتشافات مؤكدة."
          : "Current data is synthetic / demo · pipeline is ready for real FITS from NASA/IPAC IRSA · candidates are for review, not confirmed discoveries."}
      </div>
    </div>
  );
}

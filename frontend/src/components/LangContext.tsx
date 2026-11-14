import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "ar" | "en";

interface LangCtxType {
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: "rtl" | "ltr";
  t: (key: string) => string;
}

const LangContext = createContext<LangCtxType | null>(null);

const DICT: Record<string, Record<Lang, string>> = {
  appTitle: { ar: "SPHEREx Spectral Lab", en: "SPHEREx Spectral Lab" },
  navHome: { ar: "الرئيسية", en: "Home" },
  navExplorer: { ar: "المستكشف", en: "Explorer" },
  navCandidates: { ar: "المرشحون", en: "Candidates" },
  navMission: { ar: "مهمة سريعة", en: "Mission" },
  navAbout: { ar: "حول المشروع", en: "About" },
  langLabel: { ar: "اللغة", en: "Language" },
  homeTitle: { ar: "مرحباً بك في مختبر SPHEREx الطيفي", en: "Welcome to the SPHEREx Spectral Lab" },
  homeSub:
    { ar: "أدوات تفاعلية لاكتشاف الأجرام والجليد والأجسام الغريبة من بيانات تلسكوب SPHEREx التابعة لناسا (102 قناة طيفية، 0.75–5.0 ميكرون).", en: "Interactive tools to discover objects, ice, and weird sources from NASA SPHEREx data (102 spectral channels, 0.75–5.0 µm)." },
  toolRgb: { ar: "مُركّب ألوان طيفي (RGB)", en: "Spectral RGB Synthesizer" },
  toolMatch: { ar: "مطابق البصمة الطيفية", en: "Spectral Fingerprint Matcher" },
  toolIce: { ar: "صائد الجليد", en: "Ice Hunter Map" },
  toolRadar: { ar: "الرادار الغريب", en: "Weird Object Radar" },
  toolMission: { ar: "مهام مصغّرة جماعية", en: "Crowd Micro-Tasks" },
  toolRedshift: { ar: "تقدير الانزياح الأحمر", en: "Redshift Estimator" },
  toolSonify: { ar: "تحويل الطيف إلى صوت", en: "Spectrum Sonification" },
  startExplorer: { ar: "ابدأ الاستكشاف", en: "Start Exploring" },
  syntheticBadge: { ar: "بيان تجريبي / اصطناعي", en: "Synthetic / Demo data" },
  realBadge: { ar: "بيان حقيقي (IRSA)", en: "Real data (IRSA)" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…" },
  error: { ar: "حدث خطأ", en: "Error" },
  retry: { ar: "محاولة مرة أخرى", en: "Retry" },
};

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(localStorage.getItem("spl_lang") as Lang || "ar");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.dir = dir;
    document.documentElement.lang = lang;
    localStorage.setItem("spl_lang", lang);
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
  };

  const t = (key: string) => DICT[key]?.[lang] ?? key;

  if (!mounted) return null;

  return (
    <LangContext.Provider value={{ lang, setLang, dir: lang === "ar" ? "rtl" : "ltr", t }}>
      {children}
    </LangContext.Provider>
  );
}

export const useLang = (): LangCtxType => {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
};

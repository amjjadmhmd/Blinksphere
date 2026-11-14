import { useState } from "react";
import { useLang } from "@/components/LangContext";
import {
  Home,
  Users,
  Zap,
  Star,
  Settings,
  LayoutGrid,
  Globe,
  Moon,
  Sun,
  Menu,
  X,
  ChevronLeft,
  ArrowRight,
  AlertTriangle,
  Info,
} from "lucide-react";
import HomePage from "@/pages/Home";
import ExplorerPage from "@/pages/Explorer";
import CandidatesPage from "@/pages/Candidates";
import MissionPage from "@/pages/Mission";
import AboutPage from "@/pages/About";

type Page = "home" | "explorer" | "candidates" | "mission" | "about";

const NAV: Record<Page, { labelKey: string; icon: React.ElementType }> = {
  home: { labelKey: "navHome", icon: Home },
  explorer: { labelKey: "navExplorer", icon: LayoutGrid },
  candidates: { labelKey: "navCandidates", icon: Star },
  mission: { labelKey: "navMission", icon: Users },
  about: { labelKey: "navAbout", icon: Info },
};

export default function App() {
  const { lang, setLang, dir, t } = useLang();
  const [page, setPage] = useState<Page>("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const go = (p: Page) => {
    setPage(p);
    setMobileMenuOpen(false);
  };

  const IconMap: Record<string, React.ElementType> = {
    Home, Users, Zap, Star, Settings, LayoutGrid, Globe, Moon, Sun,
  };

  return (
    <div className="min-h-screen flex flex-col bg-space-900 text-space-100">
      {/* شريط علوي */}
      <header className="sticky top-0 z-20 border-b border-space-800 bg-space-900/90 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-nebula-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-nebula-500/30">
              B
            </div>
            <span className="font-bold text-xl tracking-tight">{t("appTitle")}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "ar" ? "en" : "ar")}
              className="btn btn-outline text-xs px-2.5 py-1.5 gap-1.5"
              title={t("langLabel")}
            >
              <Globe className="w-3 h-3" />
              <span className="hidden sm:inline">{lang === "ar" ? "EN" : "AR"}</span>
            </button>
            <button
              className="btn btn-outline p-2 text-xs hidden md:flex"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="القائمة"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* التنقل الأفقي */}
        <nav className="flex gap-1 px-5 py-2 overflow-x-auto scrollbar-hide">
          {(Object.keys(NAV) as Page[]).map((p) => {
            const active = page === p;
            const Icon = NAV[p].icon;
            return (
              <button
                key={p}
                onClick={() => go(p)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-nebula-500/10 border-nebula-500 text-nebula-300 shadow-[0_0_15px_rgba(99,102,241,0.25)]"
                    : "border-transparent text-space-400 hover:bg-space-800 hover:border-space-700 hover:text-space-100"
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? "" : "opacity-70"}`} />
                <span className={`whitespace-nowrap ${active ? "font-bold" : ""}`}>
                  {t(NAV[p].labelKey)}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 relative overflow-hidden">
        {/* شبكة خلفية خفيفة */}
        <div className="absolute inset-0 pointer-events-none z-0 [mask-image:radial-gradient(circle_80%_at_50%_50%,black_70%,transparent)]">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#334155 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
        </div>

        {page === "home" && <HomePage t={t} go={go} />}
        {page === "explorer" && <ExplorerPage t={t} go={go} />}
        {page === "candidates" && <CandidatesPage t={t} go={go} />}
        {page === "mission" && <MissionPage t={t} go={go} />}
        {page === "about" && <AboutPage t={t} go={go} />}
      </main>

      {/* قائمة الجوال المنبثقة */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-30 bg-space-900/95 backdrop-blur-md" onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute top-6 right-6">
            <button onClick={() => setMobileMenuOpen(false)} className="btn btn-outline p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="absolute top-24 right-6 w-64 space-y-2 p-3 border border-space-800 rounded-xl bg-space-900 shadow-xl">
            {(Object.keys(NAV) as Page[]).map((p) => (
              <button
                key={p}
                onClick={() => go(p)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left hover:bg-space-800 transition"
              >
                <span>{t(NAV[p].labelKey)}</span>
                {page === p ? <ChevronLeft className="w-4 h-4" dir="rtl" /> : null}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

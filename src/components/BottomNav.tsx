import { BarChart3, CalendarDays, Clock } from "lucide-react";
import { useT } from "@/lib/LanguageContext";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  isRunning?: boolean;
}

export function BottomNav({ activeTab, onTabChange, isRunning }: BottomNavProps) {
  const t = useT();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl border-t border-border safe-bottom z-50">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
        <button
          onClick={() => onTabChange("stats")}
          className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${activeTab === "stats" ? "text-primary" : "text-muted-foreground"}`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t("nav_stats")}</span>
        </button>

        {/* Center timer button */}
        <button
          onClick={() => onTabChange("timer")}
          className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 -mt-5 ${
            isRunning ? "bg-green-500 shadow-green-500/30" : "bg-primary shadow-primary/30"
          }`}
        >
          <Clock className="w-6 h-6 text-white" />
          {isRunning && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-300 border-2 border-card animate-pulse" />
          )}
        </button>

        <button
          onClick={() => onTabChange("calendar")}
          className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${activeTab === "calendar" ? "text-primary" : "text-muted-foreground"}`}
        >
          <CalendarDays className="w-5 h-5" />
          <span className="text-[10px] font-medium">{t("nav_calendar")}</span>
        </button>
      </div>
    </nav>
  );
}

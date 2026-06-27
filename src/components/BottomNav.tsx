import { Home, BookOpen, Clock, CalendarDays, User } from "lucide-react";
import { CategoryConfig, getCategoryMeta } from "@/lib/categories";
import { EventCategory } from "@/hooks/useCalendarEvents";
import { useT } from "@/lib/LanguageContext";

export type AppTab = "home" | "summary" | "timer" | "calendar" | "profile" | "estudios" | "map";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isRunning?: boolean;
  activeCategory?: EventCategory;
  categoryConfigs: CategoryConfig[];
}

const LEFT_TABS = [
  { id: "home" as AppTab, icon: Home, labelKey: "nav_home" },
  { id: "estudios" as AppTab, icon: BookOpen, labelKey: "nav_studies" },
] as const;

const RIGHT_TABS = [
  { id: "calendar" as AppTab, icon: CalendarDays, labelKey: "nav_calendar" },
  { id: "profile" as AppTab, icon: User, labelKey: "nav_settings" },
] as const;

export function BottomNav({ activeTab, onTabChange, isRunning, activeCategory = "Predi", categoryConfigs }: BottomNavProps) {
  const t = useT();
  const profileActive = activeTab === "profile" || activeTab === "map";
  const categoryMeta = getCategoryMeta(categoryConfigs, activeCategory);
  const timerButtonStyle = isRunning ? {
    background: `linear-gradient(135deg, ${categoryMeta.gradient[0]} 0%, ${categoryMeta.gradient[1]} 100%)`,
    boxShadow: `0 10px 25px ${categoryMeta.gradient[0]}40`,
  } : undefined;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center h-16 max-w-md mx-auto px-2">
        {/* Left tabs */}
        {LEFT_TABS.map(({ id, icon: Icon, labelKey }) => {
          const active = activeTab === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              aria-label={label}
            >
              <Icon className={`w-6 h-6 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`max-w-full truncate text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
              <span className={`h-1 w-1 rounded-full mt-0.5 transition-all ${active ? "bg-primary scale-100" : "scale-0"}`} />
            </button>
          );
        })}

        {/* Boton central del timer */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => onTabChange("timer")}
            aria-label={t("nav_timer")}
            className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 -mt-5 ${
              isRunning
                ? ""
                : activeTab === "timer"
                ? "bg-primary shadow-primary/30"
                : "bg-primary/90 shadow-primary/20"
            }`}
            style={timerButtonStyle}
          >
            <Clock className="w-6 h-6 text-white" />
            {isRunning && (
              <span
                className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card animate-pulse"
                style={{ backgroundColor: categoryMeta.gradient[1] }}
              />
            )}
          </button>
        </div>

        {/* Right tabs */}
        {RIGHT_TABS.map(({ id, icon: Icon, labelKey }) => {
          const active = id === "profile" ? profileActive : activeTab === id;
          const label = t(labelKey);
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors"
              aria-label={label}
            >
              <Icon className={`w-6 h-6 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`max-w-full truncate text-[11px] font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}>
                {label}
              </span>
              <span className={`h-1 w-1 rounded-full mt-0.5 transition-all ${active ? "bg-primary scale-100" : "scale-0"}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

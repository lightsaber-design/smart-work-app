import { Clock, BarChart3, Settings, MapPin, CalendarDays } from "lucide-react";
import { useT } from "@/lib/LanguageContext";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const t = useT();

  const tabs: { id: Tab; icon: typeof Clock; labelKey: string }[] = [
    { id: "timer", icon: Clock, labelKey: "nav_timer" },
    { id: "map", icon: MapPin, labelKey: "nav_map" },
    { id: "calendar", icon: CalendarDays, labelKey: "nav_calendar" },
    { id: "stats", icon: BarChart3, labelKey: "nav_stats" },
    { id: "settings", icon: Settings, labelKey: "nav_settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center gap-1 px-3 py-2 transition-colors ${
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t(labelKey)}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

import { Home, BarChart3, Clock, CalendarDays, User } from "lucide-react";

export type AppTab = "home" | "summary" | "timer" | "calendar" | "profile" | "estudios" | "map";

interface BottomNavProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  isRunning?: boolean;
}

const LEFT_TABS = [
  { id: "home" as AppTab, icon: Home, label: "Inicio" },
  { id: "summary" as AppTab, icon: BarChart3, label: "Resumen" },
] as const;

const RIGHT_TABS = [
  { id: "calendar" as AppTab, icon: CalendarDays, label: "Agenda" },
  { id: "profile" as AppTab, icon: User, label: "Perfil" },
] as const;

export function BottomNav({ activeTab, onTabChange, isRunning }: BottomNavProps) {
  const profileActive = activeTab === "profile" || activeTab === "estudios" || activeTab === "map";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
      <div className="flex items-center h-16 max-w-md mx-auto px-2">
        {/* Left tabs */}
        {LEFT_TABS.map(({ id, icon: Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex-1 flex items-center justify-center py-3 transition-colors"
            >
              <Icon className={`w-6 h-6 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
            </button>
          );
        })}

        {/* Timer — center raised button */}
        <div className="flex-1 flex justify-center">
          <button
            onClick={() => onTabChange("timer")}
            className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all active:scale-95 -mt-5 ${
              isRunning
                ? "bg-green-500 shadow-green-500/30"
                : activeTab === "timer"
                ? "bg-primary shadow-primary/30"
                : "bg-primary/90 shadow-primary/20"
            }`}
          >
            <Clock className="w-6 h-6 text-white" />
            {isRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-300 border-2 border-card animate-pulse" />
            )}
          </button>
        </div>

        {/* Right tabs */}
        {RIGHT_TABS.map(({ id, icon: Icon }) => {
          const active = id === "profile" ? profileActive : activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className="flex-1 flex items-center justify-center py-3 transition-colors"
            >
              <Icon className={`w-6 h-6 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { Clock, BarChart3, Settings } from "lucide-react";

type Tab = "timer" | "stats" | "settings";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  const tabs: { id: Tab; icon: typeof Clock; label: string }[] = [
    { id: "timer", icon: Clock, label: "Fichaje" },
    { id: "stats", icon: BarChart3, label: "Resumen" },
    { id: "settings", icon: Settings, label: "Ajustes" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-xl border-t border-border safe-bottom">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`flex flex-col items-center gap-1 px-4 py-2 transition-colors ${
              activeTab === id
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

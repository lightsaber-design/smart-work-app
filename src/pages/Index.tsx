import { useState } from "react";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { ClockButton } from "@/components/ClockButton";
import { DaySummary } from "@/components/DaySummary";
import { TimeEntryList } from "@/components/TimeEntryList";
import { BottomNav } from "@/components/BottomNav";
import { StatsView } from "@/components/StatsView";
import { SettingsView } from "@/components/SettingsView";

type Tab = "timer" | "stats" | "settings";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const tracker = useTimeTracker();

  const handleClearAll = () => {
    localStorage.removeItem("time-entries");
    window.location.reload();
  };

  const titles: Record<Tab, string> = {
    timer: "Fichaje",
    stats: "Resumen",
    settings: "Ajustes",
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">{titles[activeTab]}</h1>
      </header>

      {/* Content */}
      <main className="pb-24">
        {activeTab === "timer" && (
          <div className="space-y-6">
            <ClockButton
              isRunning={tracker.isRunning}
              elapsed={tracker.elapsed}
              onClockIn={tracker.clockIn}
              onClockOut={tracker.clockOut}
            />
            <DaySummary
              todayTotal={tracker.todayTotal}
              weekTotal={tracker.weekTotal}
              todayCount={tracker.todayEntries.length}
            />
            <TimeEntryList
              entries={tracker.todayEntries}
              onDelete={tracker.deleteEntry}
              onUpdateDescription={tracker.updateDescription}
            />
          </div>
        )}

        {activeTab === "stats" && (
          <StatsView entries={tracker.entries} weekTotal={tracker.weekTotal} />
        )}

        {activeTab === "settings" && (
          <SettingsView
            entryCount={tracker.entries.length}
            onClearAll={handleClearAll}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;

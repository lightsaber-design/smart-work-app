import { useState } from "react";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { ClockButton } from "@/components/ClockButton";
import { DaySummary } from "@/components/DaySummary";
import { TimeEntryList } from "@/components/TimeEntryList";
import { BottomNav } from "@/components/BottomNav";
import { StatsView } from "@/components/StatsView";
import { SettingsView } from "@/components/SettingsView";
import { LocationMap } from "@/components/LocationMap";
import { CalendarView } from "@/components/CalendarView";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();

  const handleClearAll = () => {
    localStorage.removeItem("time-entries");
    window.location.reload();
  };

  const titles: Record<Tab, string> = {
    timer: "Fichaje",
    map: "Mapa",
    calendar: "Calendario",
    stats: "Resumen",
    settings: "Ajustes",
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-foreground">{titles[activeTab]}</h1>
      </header>

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
              monthTotal={tracker.monthTotal}
              todayCount={tracker.todayEntries.length}
            />
            <TimeEntryList
              entries={tracker.todayEntries}
              onDelete={tracker.deleteEntry}
              onUpdateDescription={tracker.updateDescription}
            />
          </div>
        )}

        {activeTab === "map" && (
          <div className="py-4 space-y-4">
            <LocationMap entries={tracker.entries} />
          </div>
        )}

        {activeTab === "calendar" && (
          <CalendarView
            events={calendar.events}
            onAddEvent={calendar.addEvent}
            onDeleteEvent={calendar.deleteEvent}
            getEventsForDate={calendar.getEventsForDate}
          />
        )}

        {activeTab === "stats" && (
          <StatsView entries={tracker.monthEntries} monthTotal={tracker.monthTotal} calendarEvents={calendar.events} />
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

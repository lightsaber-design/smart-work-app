import { useState, useEffect } from "react";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup } from "@/hooks/useSetup";
import { ClockButton } from "@/components/ClockButton";
import { DaySummary } from "@/components/DaySummary";
import { BottomNav } from "@/components/BottomNav";
import { StatsView } from "@/components/StatsView";
import { SettingsView } from "@/components/SettingsView";
import { LocationMap } from "@/components/LocationMap";
import { CalendarView } from "@/components/CalendarView";
import { SetupScreen } from "@/components/SetupScreen";
import { LanguageProvider } from "@/lib/LanguageContext";
import { detectLanguage, Lang } from "@/lib/i18n";
import { useT } from "@/lib/LanguageContext";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings";

function AppContent() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const { setup, saveSetup } = useSetup();

  const handleClearAll = () => {
    localStorage.removeItem("time-entries");
    window.location.reload();
  };

  const activeEntry = tracker.entries.find((e) => e.endTime === null);
  const defaultCenter = setup.city ?? undefined;

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      calendar.events.forEach((event) => {
        if (event.notified || event.completed) return;
        const start = event.date.getTime();
        if (now >= start && now < start + 60_000) {
          if (!tracker.isRunning) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ Evento en curso sin fichaje", {
                body: `${event.category} — No estás fichando. ¡Inicia el fichaje!`,
                icon: "/placeholder.svg",
              });
            }
          }
          calendar.markNotified(event.id);
        }
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [calendar.events, tracker.isRunning, calendar.markNotified]);

  const titles: Record<Tab, string> = {
    timer: t('nav_timer'),
    map: t('nav_map'),
    calendar: t('nav_calendar'),
    stats: t('nav_stats'),
    settings: t('nav_settings'),
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
              onClockIn={(cat, customTime) =>
                tracker.clockIn(cat, ({ date, category, location }) =>
                  calendar.addCompletedEventNow({ date, category, location }),
                  customTime
                )
              }
              onClockOut={(customTime) =>
                tracker.clockOut((eventId, endTime) =>
                  calendar.updateEvent(eventId, { endTime }),
                  customTime
                )
              }
              onUpdateCategory={(cat) => {
                if (!activeEntry) return;
                tracker.updateCategory(activeEntry.id, cat);
                if (activeEntry.linkedEventId) {
                  calendar.updateEvent(activeEntry.linkedEventId, { category: cat });
                }
              }}
              onUpdateStartTime={(startTime) => {
                if (!activeEntry) return;
                tracker.updateStartTime(activeEntry.id, startTime);
              }}
              calendarEvents={calendar.events}
              activeCategory={activeEntry?.category}
              activeEntryId={activeEntry?.id}
              activeEntryStartTime={activeEntry?.startTime}
            />
            <DaySummary
              todayTotal={tracker.todayTotal}
              monthTotal={tracker.monthTotal}
            />
          </div>
        )}

        {activeTab === "map" && (
          <div className="py-4 space-y-4">
            <LocationMap
              entries={tracker.entries}
              favoritePlaces={favorites.places}
              onAddFavorite={favorites.addPlace}
              onDeleteFavorite={favorites.deletePlace}
              defaultCenter={defaultCenter}
            />
          </div>
        )}

        {activeTab === "calendar" && (
          <CalendarView
            events={calendar.events}
            onAddEvent={calendar.addEvent}
            onDeleteEvent={calendar.deleteEvent}
            onToggleCompleted={calendar.toggleEventCompleted}
            onUpdateEvent={calendar.updateEvent}
            getEventsForDate={calendar.getEventsForDate}
            favoritePlaces={favorites.places}
            defaultCenter={defaultCenter}
          />
        )}

        {activeTab === "stats" && (
          <StatsView entries={tracker.monthEntries} monthTotal={tracker.monthTotal} calendarEvents={calendar.events} />
        )}

        {activeTab === "settings" && (
          <SettingsView
            entryCount={tracker.entries.length}
            onClearAll={handleClearAll}
            setup={setup}
            onSaveSetup={saveSetup}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

const Index = () => {
  const { setup, completeSetup, saveSetup } = useSetup();
  const [setupLang, setSetupLang] = useState<Lang>(detectLanguage);
  const lang = setup.completed ? (setup.language ?? detectLanguage()) : setupLang;

  if (!setup.completed) {
    return (
      <LanguageProvider lang={lang}>
        <SetupScreen
          onComplete={completeSetup}
          onLangChange={setSetupLang}
        />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider lang={lang}>
      <AppContent />
    </LanguageProvider>
  );
};

export default Index;

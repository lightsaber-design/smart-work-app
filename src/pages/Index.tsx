import { useState, useEffect } from "react";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
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
import { Search, Settings } from "lucide-react";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings";

interface AppContentProps {
  setup: SetupData;
  saveSetup: (data: Partial<SetupData>) => void;
}

const CATEGORIES = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"] as const;
type Category = typeof CATEGORIES[number];

const CATEGORY_COLORS: Record<Category, { bg: string; text: string; dot: string }> = {
  Predi:   { bg: "bg-blue-100",   text: "text-blue-600",   dot: "bg-blue-500" },
  Carrito: { bg: "bg-green-100",  text: "text-green-600",  dot: "bg-green-500" },
  LDC:     { bg: "bg-purple-100", text: "text-purple-600", dot: "bg-purple-500" },
  Visitas: { bg: "bg-orange-100", text: "text-orange-600", dot: "bg-orange-500" },
  Estudio: { bg: "bg-pink-100",   text: "text-pink-600",   dot: "bg-pink-500" },
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días ☀️";
  if (h < 18) return "Buenas tardes 🌤️";
  return "Buenas noches 🌙";
}

function getWeekDates(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const offset = dow === 0 ? -6 : 1 - dow; // Monday start
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset + i);
    return d;
  });
}

function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();

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

  const userName = setup.name || setup.city?.name || "Amigo";
  const todayEvents = calendar.getEventsForDate(new Date());
  const weekDates = getWeekDates();
  const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE"];

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <main className="pb-24">
        {/* ── HOME / TIMER TAB ── */}
        {activeTab === "timer" && (
          <div className="flex flex-col gap-5">
            {/* Header */}
            <div className="px-4 pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
                  <h1 className="text-2xl font-bold text-foreground">{userName}</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </div>
              </div>
            </div>

            {/* Search */}
            <div className="px-4">
              <div className="flex items-center gap-3 bg-muted rounded-2xl px-4 py-3">
                <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground">Buscar actividad...</span>
              </div>
            </div>

            {/* Mis Actividades */}
            <div className="px-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-foreground">Mis Actividades</h2>
                <button
                  onClick={() => setActiveTab("stats")}
                  className="text-xs font-medium text-primary"
                >
                  Ver todo →
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                {CATEGORIES.map((cat) => {
                  const colors = CATEGORY_COLORS[cat];
                  const catTodayEvents = todayEvents.filter((e) => e.category === cat);
                  const totalMs = catTodayEvents.reduce((acc, e) => {
                    if (!e.endTime) return acc;
                    const [h, m] = e.endTime.split(":").map(Number);
                    const end = new Date(e.date);
                    end.setHours(h, m, 0, 0);
                    return acc + Math.max(0, end.getTime() - e.date.getTime());
                  }, 0);
                  const totalHrs = Math.floor(totalMs / 3600000);
                  const totalMins = Math.floor((totalMs % 3600000) / 60000);
                  const totalCount = calendar.events.filter((e) => e.category === cat).length;

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveTab("calendar")}
                      className="flex-shrink-0 w-40 rounded-2xl bg-card shadow-sm border border-border p-4 text-left"
                    >
                      <div
                        className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}
                      >
                        <span className={`text-sm font-bold ${colors.text}`}>
                          {cat.charAt(0)}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-foreground">{cat}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{totalCount} eventos</p>
                      {totalMs > 0 && (
                        <p className={`text-xs font-semibold ${colors.text} mt-0.5`}>
                          {totalHrs > 0 ? `${totalHrs}h ` : ""}{totalMins}m hoy
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Progreso + Timer */}
            <div className="px-4">
              <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-foreground">Progreso</h2>
                    <p className="text-xs text-muted-foreground">
                      Gestiona tu tiempo diario
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("stats")}
                    className="text-xs text-muted-foreground font-medium"
                  >
                    Estadísticas →
                  </button>
                </div>

                {/* Weekly strip */}
                <div className="flex justify-between mb-4">
                  {weekDates.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString();
                    const hasEvents = calendar.events.some(
                      (e) => e.date.toDateString() === d.toDateString()
                    );
                    return (
                      <button
                        key={i}
                        onClick={() => setActiveTab("calendar")}
                        className={`flex flex-col items-center gap-1 w-11 py-2 rounded-xl transition-colors ${
                          isToday ? "bg-primary" : "hover:bg-muted"
                        }`}
                      >
                        <span
                          className={`text-[9px] font-semibold ${
                            isToday ? "text-primary-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {DAY_NAMES[i]}
                        </span>
                        <span
                          className={`text-sm font-bold ${
                            isToday ? "text-primary-foreground" : "text-foreground"
                          }`}
                        >
                          {d.getDate()}
                        </span>
                        {hasEvents && !isToday && (
                          <span className="w-1 h-1 rounded-full bg-primary/60" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Timer */}
                <ClockButton
                  isRunning={tracker.isRunning}
                  elapsed={tracker.elapsed}
                  onClockIn={(cat, customTime) =>
                    tracker.clockIn(
                      cat,
                      ({ date, category, location }) =>
                        calendar.addCompletedEventNow({ date, category, location }),
                      customTime
                    )
                  }
                  onClockOut={(customTime) =>
                    tracker.clockOut(
                      (eventId, endTime) => calendar.updateEvent(eventId, { endTime }),
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
              </div>
            </div>

            {/* Day summary */}
            <DaySummary todayTotal={tracker.todayTotal} monthTotal={tracker.monthTotal} />
          </div>
        )}

        {/* ── MAP TAB ── */}
        {activeTab === "map" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <h1 className="text-xl font-bold text-foreground">{t("nav_map")}</h1>
            </header>
            <div className="py-4 space-y-4">
              <LocationMap
                entries={tracker.entries}
                favoritePlaces={favorites.places}
                onAddFavorite={favorites.addPlace}
                onDeleteFavorite={favorites.deletePlace}
                defaultCenter={defaultCenter}
              />
            </div>
          </>
        )}

        {/* ── CALENDAR TAB ── */}
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

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <h1 className="text-xl font-bold text-foreground">{t("nav_stats")}</h1>
            </header>
            <StatsView
              entries={tracker.monthEntries}
              monthTotal={tracker.monthTotal}
              calendarEvents={calendar.events}
            />
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <h1 className="text-xl font-bold text-foreground">{t("nav_settings")}</h1>
            </header>
            <SettingsView
              entryCount={tracker.entries.length}
              onClearAll={handleClearAll}
              setup={setup}
              onSaveSetup={saveSetup}
            />
          </>
        )}
      </main>

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isRunning={tracker.isRunning}
      />
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
        <SetupScreen onComplete={completeSetup} onLangChange={setSetupLang} />
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider lang={lang}>
      <AppContent setup={setup} saveSetup={saveSetup} />
    </LanguageProvider>
  );
};

export default Index;

import { useState, useEffect } from "react";
import { useTimeTracker, formatDuration } from "@/hooks/useTimeTracker";
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
import { ChevronUp, MapPin, Settings, Menu, BookOpen } from "lucide-react";
import { EstudiosView } from "@/components/EstudiosView";
import { useEstudios } from "@/hooks/useEstudios";

type Tab = "timer" | "map" | "calendar" | "stats" | "settings" | "estudios";

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
  const offset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + offset + i);
    return d;
  });
}

function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();

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

  const navigate = (tab: Tab) => {
    setActiveTab(tab);
    setMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <main className={activeTab === "timer" ? "" : "pb-24"}>

        {/* ── TIMER TAB ── */}
        {activeTab === "timer" && (
          <div className="h-screen flex flex-col relative pb-16 overflow-hidden">

            {/* Header */}
            <div className="px-4 pt-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => setMenuOpen(true)} className="p-1">
                    <Menu className="w-5 h-5 text-primary" />
                  </button>
                  <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none">
                  {userName.charAt(0).toUpperCase()}
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mt-1 ml-1">{userName}</h1>
            </div>

            <div className="flex-1 flex items-center justify-center px-4">
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
                estudios={estudios.contacts.filter((c) => c.active)}
                onEstudioSession={estudios.addSession}
              />
            </div>

            {/* Summary pill */}
            <button
              onClick={() => setSummaryOpen(true)}
              className="flex-shrink-0 mx-4 mb-4 flex items-center justify-between px-4 py-3 rounded-2xl bg-card border border-border shadow-sm"
            >
              <div className="flex gap-4">
                <span className="text-xs text-muted-foreground">
                  Hoy{" "}
                  <span className="font-bold text-foreground tabular-nums">
                    {formatDuration(tracker.todayTotal).slice(0, 5)}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Mes{" "}
                  <span className="font-bold text-foreground tabular-nums">
                    {formatDuration(tracker.monthTotal).slice(0, 5)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                Resumen <ChevronUp className="w-3.5 h-3.5" />
              </div>
            </button>

            {/* Backdrop */}
            <div
              className={`absolute top-0 left-0 right-0 bottom-16 z-20 bg-black/40 transition-opacity duration-300 ${
                summaryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setSummaryOpen(false)}
            />

            {/* Summary bottom sheet */}
            <div
              className={`absolute left-0 right-0 bottom-16 z-30 transition-transform duration-300 ease-out ${
                summaryOpen ? "translate-y-0" : "translate-y-full"
              }`}
            >
              <div className="bg-card rounded-t-3xl border-t border-x border-border shadow-2xl max-h-[75vh] overflow-y-auto">
                <button
                  onClick={() => setSummaryOpen(false)}
                  className="sticky top-0 w-full flex flex-col items-center pt-3 pb-2 bg-card z-10"
                >
                  <div className="w-10 h-1 rounded-full bg-border" />
                </button>
                <div className="px-4 pt-2 pb-8 space-y-5">
                  <DaySummary todayTotal={tracker.todayTotal} monthTotal={tracker.monthTotal} />

                  <div className="flex justify-between">
                    {weekDates.map((d, i) => {
                      const isToday = d.toDateString() === new Date().toDateString();
                      const hasEvents = calendar.events.some(
                        (e) => e.date.toDateString() === d.toDateString()
                      );
                      return (
                        <button
                          key={i}
                          onClick={() => { setSummaryOpen(false); setActiveTab("calendar"); }}
                          className={`flex flex-col items-center gap-1 w-11 py-2 rounded-xl transition-colors ${
                            isToday ? "bg-primary" : "hover:bg-muted"
                          }`}
                        >
                          <span className={`text-[9px] font-semibold ${isToday ? "text-primary-foreground" : "text-muted-foreground"}`}>
                            {DAY_NAMES[i]}
                          </span>
                          <span className={`text-sm font-bold ${isToday ? "text-primary-foreground" : "text-foreground"}`}>
                            {d.getDate()}
                          </span>
                          {hasEvents && !isToday && (
                            <span className="w-1 h-1 rounded-full bg-primary/60" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-bold text-foreground">Mis Actividades</h2>
                      <button
                        onClick={() => { setSummaryOpen(false); setActiveTab("stats"); }}
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
                            onClick={() => { setSummaryOpen(false); setActiveTab("calendar"); }}
                            className="flex-shrink-0 w-40 rounded-2xl bg-muted border border-border p-4 text-left"
                          >
                            <div className={`w-8 h-8 rounded-xl ${colors.bg} flex items-center justify-center mb-3`}>
                              <span className={`text-sm font-bold ${colors.text}`}>{cat.charAt(0)}</span>
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── MAP TAB ── */}
        {activeTab === "map" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_map")}</h1>
              </div>
            </header>
            <div className="py-4">
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
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_calendar")}</h1>
              </div>
            </header>
            <CalendarView
              events={calendar.events}
              onAddEvent={calendar.addEvent}
              onDeleteEvent={calendar.deleteEvent}
              onToggleCompleted={calendar.toggleEventCompleted}
              onUpdateEvent={calendar.updateEvent}
              getEventsForDate={calendar.getEventsForDate}
              favoritePlaces={favorites.places}
              defaultCenter={defaultCenter}
              estudiosContacts={estudios.contacts}
            />
          </>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === "stats" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_stats")}</h1>
              </div>
            </header>
            <StatsView
              entries={tracker.monthEntries}
              monthTotal={tracker.monthTotal}
              calendarEvents={calendar.events}
            />
          </>
        )}

        {/* ── ESTUDIOS TAB ── */}
        {activeTab === "estudios" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">Estudios</h1>
              </div>
            </header>
            <EstudiosView
              contacts={estudios.contacts}
              favoritePlaces={favorites.places}
              onAddContact={estudios.addContact}
              onUpdateContact={estudios.updateContact}
              onDeleteContact={estudios.deleteContact}
              onArchiveContact={estudios.archiveContact}
              onUnarchiveContact={estudios.unarchiveContact}
              onAddSession={estudios.addSession}
              onScheduleSession={estudios.scheduleSession}
              onGenerateScheduled={estudios.generateScheduledSessions}
              onDeleteSession={estudios.deleteSession}
              onCompleteSession={estudios.completeSession}
              onToggleActive={estudios.toggleActive}
            />
          </>
        )}

        {/* ── SETTINGS TAB ── */}
        {activeTab === "settings" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <Menu className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_settings")}</h1>
              </div>
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

      {/* Tap outside to close */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
      )}

      {/* Dropdown menu — scales in from top-left */}
      <div
        className={`fixed top-[68px] left-4 z-[70] transition-all duration-200 origin-top-left ${
          menuOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <div className="bg-card rounded-2xl shadow-xl border border-border overflow-hidden min-w-[190px]">
          <button
            onClick={() => navigate("estudios")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${
              activeTab === "estudios" ? "bg-primary/10 text-primary" : "active:bg-muted text-foreground"
            }`}
          >
            <BookOpen className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">Estudios</span>
          </button>

          <div className="h-px bg-border mx-3" />

          <button
            onClick={() => navigate("map")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${
              activeTab === "map" ? "bg-primary/10 text-primary" : "active:bg-muted text-foreground"
            }`}
          >
            <MapPin className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{t("nav_map")}</span>
          </button>

          <div className="h-px bg-border mx-3" />

          <button
            onClick={() => navigate("settings")}
            className={`w-full flex items-center gap-3 px-4 py-3.5 transition-colors text-left ${
              activeTab === "settings" ? "bg-primary/10 text-primary" : "active:bg-muted text-foreground"
            }`}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm font-medium">{t("nav_settings")}</span>
          </button>
        </div>
      </div>
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

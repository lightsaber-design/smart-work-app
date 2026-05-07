import { useState, useEffect, useRef } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents, EventCategory } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
import { ClockButton } from "@/components/ClockButton";
import { DaySummary } from "@/components/DaySummary";
import { BottomNav, AppTab } from "@/components/BottomNav";
import { StatsView } from "@/components/StatsView";
import { SettingsView } from "@/components/SettingsView";
import { LocationMap } from "@/components/LocationMap";
import { CalendarView } from "@/components/CalendarView";
import { SetupScreen } from "@/components/SetupScreen";
import { LanguageProvider } from "@/lib/LanguageContext";
import { detectLanguage, Lang } from "@/lib/i18n";
import { useT } from "@/lib/LanguageContext";
import { ChevronUp, MapPin, Settings, BookOpen, Moon, Sun } from "lucide-react";
import { EstudiosView } from "@/components/EstudiosView";
import { useEstudios } from "@/hooks/useEstudios";
import { MissedStudyBanner } from "@/components/MissedStudyBanner";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useSpecialCampaign } from "@/hooks/useSpecialCampaign";
import { CATEGORY_META, CATEGORY_STYLE } from "@/lib/categories";

type Tab = AppTab;
type Category = EventCategory;

interface AppContentProps {
  setup: SetupData;
  saveSetup: (data: Partial<SetupData>) => void;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días ☀️";
  if (h < 18) return "Buenas tardes 🌤️";
  return "Buenas noches 🌙";
}


function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
  const campaign = useSpecialCampaign();
  const { events: calendarEvents, markNotified } = calendar;

  useScrollLock(menuOpen || summaryOpen);

  const handleClearAll = () => {
    try { localStorage.removeItem("time-entries"); } catch { /* ignorar */ }
    window.location.reload();
  };

  const activeEntry = tracker.entries.find((e) => e.endTime === null);
  const defaultCenter = setup.city ?? undefined;

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      calendarEvents.forEach((event) => {
        if (event.notified || event.completed) return;
        const start = event.date.getTime();
        if (now >= start && now < start + 60_000) {
          if (!tracker.isRunning) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ Evento en curso sin fichaje", {
                body: `${event.category} — No estás fichando. ¡Inicia el fichaje!`,
              });
            }
          }
          markNotified(event.id);
        }
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [calendarEvents, tracker.isRunning, markNotified]);

  const userName = setup.name || setup.city?.name || "Amigo";

  // Today's calendar events sorted chronologically
  const todayEvents = calendar
    .getEventsForDate(new Date())
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Peek height: handle (28px) + header (44px) + up to 3 event rows (60px each) + bottom pad (12px)
  const peekEventRows = Math.min(todayEvents.length, 3);
  const peekH = todayEvents.length === 0
    ? 84                                       // handle + "Sin actividad" text
    : 28 + 44 + peekEventRows * 60 + 12;

  // Swipe-to-open/close
  const dragStartY = useRef<number | null>(null);
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  };
  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.changedTouches[0].clientY - dragStartY.current;
    dragStartY.current = null;
    if (delta < -40) setSummaryOpen(true);
    if (delta >  40) setSummaryOpen(false);
  };

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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80 flex-shrink-0"
                >
                  {userName.charAt(0).toUpperCase()}
                </button>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
                  <h1 className="text-xl font-bold text-foreground leading-tight">{userName}</h1>
                </div>
                <button
                  onClick={toggleDark}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center transition-colors active:opacity-70"
                  aria-label="Cambiar modo"
                >
                  {isDark
                    ? <Sun className="w-4 h-4 text-yellow-400" />
                    : <Moon className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
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
                entries={tracker.entries}
              />
            </div>

            {/* Backdrop */}
            <div
              className={`absolute top-0 left-0 right-0 bottom-16 z-20 bg-black/40 transition-opacity duration-300 ${
                summaryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setSummaryOpen(false)}
            />

            {/* ── Summary bottom sheet ── */}
            <div
              className="absolute left-0 right-0 bottom-16 z-30 transition-transform duration-300 ease-out"
              style={{ transform: summaryOpen ? "translateY(0)" : `translateY(calc(100% - ${peekH}px))` }}
              onTouchStart={handleSheetTouchStart}
              onTouchEnd={handleSheetTouchEnd}
            >
              <div
                className="bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.15)]"
                style={{ borderRadius: "28px 28px 0 0" }}
              >
                {/* ── Handle (tap to toggle) ── */}
                <button
                  onClick={() => setSummaryOpen((v) => !v)}
                  className="w-full flex flex-col items-center pt-3 pb-2"
                  aria-label={summaryOpen ? "Cerrar resumen" : "Abrir resumen"}
                >
                  <div className="w-10 h-1 rounded-full bg-border" />
                </button>

                {/* ── Peek: header + today's events ── */}
                <div
                  className="px-4 flex items-center justify-between mb-2 cursor-pointer"
                  onClick={() => setSummaryOpen((v) => !v)}
                >
                  <p className="text-sm font-bold text-foreground">
                    Hoy
                    {todayEvents.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        · {todayEvents.length} evento{todayEvents.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                  <ChevronUp
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${summaryOpen ? "rotate-180" : ""}`}
                  />
                </div>

                {todayEvents.length === 0 ? (
                  <p className="px-4 pb-4 text-xs text-muted-foreground">Sin actividad hoy</p>
                ) : (
                  <div className="px-4 pb-3 space-y-2">
                    {todayEvents.map((event) => {
                      const style = CATEGORY_STYLE[event.category as Category];
                      const meta  = CATEGORY_META[event.category as Category];
                      const timeStr = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
                      let duration: string | null = null;
                      if (event.endTime) {
                        const [h, m] = event.endTime.split(":").map(Number);
                        const end = new Date(event.date); end.setHours(h, m, 0, 0);
                        const diff = end.getTime() - event.date.getTime();
                        if (diff > 0) {
                          const dh = Math.floor(diff / 3_600_000);
                          const dm = Math.floor((diff % 3_600_000) / 60_000);
                          duration = dh > 0 ? `${dh}h ${dm}m` : `${dm}m`;
                        }
                      }
                      return (
                        <div
                          key={event.id}
                          className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${style.card} ${style.border}`}
                        >
                          {/* Category dot + time */}
                          <div className="flex flex-col items-center gap-0.5 w-10 flex-shrink-0">
                            <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                            <span className="text-[10px] text-muted-foreground tabular-nums">{timeStr}</span>
                          </div>
                          {/* Icon */}
                          <span className="text-xl">{meta.icon}</span>
                          {/* Name */}
                          <p className="flex-1 text-[13px] font-semibold text-foreground">{event.category}</p>
                          {/* Right side: duration or check */}
                          {event.completed
                            ? <span className="text-xs font-bold text-green-600 dark:text-green-400">✓</span>
                            : duration && <span className="text-[12px] text-muted-foreground tabular-nums">{duration}</span>
                          }
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Expanded area: totals ── */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${summaryOpen ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  <div className="h-px bg-border mx-4" />
                  <div className="px-4 pt-4 pb-8">
                    <DaySummary todayTotal={tracker.todayTotal} monthTotal={tracker.monthTotal} />
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
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80"
                >
                  {userName.charAt(0).toUpperCase()}
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
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80"
                >
                  {userName.charAt(0).toUpperCase()}
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
              precursorHours={setup.precursorHours}
              specialCampaignGoals={campaign.goals}
              onSetSpecialCampaign={campaign.setGoal}
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
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80"
                >
                  {userName.charAt(0).toUpperCase()}
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_stats")}</h1>
              </div>
            </header>
            <StatsView
              entries={tracker.monthEntries}
              allEntries={tracker.entries}
              monthTotal={tracker.monthTotal}
              calendarEvents={calendar.events}
              precursorHours={setup.precursorHours}
              specialCampaignGoals={campaign.goals}
              onSetSpecialCampaign={campaign.setGoal}
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
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80"
                >
                  {userName.charAt(0).toUpperCase()}
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
              onUpdateSession={estudios.updateSession}
              onDeleteSession={estudios.deleteSession}
              onCompleteSession={estudios.completeSession}
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
                  className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm select-none active:opacity-80"
                >
                  {userName.charAt(0).toUpperCase()}
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_settings")}</h1>
              </div>
            </header>
            <SettingsView
              entryCount={tracker.entries.length}
              onClearAll={handleClearAll}
              setup={setup}
              onSaveSetup={saveSetup}
              isDark={isDark}
              onToggleDark={toggleDark}
            />
          </>
        )}
      </main>

      <MissedStudyBanner
        contacts={estudios.contacts}
        onComplete={estudios.completeSession}
        onReschedule={estudios.updateSession}
      />

      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isRunning={tracker.isRunning}
      />

      {/* Cierra el menu al tocar fuera. */}
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

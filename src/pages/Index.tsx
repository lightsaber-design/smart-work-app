import { useState, useEffect } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTimeTracker, formatDuration } from "@/hooks/useTimeTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
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
import { ChevronUp, MapPin, Settings, BookOpen } from "lucide-react";
import { EstudiosView } from "@/components/EstudiosView";
import { useEstudios } from "@/hooks/useEstudios";
import { MissedStudyBanner } from "@/components/MissedStudyBanner";

type Tab = AppTab;

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
  const [summaryMode, setSummaryMode] = useState<"mensual" | "anual">("mensual");
  const [menuOpen, setMenuOpen] = useState(false);
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
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
                icon: "/placeholder.svg",
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
  const todayEvents = calendar.getEventsForDate(new Date());
  const weekDates = getWeekDates();
  const DAY_NAMES = ["LUN", "MAR", "MIÉ", "JUE", "VIE"];

  const PEEK_CATEGORY_META: Record<Category, { icon: string; gradient: [string, string] }> = {
    Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"] },
    Carrito: { icon: "🛒", gradient: ["#4ade80", "#34d399"] },
    LDC:     { icon: "📖", gradient: ["#c084fc", "#818cf8"] },
    Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"] },
    Estudio: { icon: "📚", gradient: ["#f472b6", "#e879f9"] },
  };

  const recentEntries = tracker.entries
    .filter((e) => e.endTime !== null)
    .slice(-3)
    .reverse();

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
                <div>
                  <p className="text-sm text-muted-foreground font-medium">{getGreeting()}</p>
                  <h1 className="text-xl font-bold text-foreground leading-tight">{userName}</h1>
                </div>
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

            {/* Summary bottom sheet — always peeks */}
            <div
              className={`absolute left-0 right-0 bottom-16 z-30 transition-transform duration-300 ease-out ${
                summaryOpen ? "translate-y-0" : "translate-y-[calc(100%-152px)]"
              }`}
            >
              <div className="relative bg-card shadow-[0_-8px_40px_rgba(0,0,0,0.12)]" style={{ borderRadius: summaryOpen ? "28px 28px 0 0" : "0" }}>

                {/* SVG concave corners — only when peeking */}
                {!summaryOpen && (
                  <svg
                    className="absolute top-0 left-0 w-full pointer-events-none z-10"
                    height="28"
                    viewBox="0 0 400 28"
                    preserveAspectRatio="none"
                  >
                    {/* top-left concave corner */}
                    <path d="M 0 0 L 28 0 Q 0 0 0 28 Z" style={{ fill: "hsl(var(--background))" }} />
                    {/* top-right concave corner */}
                    <path d="M 400 0 L 372 0 Q 400 0 400 28 Z" style={{ fill: "hsl(var(--background))" }} />
                  </svg>
                )}

                {/* ── Peek area: handle + "Última actividad" + recent entries ── */}
                <button
                  onClick={() => setSummaryOpen((v) => !v)}
                  className="w-full flex flex-col items-center pt-3 pb-0"
                >
                  <div className="w-10 h-1 rounded-full bg-border" />
                </button>
                <div
                  className="px-4 pt-3 pb-1 flex items-center justify-between cursor-pointer"
                  onClick={() => setSummaryOpen((v) => !v)}
                >
                  <h3 className="text-sm font-bold text-foreground">Última actividad</h3>
                  <ChevronUp
                    className={`w-4 h-4 text-muted-foreground transition-transform duration-300 ${summaryOpen ? "rotate-180" : ""}`}
                  />
                </div>
                <div className="px-4 pt-1 pb-3 space-y-1.5">
                  {recentEntries.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">Sin actividad reciente</p>
                  ) : (
                    recentEntries.slice(0, 2).map((entry) => {
                      if (!entry.endTime) return null;
                      const m = PEEK_CATEGORY_META[entry.category as Category];
                      const ms = Math.max(0, (entry.endTime.getTime() - entry.startTime.getTime()));
                      const hrs = Math.floor(ms / 3_600_000);
                      const mins = Math.floor((ms % 3_600_000) / 60_000);
                      const label = hrs > 0 ? `${hrs}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
                      const timeStr = `${String(entry.startTime.getHours()).padStart(2, "0")}:${String(entry.startTime.getMinutes()).padStart(2, "0")}`;
                      return (
                        <div key={entry.id} className="flex items-center gap-3 py-1">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                            style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}
                          >
                            {m.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold text-foreground">{entry.category}</p>
                            <p className="text-[11px] text-muted-foreground">{timeStr}</p>
                          </div>
                          <span className="text-[13px] font-bold text-foreground flex-shrink-0">{label}</span>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ── Divider ── */}
                <div className="h-px bg-border mx-4" />

                {/* ── Full content (visible only when expanded) ── */}
                <div className="px-4 pt-4 pb-8 space-y-5 max-h-[55vh] overflow-y-auto">
                  {/* Mode switcher */}
                  <div className="flex rounded-2xl bg-muted p-1 gap-1">
                    {(["mensual", "anual"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSummaryMode(m)}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all capitalize ${
                          summaryMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        {m === "mensual" ? "Mensual" : "Anual"}
                      </button>
                    ))}
                  </div>

                  {summaryMode === "mensual" && (() => {
                    const CATEGORY_META: Record<Category, { icon: string; gradient: [string, string] }> = {
                      Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"] },
                      Carrito: { icon: "🛒", gradient: ["#4ade80", "#34d399"] },
                      LDC:     { icon: "📖", gradient: ["#c084fc", "#818cf8"] },
                      Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"] },
                      Estudio: { icon: "📚", gradient: ["#f472b6", "#e879f9"] },
                    };
                    const now = new Date();
                    const monthEntries = tracker.entries.filter((e) =>
                      e.startTime.getFullYear() === now.getFullYear() &&
                      e.startTime.getMonth() === now.getMonth()
                    );
                    const activityRows = CATEGORIES.map((cat) => {
                      const ms = monthEntries
                        .filter((e) => e.category === cat)
                        .reduce((acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
                      return { cat, ms };
                    }).filter((r) => r.ms > 0);
                    const maxMs = Math.max(...activityRows.map((r) => r.ms), 1);
                    const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

                    return (
                      <>
                        <DaySummary todayTotal={tracker.todayTotal} monthTotal={tracker.monthTotal} />

                        <div className="flex justify-between">
                          {weekDates.map((d, i) => {
                            const isToday = d.toDateString() === new Date().toDateString();
                            const hasEvents = calendar.events.some((e) => e.date.toDateString() === d.toDateString());
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
                                {hasEvents && !isToday && <span className="w-1 h-1 rounded-full bg-primary/60" />}
                              </button>
                            );
                          })}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-foreground capitalize">{monthName}</h2>
                            <button onClick={() => { setSummaryOpen(false); setActiveTab("stats"); }} className="text-xs font-medium text-primary">
                              Ver todo →
                            </button>
                          </div>
                          {activityRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Sin actividad este mes</p>
                          ) : (
                            <div className="space-y-4">
                              {activityRows.map(({ cat, ms }) => {
                                const m = CATEGORY_META[cat];
                                const hrs = Math.floor(ms / 3_600_000);
                                const mins = Math.floor((ms % 3_600_000) / 60_000);
                                const label = hrs > 0 ? `${hrs}h` : `${mins}m`;
                                return (
                                  <div key={cat} className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                      style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}>
                                      {m.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-foreground mb-1.5">{cat}</p>
                                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(ms / maxMs) * 100}%`, background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})` }} />
                                      </div>
                                    </div>
                                    <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-8 text-right">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}

                  {summaryMode === "anual" && (() => {
                    const CATEGORY_META: Record<Category, { icon: string; gradient: [string, string] }> = {
                      Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"] },
                      Carrito: { icon: "🛒", gradient: ["#4ade80", "#34d399"] },
                      LDC:     { icon: "📖", gradient: ["#c084fc", "#818cf8"] },
                      Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"] },
                      Estudio: { icon: "📚", gradient: ["#f472b6", "#e879f9"] },
                    };
                    const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                    const now = new Date();
                    const year = now.getFullYear();
                    const yearEntries = tracker.entries.filter((e) => e.startTime.getFullYear() === year);

                    // Total anual en horas
                    const yearTotalMs = yearEntries.reduce((acc, e) =>
                      acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
                    const yearHrs = Math.floor(yearTotalMs / 3_600_000);
                    const yearMins = Math.floor((yearTotalMs % 3_600_000) / 60_000);

                    // Por mes
                    const monthBars = Array.from({ length: 12 }, (_, i) => {
                      const ms = yearEntries
                        .filter((e) => e.startTime.getMonth() === i)
                        .reduce((acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
                      return { month: i, ms };
                    });
                    const maxMonthMs = Math.max(...monthBars.map((b) => b.ms), 1);

                    // Por categoría anual
                    const catRows = CATEGORIES.map((cat) => {
                      const ms = yearEntries
                        .filter((e) => e.category === cat)
                        .reduce((acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
                      return { cat, ms };
                    }).filter((r) => r.ms > 0);
                    const maxCatMs = Math.max(...catRows.map((r) => r.ms), 1);

                    return (
                      <>
                        {/* Total anual */}
                        <div className="rounded-2xl bg-primary/10 px-4 py-4 flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground mb-0.5">Total {year}</p>
                            <p className="text-2xl font-bold text-foreground tabular-nums">
                              {yearHrs}h {yearMins}m
                            </p>
                          </div>
                          <div className="text-3xl">📅</div>
                        </div>

                        {/* Barras por mes */}
                        <div>
                          <h2 className="text-base font-bold text-foreground mb-3">Por mes</h2>
                          <div className="flex items-end gap-1.5 h-24">
                            {monthBars.map(({ month, ms }) => {
                              const isCurrentMonth = month === now.getMonth();
                              const height = ms > 0 ? Math.max(8, (ms / maxMonthMs) * 80) : 4;
                              const hrs = Math.floor(ms / 3_600_000);
                              return (
                                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                                  <div
                                    className={`w-full rounded-t-md transition-all ${isCurrentMonth ? "bg-primary" : "bg-primary/30"}`}
                                    style={{ height }}
                                    title={`${MONTH_NAMES[month]}: ${hrs}h`}
                                  />
                                  <span className={`text-[8px] font-medium ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                                    {MONTH_NAMES[month]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Por categoría */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-base font-bold text-foreground">Por actividad</h2>
                            <button onClick={() => { setSummaryOpen(false); setActiveTab("stats"); }} className="text-xs font-medium text-primary">
                              Ver todo →
                            </button>
                          </div>
                          {catRows.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">Sin actividad este año</p>
                          ) : (
                            <div className="space-y-4">
                              {catRows.map(({ cat, ms }) => {
                                const m = CATEGORY_META[cat];
                                const hrs = Math.floor(ms / 3_600_000);
                                const mins = Math.floor((ms % 3_600_000) / 60_000);
                                const label = hrs > 0 ? `${hrs}h` : `${mins}m`;
                                return (
                                  <div key={cat} className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                      style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}>
                                      {m.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[13px] font-semibold text-foreground mb-1.5">{cat}</p>
                                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                                        <div className="h-full rounded-full" style={{ width: `${(ms / maxCatMs) * 100}%`, background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})` }} />
                                      </div>
                                    </div>
                                    <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-8 text-right">{label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
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

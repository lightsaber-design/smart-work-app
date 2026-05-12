import { useState, useEffect, useRef } from "react";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents, EventCategory } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
import { ClockButton } from "@/components/ClockButton";
import { BottomNav, AppTab } from "@/components/BottomNav";
import { StatsView } from "@/components/StatsView";
import { SettingsView } from "@/components/SettingsView";
import { LocationMap } from "@/components/LocationMap";
import { CalendarView } from "@/components/CalendarView";
import { SetupScreen } from "@/components/SetupScreen";
import { LanguageProvider } from "@/lib/LanguageContext";
import { detectLanguage, Lang } from "@/lib/i18n";
import { useT } from "@/lib/LanguageContext";
import { ChevronLeft, ChevronRight, MapPin, BookOpen, Moon, Sun, Plus } from "lucide-react";
import { EstudiosView } from "@/components/EstudiosView";
import { useEstudios } from "@/hooks/useEstudios";
import { MissedStudyBanner } from "@/components/MissedStudyBanner";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useSpecialCampaign } from "@/hooks/useSpecialCampaign";
import { CATEGORY_META, CATEGORY_STYLE } from "@/lib/categories";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { removeJsonValue } from "@/lib/jsonFileStorage";
import { shouldNotifyEvent } from "@/lib/eventReminders";
import { findActiveScheduledEvent, getEventEndDate, shouldShowTimerOverrunPrompt } from "@/lib/timerOverrun";

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

function weatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [timerDisplayCategory, setTimerDisplayCategory] = useState<Category>("Predi");
  const [timerOverrunDismissedId, setTimerOverrunDismissedId] = useState<string | null>(null);
  const [timerOverrunSnoozes, setTimerOverrunSnoozes] = useState<Record<string, number>>({});
  const [timerOverrunSnoozeTime, setTimerOverrunSnoozeTime] = useState("15:00");
  const [timerOverrunNotifiedId, setTimerOverrunNotifiedId] = useState<string | null>(null);

  // Summary sheet state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDragOffset, setSummaryDragOffset] = useState<number | null>(null);
  const [summarySheetHeight, setSummarySheetHeight] = useState(0);
  const [summaryViewportHeight, setSummaryViewportHeight] = useState(
    typeof window === "undefined" ? 720 : window.innerHeight
  );
  const summarySheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartOffset = useRef(0);
  const summaryDidDrag = useRef(false);

  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
  const campaign = useSpecialCampaign();
  const { events: calendarEvents, markNotified } = calendar;
  const timerContentRef = useRef<HTMLDivElement>(null);

  const handleClearAll = () => {
    void removeJsonValue("time-entries").finally(() => window.location.reload());
  };

  const activeEntry = tracker.entries.find((e) => e.endTime === null);
  const defaultCenter = setup.city ?? undefined;
  const activeScheduledEvent = findActiveScheduledEvent(activeEntry, calendarEvents);

  const showTimerOverrunPrompt =
    tracker.isRunning &&
    activeScheduledEvent?.id !== timerOverrunDismissedId &&
    shouldShowTimerOverrunPrompt(
      new Date(),
      activeScheduledEvent,
      setup.travelTimeEnabled ? setup.travelTimeMinutes : 0,
      activeScheduledEvent ? timerOverrunSnoozes[activeScheduledEvent.id] : undefined
    );

  const stopActiveTimer = () => {
    tracker.clockOut((eventId, endTime) => calendar.updateEvent(eventId, { endTime }));
    setTimerOverrunDismissedId(activeScheduledEvent?.id ?? null);
  };

  const postponeTimerOverrunPrompt = () => {
    if (!activeScheduledEvent) return;
    const [hours, minutes] = timerOverrunSnoozeTime.split(":").map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimerOverrunSnoozes((prev) => ({ ...prev, [activeScheduledEvent.id]: next.getTime() }));
    setTimerOverrunNotifiedId(null);
  };

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      calendarEvents.forEach((event) => {
        if (shouldNotifyEvent(now, event)) {
          if (!tracker.isRunning && "Notification" in window && Notification.permission === "granted") {
            new Notification("⏰ Upcoming event", {
              body: `${event.category} starts soon. Start tracking when needed.`,
            });
          }
          markNotified(event.id);
        }
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [calendarEvents, tracker.isRunning, markNotified]);

  useEffect(() => {
    if (!showTimerOverrunPrompt || !activeScheduledEvent || timerOverrunNotifiedId === activeScheduledEvent.id) return;
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("⏰ Timer still running", {
        body: `${activeScheduledEvent.category} has passed its scheduled end time.`,
      });
    }
    setTimerOverrunNotifiedId(activeScheduledEvent.id);
  }, [activeScheduledEvent, showTimerOverrunPrompt, timerOverrunNotifiedId]);

  // Sheet drag logic
  const todayEventCount = calendar.getEventsForDate(new Date()).length;
  const [timerContentBottomY, setTimerContentBottomY] = useState(0);
  useEffect(() => {
    if (activeTab !== "timer") return;
    const measure = () => {
      setSummaryViewportHeight(window.innerHeight);
      setSummarySheetHeight(summarySheetRef.current?.offsetHeight ?? 0);
      const rect = timerContentRef.current?.getBoundingClientRect();
      setTimerContentBottomY(rect?.bottom ?? 0);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab, todayEventCount, summaryOpen]);

  const peekH = Math.round(summaryViewportHeight * 0.34);
  // Minimum offset so the sheet top never overlaps the timer content (24px clearance)
  // Sheet top at offset = (viewportH - 64 - sheetH + offset)  →  offset ≥ contentBottom + 24 - viewportH + 64 + sheetH
  const contentSafeOffset = timerContentBottomY > 0
    ? Math.max(0, timerContentBottomY + 24 - summaryViewportHeight + 64 + summarySheetHeight)
    : 0;
  const collapsedSummaryOffset = Math.max(
    Math.max(0, summarySheetHeight - peekH),
    contentSafeOffset
  );
  const restingSummaryOffset = summaryOpen ? 0 : collapsedSummaryOffset;
  const activeSummaryOffset = summaryDragOffset ?? restingSummaryOffset;
  const summaryExpanded = summaryOpen || (summaryDragOffset !== null && activeSummaryOffset < collapsedSummaryOffset - 12);

  const startDrag = (clientY: number) => {
    dragStartY.current = clientY;
    dragStartOffset.current = activeSummaryOffset;
    summaryDidDrag.current = false;
    setSummaryDragOffset(activeSummaryOffset);
  };
  const moveDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    if (Math.abs(delta) > 6) summaryDidDrag.current = true;
    setSummaryDragOffset(Math.min(collapsedSummaryOffset, Math.max(0, dragStartOffset.current + delta)));
  };
  const endDrag = (clientY: number) => {
    if (dragStartY.current === null) return;
    const delta = clientY - dragStartY.current;
    const finalOffset = Math.min(collapsedSummaryOffset, Math.max(0, dragStartOffset.current + delta));
    dragStartY.current = null;
    setSummaryOpen(finalOffset < collapsedSummaryOffset * 0.55);
    setSummaryDragOffset(null);
  };
  const toggleSummary = () => {
    if (summaryDidDrag.current) { summaryDidDrag.current = false; return; }
    setSummaryOpen((v) => !v);
  };

  const navigate = (tab: Tab) => setActiveTab(tab);
  const userName = setup.name || setup.city?.name || "Amigo";

  // Weather
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null);
  useEffect(() => {
    if (!setup.city) return;
    const { lat, lng } = setup.city;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`)
      .then((r) => r.json())
      .then((data) => {
        const cw = data?.current_weather;
        if (cw) setWeather({ temp: Math.round(cw.temperature), code: cw.weathercode });
      })
      .catch(() => {});
  }, [setup.city]);

  // Today's and upcoming events
  const todayEvents = calendar
    .getEventsForDate(new Date())
    .slice()
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const upcomingEvents = calendarEvents
    .filter((e) => e.date.getTime() > Date.now() && !e.completed)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 7);

  // Timer background gradient
  const timerCategoryMeta = CATEGORY_META[timerDisplayCategory];
  const timerBackground = `linear-gradient(160deg, ${hexToRgba(timerCategoryMeta.gradient[0], 0.55)} 0%, ${hexToRgba(timerCategoryMeta.gradient[1], 0.55)} 100%), #f8fafc`;

  // Monthly total (tracker.monthTotal is in seconds)
  const monthTotalHrs = Math.floor(tracker.monthTotal / 3600);
  const monthTotalMins = Math.floor((tracker.monthTotal % 3600) / 60);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <main className={activeTab === "timer" ? "" : "pb-24"}>

        {/* ── HOME TAB ── */}
        {activeTab === "home" && (() => {
          const homeEvents = calendarEvents
            .filter((e) => !e.completed && e.date.getTime() > Date.now() - 3_600_000)
            .sort((a, b) => a.date.getTime() - b.date.getTime())
            .slice(0, 5);
          return (
            <div className="min-h-screen bg-background pb-24">
              {/* Gradient hero */}
              <div
                className="relative px-5 pt-14 pb-20"
                style={{ background: "linear-gradient(160deg, #1e3a8a 0%, #1d4ed8 55%, #3b82f6 90%, #22c55e 100%)" }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/80 text-sm font-medium">{getGreeting()}</p>
                    <h1 className="text-3xl font-black text-white leading-tight mt-0.5">{userName},</h1>
                    {setup.city && (
                      <p className="text-white/75 text-[13px] mt-2 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                        {setup.city.name}{weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={toggleDark}
                    className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:opacity-70 backdrop-blur mt-1 flex-shrink-0"
                    aria-label="Cambiar modo"
                  >
                    {isDark ? <Sun className="w-4 h-4 text-yellow-300" /> : <Moon className="w-4 h-4 text-white" />}
                  </button>
                </div>
              </div>

              {/* Background section rounded top */}
              <div className="bg-background rounded-t-[32px] -mt-10 relative z-10 px-5 pt-5 pb-4">

                {/* Monthly hours card */}
                <div className="rounded-3xl border border-border bg-card shadow-xl p-5 mb-6">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Total del mes</p>
                  <div className="flex items-end gap-1.5 mt-1.5">
                    <span className="text-4xl font-black text-foreground leading-none">{monthTotalHrs}</span>
                    <span className="text-xl font-bold text-muted-foreground mb-0.5">h</span>
                    <span className="text-2xl font-black text-foreground leading-none ml-1">{monthTotalMins}</span>
                    <span className="text-base font-bold text-muted-foreground mb-0.5">m</span>
                  </div>
                  {setup.precursorHours && (
                    <div className="mt-3 space-y-1">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-500"
                          style={{ width: `${Math.min(100, (monthTotalHrs / setup.precursorHours) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Meta: {setup.precursorHours}h · {Math.round(Math.min(100, (monthTotalHrs / setup.precursorHours) * 100))}%
                      </p>
                    </div>
                  )}
                </div>

                {/* Upcoming events */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-foreground">Próximos eventos</h2>
                  <button
                    onClick={() => navigate("calendar")}
                    className="text-xs text-primary font-semibold flex items-center gap-0.5"
                  >
                    Ver todo <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {homeEvents.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center">
                    <p className="text-sm text-muted-foreground">Sin eventos próximos</p>
                    <button
                      onClick={() => navigate("calendar")}
                      className="mt-2 text-xs font-semibold text-primary flex items-center gap-1 mx-auto"
                    >
                      <Plus className="w-3 h-3" /> Añadir evento
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {homeEvents.map((event) => {
                      const style = CATEGORY_STYLE[event.category];
                      const meta = CATEGORY_META[event.category];
                      const isToday = event.date.toDateString() === new Date().toDateString();
                      const dateStr = isToday
                        ? "Hoy"
                        : event.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });
                      const timeStr = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
                      return (
                        <button
                          key={event.id}
                          onClick={() => navigate("calendar")}
                          className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left active:scale-[0.98] transition-transform ${style.card}`}
                          style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
                        >
                          <span className="text-xl leading-none flex-shrink-0">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{event.category}</p>
                            <p className="text-[11px] text-muted-foreground capitalize">{dateStr} · {timeStr}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        </button>
                      );
                    })}
                    <button
                      onClick={() => navigate("calendar")}
                      className="w-full flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-primary"
                    >
                      Ver más en el calendario <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* ── SUMMARY TAB ── */}
        {activeTab === "summary" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <h1 className="text-xl font-bold text-foreground">{t("nav_stats")}</h1>
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

        {/* ── TIMER TAB ── */}
        {activeTab === "timer" && (
          <div className="h-screen flex flex-col relative pb-16 overflow-hidden" style={{ background: timerBackground }}>
            {/* Header */}
            <div className="px-5 pt-5 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm text-white/70 font-medium">{getGreeting()}</p>
                  <h1 className="text-xl font-bold text-white leading-tight">{userName}</h1>
                  {setup.city && (
                    <p className="text-[11px] text-white/60">
                      {setup.city.name}{weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
                    </p>
                  )}
                </div>
                <button
                  onClick={toggleDark}
                  className="w-9 h-9 rounded-full bg-white/18 flex items-center justify-center active:opacity-70 backdrop-blur"
                  aria-label="Cambiar modo"
                >
                  {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>

            {/* Decorative blobs */}
            <div className="absolute inset-x-0 top-0 h-[58vh] overflow-hidden rounded-b-[42px] bg-[radial-gradient(circle_at_22%_8%,rgba(255,255,255,0.32),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(255,255,255,0.22),transparent_20%)] pointer-events-none" />
            <div className="absolute left-7 top-24 h-1.5 w-1.5 rounded-full bg-white/50" />
            <div className="absolute right-10 top-32 h-1 w-1 rounded-full bg-white/60" />
            <div className="absolute right-20 top-24 h-24 w-32 rounded-tl-[60px] bg-white/10 blur-sm" />

            {/* Backdrop when sheet is open */}
            <div
              className={`absolute top-0 left-0 right-0 bottom-16 z-20 bg-black/40 transition-opacity duration-300 ${
                summaryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
              }`}
              onClick={() => setSummaryOpen(false)}
            />

            {/* Draggable summary sheet */}
            <div
              ref={summarySheetRef}
              className={`absolute left-0 right-0 bottom-16 z-30 touch-none select-none ${summaryDragOffset === null ? "transition-transform duration-300 ease-out" : ""}`}
              style={{ transform: `translateY(${activeSummaryOffset}px)` }}
              onPointerDown={(e) => { startDrag(e.clientY); e.currentTarget.setPointerCapture(e.pointerId); }}
              onPointerMove={(e) => moveDrag(e.clientY)}
              onPointerUp={(e) => { endDrag(e.clientY); if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
              onPointerCancel={(e) => endDrag(e.clientY)}
            >
              <div className="h-[62vh] overflow-hidden bg-card shadow-[0_-18px_55px_rgba(15,23,42,0.18)]" style={{ borderRadius: "34px 34px 0 0" }}>
                <button onClick={toggleSummary} className="w-full flex flex-col items-center pt-3 pb-2">
                  <div className="w-10 h-1 rounded-full bg-border" />
                </button>
                <div className="px-5 flex items-center justify-between mb-2 cursor-pointer" onClick={toggleSummary}>
                  <p className="text-sm font-bold text-foreground">
                    Hoy
                    {todayEvents.length > 0 && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        · {todayEvents.length} evento{todayEvents.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </p>
                </div>

                {todayEvents.length === 0 ? (
                  <div className="px-5 pb-4 pt-1">
                    <p className="text-sm font-semibold text-foreground">Sin actividad hoy</p>
                  </div>
                ) : (
                  <div className="px-5 pb-3 space-y-2">
                    {todayEvents.map((event) => {
                      const style = CATEGORY_STYLE[event.category];
                      const meta = CATEGORY_META[event.category];
                      const timeStr = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
                      return (
                        <div key={event.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${style.card}`} style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}>
                          <span className="text-lg leading-none">{meta.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-semibold text-foreground truncate ${event.completed ? "line-through opacity-50" : ""}`}>{event.category}</p>
                            <p className="text-[10px] text-muted-foreground">{timeStr}{event.endTime ? ` – ${event.endTime}` : ""}</p>
                          </div>
                          {event.completed && <span className="text-xs font-bold text-green-500">✓</span>}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="px-5 pt-1 pb-6">
                  <button
                    onClick={() => navigate("calendar")}
                    className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20"
                  >
                    Añadir evento
                  </button>
                </div>
              </div>
            </div>

            {/* Timer content */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 pt-6">
              <div ref={timerContentRef} className="w-full flex flex-col items-center">
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
                  onDisplayCategoryChange={setTimerDisplayCategory}
                  onEstudioSession={estudios.addSession}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CALENDAR TAB ── */}
        {activeTab === "calendar" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <h1 className="text-xl font-bold text-foreground">{t("nav_calendar")}</h1>
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
              travelReminder={{
                enabled: setup.travelTimeEnabled,
                minutes: setup.travelTimeMinutes,
              }}
              specialCampaignGoals={campaign.goals}
              onSetSpecialCampaign={campaign.setGoal}
            />
          </>
        )}

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="pb-24">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Configuración</p>
                  <h1 className="text-xl font-bold text-foreground leading-tight">{userName}</h1>
                </div>
                <button
                  onClick={toggleDark}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center active:opacity-70"
                  aria-label="Cambiar modo"
                >
                  {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </header>

            {/* Quick access */}
            <div className="px-5 pt-5 mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("estudios")}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">Estudios</span>
              </button>
              <button
                onClick={() => navigate("map")}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">Mapa</span>
              </button>
            </div>

            <SettingsView
              entryCount={tracker.entries.length}
              onClearAll={handleClearAll}
              setup={setup}
              onSaveSetup={saveSetup}
              isDark={isDark}
              onToggleDark={toggleDark}
            />
          </div>
        )}

        {/* ── ESTUDIOS (sub-página desde Perfil) ── */}
        {activeTab === "estudios" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("profile")}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  aria-label="Volver"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
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

        {/* ── MAPA (sub-página desde Perfil) ── */}
        {activeTab === "map" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("profile")}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  aria-label="Volver"
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_map")}</h1>
              </div>
            </header>
            <div className="py-4 pb-24">
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
      </main>

      <MissedStudyBanner
        contacts={estudios.contacts}
        onComplete={estudios.completeSession}
        onReschedule={estudios.updateSession}
      />

      {/* Timer overrun prompt */}
      {showTimerOverrunPrompt && activeScheduledEvent && (() => {
        const end = getEventEndDate(activeScheduledEvent);
        const endLabel = end?.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) ?? "";
        return (
          <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50">
            <div className="rounded-2xl border border-amber-500/30 bg-card p-4 shadow-xl">
              <div className="mb-3">
                <p className="text-sm font-bold text-foreground">Timer still running</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeScheduledEvent.category} was scheduled to finish at {endLabel}.
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                <input
                  type="time"
                  value={timerOverrunSnoozeTime}
                  onChange={(e) => setTimerOverrunSnoozeTime(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  onClick={postponeTimerOverrunPrompt}
                  className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground"
                >
                  Postpone
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={stopActiveTimer}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Stop timer
                </button>
                <button
                  onClick={() => setTimerOverrunDismissedId(activeScheduledEvent.id)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground"
                >
                  Keep running
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      <BottomNav
        activeTab={activeTab}
        onTabChange={navigate}
        isRunning={tracker.isRunning}
      />
    </div>
  );
}

const Index = () => {
  const storage = useJsonStorageStatus();
  const { setup, loading: setupLoading, completeSetup, saveSetup } = useSetup();
  const [setupLang, setSetupLang] = useState<Lang>(detectLanguage);
  const lang = setup.completed ? (setup.language ?? detectLanguage()) : setupLang;

  if (!storage.ready || setupLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground max-w-md mx-auto flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading data...</p>
      </div>
    );
  }

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

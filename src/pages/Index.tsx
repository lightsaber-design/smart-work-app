import { lazy, Suspense, useMemo, useState, useEffect, useRef, startTransition } from "react";
import { MinistryMark } from "@/components/MinistryMark";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents, EventCategory } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
import { BottomNav, AppTab } from "@/components/BottomNav";
import { LanguageProvider, localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { detectLanguage, Lang, translate } from "@/lib/i18n";
import { ChevronLeft, BookOpen, MapPin } from "lucide-react";
import { hasActiveStudyWork, useEstudios } from "@/hooks/useEstudios";
import { MissedStudyBanner } from "@/components/MissedStudyBanner";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useSpecialCampaign } from "@/hooks/useSpecialCampaign";
import { getCategoryMeta } from "@/lib/categories";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { removeJsonValue } from "@/lib/jsonFileStorage";
import { findActiveScheduledEvent, shouldShowTimerOverrunPrompt } from "@/lib/timerOverrun";
import { clampTimeValueToHourRange } from "@/lib/activityHours";
import { formatPlaceName } from "@/lib/placeNames";
import { formatDateLong } from "@/lib/dateFormat";
import { hexToRgba, getWeatherHeroTheme } from "@/lib/weatherUtils";
import { useWeather } from "@/hooks/useWeather";
import { useNotificationEffects } from "@/hooks/useNotificationEffects";
import { HomeTab } from "@/pages/tabs/HomeTab";
import { TimerTab } from "@/pages/tabs/TimerTab";
import { TimerOverrunPrompt } from "@/pages/tabs/TimerOverrunPrompt";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const StatsView = lazy(() => import("@/components/StatsView").then((m) => ({ default: m.StatsView })));
const CalendarView = lazy(() => import("@/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const EstudiosView = lazy(() => import("@/components/EstudiosView").then((m) => ({ default: m.EstudiosView })));
const LocationMap = lazy(() => import("@/components/LocationMap").then((m) => ({ default: m.LocationMap })));
const SettingsView = lazy(() => import("@/components/SettingsView").then((m) => ({ default: m.SettingsView })));
const SetupScreen = lazy(() => import("@/components/SetupScreen").then((m) => ({ default: m.SetupScreen })));

type Tab = AppTab;
type Category = EventCategory;
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

const SHORT_ACTIVITY_MS = 5 * 60_000;

function getGreeting(t: TranslateFn): string {
  const h = new Date().getHours();
  if (h < 12) return t("home_greeting_morning");
  if (h < 18) return t("home_greeting_afternoon");
  return t("home_greeting_night");
}

function TabLoading() {
  return (
    <div className="px-5 pt-5 pb-4 space-y-3 animate-pulse">
      <div className="h-24 rounded-3xl bg-muted/60" />
      <div className="h-4 w-32 rounded-full bg-muted/60" />
      <div className="h-16 rounded-2xl bg-muted/60" />
      <div className="h-16 rounded-2xl bg-muted/50" />
      <div className="h-16 rounded-2xl bg-muted/40" />
    </div>
  );
}

interface AppContentProps {
  setup: SetupData;
  saveSetup: (data: Partial<SetupData>) => void;
}

function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  const { isDark, toggle: toggleDark } = useDarkMode();

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [timerDisplayCategory, setTimerDisplayCategory] = useState<Category>("Predi");
  const [selectedStudySession, setSelectedStudySession] = useState<{ contactId: string; sessionId: string } | null>(null);
  const [calendarFocusEventId, setCalendarFocusEventId] = useState<string | null>(null);
  const [calendarFocusMonthDate, setCalendarFocusMonthDate] = useState<Date | null>(null);

  // ── Timer overrun state ───────────────────────────────────────────────────────
  const [timerOverrunDismissedId, setTimerOverrunDismissedId] = useState<string | null>(null);
  const [timerOverrunSnoozes, setTimerOverrunSnoozes] = useState<Record<string, number>>({});
  const [timerOverrunSnoozeTime, setTimerOverrunSnoozeTime] = useState("15:00");

  useEffect(() => {
    setTimerOverrunSnoozeTime((v) => clampTimeValueToHourRange(v, setup.activityStartHour, setup.activityEndHour));
  }, [setup.activityStartHour, setup.activityEndHour]);

  // ── Summary sheet state ───────────────────────────────────────────────────────
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDragOffset, setSummaryDragOffset] = useState<number | null>(null);
  const [summarySheetHeight, setSummarySheetHeight] = useState(0);
  const [summaryViewportHeight, setSummaryViewportHeight] = useState(
    typeof window === "undefined" ? 720 : window.innerHeight,
  );
  const [shortStopPrompt, setShortStopPrompt] = useState<{ customTime?: Date } | null>(null);
  const [deleteEventPromptId, setDeleteEventPromptId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const summarySheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartOffset = useRef(0);
  const summaryDidDrag = useRef(false);
  const timerContentRef = useRef<HTMLDivElement>(null);

  // ── Data hooks ────────────────────────────────────────────────────────────────
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
  const campaign = useSpecialCampaign();
  const { events: calendarEvents, markNotified, getEventsForDate } = calendar;

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
      activeScheduledEvent ? timerOverrunSnoozes[activeScheduledEvent.id] : undefined,
    );

  // ── Timer handlers ────────────────────────────────────────────────────────────
  const completeClockOut = (customTime?: Date) => {
    tracker.clockOut((eventId, endTime) => calendar.updateEvent(eventId, { endTime, completed: true }), customTime);
  };

  const requestClockOut = (customTime?: Date) => {
    if (!activeEntry) { completeClockOut(customTime); return; }
    const end = customTime ?? new Date();
    if (end.getTime() - activeEntry.startTime.getTime() < SHORT_ACTIVITY_MS) {
      setShortStopPrompt({ customTime });
      return;
    }
    completeClockOut(customTime);
  };

  const stopActiveTimer = () => {
    completeClockOut();
    setTimerOverrunDismissedId(activeScheduledEvent?.id ?? null);
  };

  const keepShortActivity = () => { completeClockOut(shortStopPrompt?.customTime); setShortStopPrompt(null); };
  const discardShortActivity = () => {
    if (!activeEntry) { setShortStopPrompt(null); return; }
    if (activeEntry.linkedEventId) calendar.deleteEvent(activeEntry.linkedEventId);
    tracker.deleteEntry(activeEntry.id);
    setShortStopPrompt(null);
  };
  const confirmDeleteEvent = () => {
    if (!deleteEventPromptId) return;
    calendar.deleteEvent(deleteEventPromptId);
    setDeleteEventPromptId(null);
  };
  const postponeTimerOverrunPrompt = () => {
    if (!activeScheduledEvent) return;
    const safe = clampTimeValueToHourRange(timerOverrunSnoozeTime, setup.activityStartHour, setup.activityEndHour);
    const [h, m] = safe.split(":").map(Number);
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimerOverrunSnoozes((prev) => ({ ...prev, [activeScheduledEvent.id]: next.getTime() }));
  };

  // ── Monthly total (source of truth: completed calendar events) ────────────────
  const todayKey = new Date().toDateString();
  const now = useMemo(() => new Date(todayKey), [todayKey]);
  const calMonthMs = useMemo(
    () =>
      calendarEvents
        .filter((e) => e.completed && e.endTime && e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear())
        .reduce((acc, e) => {
          if (!e.endTime) return acc;
          const [h, m] = e.endTime.split(":").map(Number);
          const end = new Date(e.date);
          end.setHours(h, m, 0, 0);
          return acc + Math.max(0, end.getTime() - e.date.getTime());
        }, 0),
    [calendarEvents, now],
  );

  // ── Notification effects ──────────────────────────────────────────────────────
  useNotificationEffects({
    calendarEvents,
    isTimerRunning: tracker.isRunning,
    markNotified,
    t,
    showTimerOverrunPrompt,
    activeScheduledEvent: activeScheduledEvent ?? null,
    activeEntry: activeEntry ?? null,
    calMonthMs,
    precursorHours: setup.precursorHours,
    estudiosContacts: estudios.contacts,
  });

  // ── Summary sheet: event lists ────────────────────────────────────────────────
  const todayEvents = useMemo(
    () => getEventsForDate(now).slice().sort((a, b) => a.date.getTime() - b.date.getTime()),
    [getEventsForDate, now],
  );
  const upcomingSummaryEvents = useMemo(() => {
    const currentTime = Date.now();
    const upcoming = calendarEvents
      .filter((e) => !e.completed && e.date.getTime() >= currentTime)
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const nextDayKey = upcoming[0]?.date.toDateString();
    return nextDayKey ? upcoming.filter((e) => e.date.toDateString() === nextDayKey) : [];
  }, [calendarEvents]);
  const summaryEvents = todayEvents.length > 0 ? todayEvents : upcomingSummaryEvents;
  const showingUpcomingEvents = todayEvents.length === 0 && upcomingSummaryEvents.length > 0;
  const groupedSummaryEvents = useMemo(
    () =>
      summaryEvents.reduce<Array<{ key: string; label: string; events: typeof summaryEvents }>>((groups, event) => {
        const key = event.date.toDateString();
        const existing = groups.find((g) => g.key === key);
        const label = key === todayKey ? t("day_today") : formatDateLong(event.date, locale);
        if (existing) existing.events.push(event);
        else groups.push({ key, label, events: [event] });
        return groups;
      }, []),
    [locale, summaryEvents, t, todayKey],
  );

  // ── Summary sheet: drag + measurement ────────────────────────────────────────
  const todayEventCount = summaryEvents.length;
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
  const contentSafeOffset =
    timerContentBottomY > 0
      ? Math.max(0, timerContentBottomY + 24 - summaryViewportHeight + 64 + summarySheetHeight)
      : 0;
  const collapsedSummaryOffset = Math.max(Math.max(0, summarySheetHeight - peekH), contentSafeOffset);
  const restingSummaryOffset = summaryOpen ? 0 : collapsedSummaryOffset;
  const activeSummaryOffset = summaryDragOffset ?? restingSummaryOffset;

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

  // ── Online state ──────────────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // ── Navigation helpers ────────────────────────────────────────────────────────
  const navigate = (tab: Tab) => startTransition(() => setActiveTab(tab));
  useEffect(() => {
    const t = setTimeout(() => {
      void import('@/components/StatsView');
      void import('@/components/CalendarView');
      void import('@/components/EstudiosView');
    }, 1500);
    return () => clearTimeout(t);
  }, []);
  const navigateToStudySession = (contactId: string, sessionId: string) => {
    setSelectedStudySession({ contactId, sessionId });
    startTransition(() => setActiveTab("estudios"));
  };
  const openCalendarEvent = (eventId: string) => {
    setCalendarFocusEventId(eventId);
    setSummaryOpen(false);
    startTransition(() => setActiveTab("calendar"));
  };
  const openMonthlyCalendar = () => {
    const monthDate = new Date(now);
    monthDate.setDate(1);
    setCalendarFocusEventId(null);
    setCalendarFocusMonthDate(monthDate);
    setActiveTab("calendar");
  };

  // ── Display helpers ───────────────────────────────────────────────────────────
  const displayCityName = setup.city ? formatPlaceName(setup.city.name, t) : "";
  const userName = setup.name || displayCityName || t("friend_name");
  const greeting = getGreeting(t);

  // ── Weather ───────────────────────────────────────────────────────────────────
  const { weather, hourlyWeather } = useWeather(setup.city);
  const heroTheme = getWeatherHeroTheme(weather);

  // ── Timer background ──────────────────────────────────────────────────────────
  const timerCategoryMeta = getCategoryMeta(setup.categorySettings, timerDisplayCategory);
  const timerBackground = `linear-gradient(160deg, ${hexToRgba(timerCategoryMeta.gradient[0], 0.28)} 0%, ${hexToRgba(timerCategoryMeta.gradient[1], 0.2)} 100%), #f8fafc`;

  // ── Keep-alive map ref ────────────────────────────────────────────────────────
  const mapEverVisited = useRef(false);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      {/* Offline banner */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] max-w-md mx-auto bg-yellow-400 text-yellow-900 text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-1.5">
          <span>⚠️</span>
          <span>{t("offline_banner")}</span>
        </div>
      )}

      <main className={`${!isOnline ? "pt-7" : ""} ${activeTab === "timer" ? "" : "pb-24"}`}>

        {/* ── HOME ── */}
        {activeTab === "home" && (
          <HomeTab
            greeting={greeting}
            userName={userName}
            displayCityName={displayCityName}
            weather={weather}
            hourlyWeather={hourlyWeather}
            heroTheme={heroTheme}
            calendarEvents={calendarEvents}
            estudiosContacts={estudios.contacts}
            setup={setup}
            calMonthMs={calMonthMs}
            navigate={navigate}
            navigateToStudySession={navigateToStudySession}
            openMonthlyCalendar={openMonthlyCalendar}
            t={t}
            locale={locale}
            todayKey={todayKey}
          />
        )}

        {/* ── STATS ── */}
        {activeTab === "summary" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-foreground">{t("nav_stats")}</h1>
                <MinistryMark size={32} />
              </div>
            </header>
            <Suspense fallback={<TabLoading />}>
              <StatsView
                entries={tracker.monthEntries}
                allEntries={tracker.entries}
                monthTotal={tracker.monthTotal}
                calendarEvents={calendar.events}
                precursorHours={setup.precursorHours}
                specialCampaignGoals={campaign.goals}
                onSetSpecialCampaign={campaign.setGoal}
                categoryConfigs={setup.categorySettings}
              />
            </Suspense>
          </>
        )}

        {/* ── TIMER ── */}
        {activeTab === "timer" && (
          <TimerTab
            timerBackground={timerBackground}
            greeting={greeting}
            userName={userName}
            displayCityName={displayCityName}
            weather={weather}
            summarySheetRef={summarySheetRef}
            timerContentRef={timerContentRef}
            summaryOpen={summaryOpen}
            setSummaryOpen={setSummaryOpen}
            summaryDragOffset={summaryDragOffset}
            activeSummaryOffset={activeSummaryOffset}
            toggleSummary={toggleSummary}
            startDrag={startDrag}
            moveDrag={moveDrag}
            endDrag={endDrag}
            summaryEvents={summaryEvents}
            groupedSummaryEvents={groupedSummaryEvents}
            showingUpcomingEvents={showingUpcomingEvents}
            showAllEvents={showAllEvents}
            setShowAllEvents={setShowAllEvents}
            hourlyWeather={hourlyWeather}
            activeEntry={activeEntry ?? null}
            activeScheduledEvent={activeScheduledEvent ?? null}
            tracker={tracker}
            calendar={calendar}
            estudios={estudios}
            setup={setup}
            requestClockOut={requestClockOut}
            navigate={navigate}
            openCalendarEvent={openCalendarEvent}
            setDeleteEventPromptId={setDeleteEventPromptId}
            setTimerDisplayCategory={setTimerDisplayCategory}
            t={t}
          />
        )}

        {/* ── CALENDAR ── */}
        {activeTab === "calendar" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-foreground">{t("nav_calendar")}</h1>
                <MinistryMark size={32} />
              </div>
            </header>
            <Suspense fallback={<TabLoading />}>
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
                onUpdateEstudioSession={estudios.updateSession}
                onAddEstudioSession={estudios.addScheduledSession}
                onDeleteEstudioSession={estudios.deleteSession}
                onCompleteEstudioSession={estudios.completeSession}
                travelReminder={{ enabled: setup.travelTimeEnabled, minutes: setup.travelTimeMinutes }}
                focusEventId={calendarFocusEventId}
                onFocusEventHandled={() => setCalendarFocusEventId(null)}
                focusMonthDate={calendarFocusMonthDate}
                onFocusMonthHandled={() => setCalendarFocusMonthDate(null)}
                precursorHours={setup.precursorHours}
                specialCampaignGoals={campaign.goals}
                onSetSpecialCampaign={campaign.setGoal}
                activityStartHour={setup.activityStartHour}
                activityEndHour={setup.activityEndHour}
                categoryConfigs={setup.categorySettings}
              />
            </Suspense>
          </>
        )}

        {/* ── PROFILE ── */}
        {activeTab === "profile" && (
          <div className="pb-24">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <MinistryMark size={28} />
                <h1 className="text-xl font-bold text-foreground">{t("nav_settings")}</h1>
              </div>
            </header>
            <div className="px-5 pt-5 mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => navigate("estudios")}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-pink-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">{t("nav_studies")}</span>
              </button>
              <button
                onClick={() => navigate("map")}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] text-left"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-blue-500" />
                </div>
                <span className="text-sm font-semibold text-foreground">{t("nav_map")}</span>
              </button>
            </div>
            <Suspense fallback={<TabLoading />}>
              <SettingsView
                entryCount={tracker.entries.length}
                onClearAll={handleClearAll}
                setup={setup}
                onSaveSetup={saveSetup}
                isDark={isDark}
                onToggleDark={toggleDark}
                hasActiveStudies={estudios.contacts.some(hasActiveStudyWork)}
              />
            </Suspense>
          </div>
        )}

        {/* ── ESTUDIOS ── */}
        {activeTab === "estudios" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("profile")}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                  aria-label={t("common_back")}
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <h1 className="text-xl font-bold text-foreground">{t("nav_studies")}</h1>
                <MinistryMark size={32} className="ml-auto" />
              </div>
            </header>
            <Suspense fallback={<TabLoading />}>
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
                focusedSession={selectedStudySession}
                onFocusedSessionHandled={() => setSelectedStudySession(null)}
              />
            </Suspense>
          </>
        )}

        {/* ── MAP (keep-alive: mount once, then hide instead of unmount) ── */}
        {(() => { if (activeTab === "map") mapEverVisited.current = true; return null; })()}
        <div className={activeTab === "map" && mapEverVisited.current ? "" : "hidden"}>
          {mapEverVisited.current && (
            <>
              <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("profile")}
                    className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                    aria-label={t("common_back")}
                  >
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <h1 className="text-xl font-bold text-foreground">{t("nav_map")}</h1>
                  <MinistryMark size={32} className="ml-auto" />
                </div>
              </header>
              <div className="py-4 pb-24">
                <Suspense fallback={<TabLoading />}>
                  <LocationMap
                    favoritePlaces={favorites.places}
                    onAddFavorite={favorites.addPlace}
                    onDeleteFavorite={favorites.deletePlace}
                    defaultCenter={defaultCenter}
                  />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </main>

      <MissedStudyBanner
        contacts={estudios.contacts}
        onComplete={estudios.completeSession}
        onCancel={estudios.deleteSession}
        onReschedule={(contactId, sessionId, data) => {
          const contact = estudios.contacts.find((c) => c.id === contactId);
          const session = contact?.sessions.find((s) => s.id === sessionId);
          if (session) {
            const oldDate = new Date(session.date);
            calendarEvents
              .filter((e) => !e.completed && e.date.toDateString() === oldDate.toDateString() && Math.abs(e.date.getTime() - oldDate.getTime()) < 30 * 60 * 1000)
              .forEach((e) => calendar.deleteEvent(e.id));
          }
          estudios.updateSession(contactId, sessionId, data);
        }}
      />

      {showTimerOverrunPrompt && activeScheduledEvent && (
        <TimerOverrunPrompt
          activeScheduledEvent={activeScheduledEvent}
          timerOverrunSnoozeTime={timerOverrunSnoozeTime}
          setTimerOverrunSnoozeTime={setTimerOverrunSnoozeTime}
          setup={setup}
          postponeTimerOverrunPrompt={postponeTimerOverrunPrompt}
          stopActiveTimer={stopActiveTimer}
          setTimerOverrunDismissedId={setTimerOverrunDismissedId}
          t={t}
          locale={locale}
        />
      )}

      <AlertDialog open={!!shortStopPrompt} onOpenChange={(open) => { if (!open) setShortStopPrompt(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("timer_short_activity_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("timer_short_activity_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel onClick={keepShortActivity}>{t("timer_short_activity_keep")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={discardShortActivity}
            >
              {t("timer_short_activity_discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteEventPromptId} onOpenChange={(open) => { if (!open) setDeleteEventPromptId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cal_delete_confirm_title")}</AlertDialogTitle>
            <AlertDialogDescription>{t("cal_delete_confirm_body")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{t("common_cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteEvent}
            >
              {t("home_delete_activity")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav
        activeTab={activeTab}
        onTabChange={navigate}
        isRunning={tracker.isRunning}
        activeCategory={timerDisplayCategory}
        categoryConfigs={setup.categorySettings}
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
        <p className="text-sm text-muted-foreground">{translate(lang, "common_loading_data")}</p>
      </div>
    );
  }

  if (!setup.completed) {
    return (
      <LanguageProvider lang={lang}>
        <Suspense fallback={<TabLoading />}>
          <SetupScreen onComplete={completeSetup} onLangChange={setSetupLang} />
        </Suspense>
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

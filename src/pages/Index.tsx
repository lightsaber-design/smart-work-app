import { lazy, Suspense, useMemo, useState, useEffect, useRef, startTransition } from "react";
import { MinistryMark } from "@/components/MinistryMark";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents, EventCategory } from "@/hooks/useCalendarEvents";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
import { ClockButton } from "@/components/ClockButton";
import { BottomNav, AppTab } from "@/components/BottomNav";
import { CategoryIcon } from "@/components/CategoryIcon";
import { LanguageProvider, localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { detectLanguage, Lang, translate } from "@/lib/i18n";
import { ChevronLeft, ChevronRight, MapPin, BookOpen, Moon, Sun, Plus, Pencil, Trash2, Check, CloudFog, CloudRain, CloudSun, Snowflake, Zap } from "lucide-react";
import { hasActiveStudyWork, useEstudios } from "@/hooks/useEstudios";
import { MissedStudyBanner } from "@/components/MissedStudyBanner";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useSpecialCampaign } from "@/hooks/useSpecialCampaign";
import { getCategoryLabel, getCategoryMeta, getCategoryStyle } from "@/lib/categories";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { removeJsonValue } from "@/lib/jsonFileStorage";
import { shouldNotifyEvent } from "@/lib/eventReminders";
import { findActiveScheduledEvent, getEventEndDate, shouldShowTimerOverrunPrompt } from "@/lib/timerOverrun";
import { showBrowserNotification, scheduleEventNotification, cancelEventNotification } from "@/lib/notifications";
import { timerLongRunFireAt, getGoalStatus, getForgottenContacts, currentMonthKey } from "@/lib/notificationRules";
import { clampTimeValueToHourRange } from "@/lib/activityHours";
import { formatPlaceName } from "@/lib/placeNames";
import { formatDateLong, formatTime } from "@/lib/dateFormat";
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

const StatsView = lazy(() => import("@/components/StatsView").then((module) => ({ default: module.StatsView })));
const CalendarView = lazy(() => import("@/components/CalendarView").then((module) => ({ default: module.CalendarView })));
const EstudiosView = lazy(() => import("@/components/EstudiosView").then((module) => ({ default: module.EstudiosView })));
const LocationMap = lazy(() => import("@/components/LocationMap").then((module) => ({ default: module.LocationMap })));
const SettingsView = lazy(() => import("@/components/SettingsView").then((module) => ({ default: module.SettingsView })));
const SetupScreen = lazy(() => import("@/components/SetupScreen").then((module) => ({ default: module.SetupScreen })));

type Tab = AppTab;
type Category = EventCategory;

interface AppContentProps {
  setup: SetupData;
  saveSetup: (data: Partial<SetupData>) => void;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function getGreeting(t: TranslateFn): string {
  const h = new Date().getHours();
  if (h < 12) return t("home_greeting_morning");
  if (h < 18) return t("home_greeting_afternoon");
  return t("home_greeting_night");
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

type HourlyWeather = {
  date: Date;
  temp: number;
  code: number;
  precipitationProbability: number | null;
};

type CurrentWeather = {
  temp: number;
  code: number;
  isDay: boolean | null;
};

const WEATHER_CACHE_KEY = "_ml_weather";
const WEATHER_TTL = 30 * 60 * 1000;
const SHORT_ACTIVITY_MS = 5 * 60_000;

function weatherCodeToLabel(code: number, t: TranslateFn): string {
  if (code === 0) return t("weather_clear");
  if (code <= 3) return t("weather_cloudy");
  if (code <= 48) return t("weather_fog");
  if (code <= 67) return t("weather_rain");
  if (code <= 77) return t("weather_snow");
  if (code <= 82) return t("weather_showers");
  return t("weather_storm");
}

function hourLabel(date: Date, t: TranslateFn): string {
  const hour = date.getHours();
  if (hour === 0) return t("time_midnight");
  if (hour === 12) return t("time_noon");
  return t(hour < 12 ? "time_hour_morning" : "time_hour_afternoon", { hour: hour % 12 || 12 });
}

function isRainyWeather(code: number, probability: number | null): boolean {
  return (code >= 51 && code <= 99) || (probability ?? 0) >= 45;
}

function getWeatherForDate(hourlyWeather: HourlyWeather[], date: Date): HourlyWeather | null {
  if (hourlyWeather.length === 0) return null;
  const targetMs = date.getTime();
  let bestForecast: HourlyWeather | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const item of hourlyWeather) {
    const diff = Math.abs(item.date.getTime() - targetMs);
    if (diff > 90 * 60_000 || diff >= bestDiff) continue;
    bestForecast = item;
    bestDiff = diff;
  }
  return bestForecast;
}

function formatActivityWeather(hourlyWeather: HourlyWeather[], date: Date, t: TranslateFn): string | null {
  const forecast = getWeatherForDate(hourlyWeather, date);
  if (!forecast) return null;
  const rain = isRainyWeather(forecast.code, forecast.precipitationProbability);
  const probability = forecast.precipitationProbability != null ? ` · ${t("weather_rain_probability", { probability: forecast.precipitationProbability })}` : "";
  return `${weatherCodeToEmoji(forecast.code)} ${forecast.temp}° · ${rain ? t("weather_possible_rain") : weatherCodeToLabel(forecast.code, t)}${probability}`;
}

function formatDayWeatherSummary(hourlyWeather: HourlyWeather[], events: { date: Date }[], t: TranslateFn): string | null {
  const anchorDate = events[0]?.date ?? new Date();
  const eventForecasts = events
    .map((event) => ({ event, forecast: getWeatherForDate(hourlyWeather, event.date) }))
    .filter((item): item is { event: { date: Date }; forecast: HourlyWeather } => item.forecast !== null);

  const rainy = eventForecasts.find((item) => isRainyWeather(item.forecast.code, item.forecast.precipitationProbability));
  if (rainy) {
    return `${weatherCodeToEmoji(rainy.forecast.code)} ${t("weather_later_rain", { time: hourLabel(rainy.event.date, t) })}`;
  }

  const dayForecasts = hourlyWeather.filter((item) => (
    item.date.toDateString() === anchorDate.toDateString() &&
    item.date.getHours() >= 7 &&
    item.date.getHours() <= 22
  ));
  const usableForecasts = eventForecasts.map((item) => item.forecast);
  const forecasts = usableForecasts.length > 0 ? usableForecasts : dayForecasts;
  if (forecasts.length === 0) return null;

  const dayRain = dayForecasts.find((item) => isRainyWeather(item.code, item.precipitationProbability));
  if (dayRain) return `${weatherCodeToEmoji(dayRain.code)} ${t("weather_later_rain", { time: hourLabel(dayRain.date, t) })}`;

  const warmest = forecasts.slice().sort((a, b) => b.temp - a.temp)[0];
  return `${weatherCodeToEmoji(warmest.code)} ${t("weather_day_summary", { condition: weatherCodeToLabel(warmest.code, t), temp: warmest.temp })}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getWeatherHeroTheme(weather: CurrentWeather | null) {
  const hour = new Date().getHours();
  const weatherIsDay = weather?.isDay;
  const isNight = weatherIsDay === false || (weatherIsDay !== true && (hour < 7 || hour >= 20));
  const code = weather?.code ?? (isNight ? 1 : 0);
  const rainy = isRainyWeather(code, null);
  const stormy = code >= 95;
  const snowy = code >= 71 && code <= 77;
  const foggy = code >= 45 && code <= 48;
  const cloudy = code >= 1 && code <= 3;

  if (stormy) {
    return {
      background: "linear-gradient(160deg, #283142 0%, #516070 54%, #64748b 100%)",
      overlay: "repeating-linear-gradient(105deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 16px)",
      Icon: Zap,
      label: "weather_storm",
    };
  }
  if (rainy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #152238 0%, #24445b 58%, #2f6f73 100%)"
        : "linear-gradient(160deg, #236b80 0%, #47a7ad 58%, #7bbfba 100%)",
      overlay: "repeating-linear-gradient(102deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 13px)",
      Icon: CloudRain,
      label: "weather_rain",
    };
  }
  if (snowy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #1e293b 0%, #475569 58%, #94a3b8 100%)"
        : "linear-gradient(160deg, #7aa8bc 0%, #c2dce5 100%)",
      overlay: "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.42) 0 1px, transparent 2px), radial-gradient(circle at 75% 38%, rgba(255,255,255,0.34) 0 1px, transparent 2px)",
      Icon: Snowflake,
      label: "weather_snow",
    };
  }
  if (foggy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #1f2937 0%, #4b5563 100%)"
        : "linear-gradient(160deg, #6aa5ab 0%, #b7cbc9 100%)",
      overlay: "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 24px)",
      Icon: CloudFog,
      label: "weather_fog",
    };
  }
  if (isNight) {
    return {
      background: "linear-gradient(160deg, #0f172a 0%, #164e63 58%, #0f766e 100%)",
      overlay: "linear-gradient(180deg, rgba(255,255,255,0.08), transparent 42%)",
      Icon: Moon,
      label: cloudy ? "weather_cloudy_night" : "weather_night",
    };
  }
  if (cloudy) {
    return {
      background: "linear-gradient(160deg, #189ca7 0%, #6bc7c3 100%)",
      overlay: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 45%)",
      Icon: CloudSun,
      label: "weather_cloudy",
    };
  }
  return {
    background: "linear-gradient(160deg, #18a6b6 0%, #64c8bf 58%, #f0c15b 100%)",
    overlay: "linear-gradient(135deg, rgba(255,255,255,0.24), transparent 48%)",
    Icon: Sun,
    label: "weather_sunny",
  };
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

function AppContent({ setup, saveSetup }: AppContentProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  const { isDark, toggle: toggleDark } = useDarkMode();
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [timerDisplayCategory, setTimerDisplayCategory] = useState<Category>("Predi");
  const [timerOverrunDismissedId, setTimerOverrunDismissedId] = useState<string | null>(null);
  const [timerOverrunSnoozes, setTimerOverrunSnoozes] = useState<Record<string, number>>({});
  const [timerOverrunSnoozeTime, setTimerOverrunSnoozeTime] = useState("15:00");
  const [timerOverrunNotifiedId, setTimerOverrunNotifiedId] = useState<string | null>(null);
  const [selectedStudySession, setSelectedStudySession] = useState<{ contactId: string; sessionId: string } | null>(null);
  const [calendarFocusEventId, setCalendarFocusEventId] = useState<string | null>(null);
  const [calendarFocusMonthDate, setCalendarFocusMonthDate] = useState<Date | null>(null);

  useEffect(() => {
    setTimerOverrunSnoozeTime((value) => clampTimeValueToHourRange(value, setup.activityStartHour, setup.activityEndHour));
  }, [setup.activityStartHour, setup.activityEndHour]);

  // Summary sheet state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryDragOffset, setSummaryDragOffset] = useState<number | null>(null);
  const [summarySheetHeight, setSummarySheetHeight] = useState(0);
  const [summaryViewportHeight, setSummaryViewportHeight] = useState(
    typeof window === "undefined" ? 720 : window.innerHeight
  );
  const [shortStopPrompt, setShortStopPrompt] = useState<{ customTime?: Date } | null>(null);
  const [deleteEventPromptId, setDeleteEventPromptId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const summarySheetRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number | null>(null);
  const dragStartOffset = useRef(0);
  const summaryDidDrag = useRef(false);

  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
  const campaign = useSpecialCampaign();
  const { events: calendarEvents, markNotified, getEventsForDate } = calendar;
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
    completeClockOut();
    setTimerOverrunDismissedId(activeScheduledEvent?.id ?? null);
  };

  const completeClockOut = (customTime?: Date) => {
    tracker.clockOut((eventId, endTime) => calendar.updateEvent(eventId, { endTime, completed: true }), customTime);
  };

  const requestClockOut = (customTime?: Date) => {
    if (!activeEntry) {
      completeClockOut(customTime);
      return;
    }
    const end = customTime ?? new Date();
    if (end.getTime() - activeEntry.startTime.getTime() < SHORT_ACTIVITY_MS) {
      setShortStopPrompt({ customTime });
      return;
    }
    completeClockOut(customTime);
  };

  const keepShortActivity = () => {
    completeClockOut(shortStopPrompt?.customTime);
    setShortStopPrompt(null);
  };

  const discardShortActivity = () => {
    if (!activeEntry) {
      setShortStopPrompt(null);
      return;
    }
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
    const safeSnoozeTime = clampTimeValueToHourRange(timerOverrunSnoozeTime, setup.activityStartHour, setup.activityEndHour);
    const [hours, minutes] = safeSnoozeTime.split(":").map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    setTimerOverrunSnoozes((prev) => ({ ...prev, [activeScheduledEvent.id]: next.getTime() }));
    setTimerOverrunNotifiedId(null);
  };

  // ── Pre-programar notificaciones nativas al cambiar los eventos ──────────────
  const scheduledEventFireTimes = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const now = Date.now();
    const liveReminderIds = new Set<string>();

    calendarEvents.forEach((event) => {
      if (event.completed || event.notified) return;
      const reminder = event.reminderMinutesBefore ?? 0;
      if (reminder <= 0) return;
      const fireAt = new Date(event.date.getTime() - reminder * 60_000);
      if (fireAt.getTime() <= now) return;
      liveReminderIds.add(event.id);

      const fireAtMs = fireAt.getTime();
      if (scheduledEventFireTimes.current.get(event.id) === fireAtMs) return;

      void scheduleEventNotification(
        event.id,
        t("notif_activity_upcoming"),
        t("notif_activity_upcoming_body", { category: getCategoryLabel(event.category, t) }),
        fireAt
      ).then((scheduled) => {
        if (scheduled) scheduledEventFireTimes.current.set(event.id, fireAtMs);
        else if (scheduledEventFireTimes.current.get(event.id) === fireAtMs) scheduledEventFireTimes.current.delete(event.id);
      });
    });
    // Cancelar las que ya no existen o están completadas
    scheduledEventFireTimes.current.forEach((_, id) => {
      if (!liveReminderIds.has(id)) {
        void cancelEventNotification(id);
        scheduledEventFireTimes.current.delete(id);
      }
    });
  }, [calendarEvents, t]);

  // ── Fallback: check periódico cuando la app está abierta (web / sin reminder) ─
  useEffect(() => {
    const hasPendingReminder = calendarEvents.some((event) =>
      !event.completed && !event.notified && Date.now() < event.date.getTime() + 5 * 60_000
    );
    if (!hasPendingReminder) return;

    const check = () => {
      const now = Date.now();
      calendarEvents.forEach((event) => {
        if (!shouldNotifyEvent(now, event)) return;
        // Bug fix: solo marcar notified si realmente se envía el aviso.
        // Si el timer está activo, se reintenta en el siguiente ciclo (ventana 5 min).
        if (tracker.isRunning) return;
        showBrowserNotification(t("notif_activity_upcoming"), {
          body: t("notif_activity_upcoming_body", { category: getCategoryLabel(event.category, t) }),
        });
        markNotified(event.id);
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [calendarEvents, tracker.isRunning, markNotified, t]);

  useEffect(() => {
    if (!showTimerOverrunPrompt || !activeScheduledEvent || timerOverrunNotifiedId === activeScheduledEvent.id) return;
    showBrowserNotification(t("timer_overrun_title"), {
      body: t("timer_overrun_notification_body", { category: getCategoryLabel(activeScheduledEvent.category, t) }),
    });
    setTimerOverrunNotifiedId(activeScheduledEvent.id);
  }, [activeScheduledEvent, showTimerOverrunPrompt, t, timerOverrunNotifiedId]);

  const todayKey = new Date().toDateString();
  const now = useMemo(() => new Date(todayKey), [todayKey]);
  const todayEvents = useMemo(
    () => getEventsForDate(now)
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime()),
    [getEventsForDate, now]
  );
  const upcomingSummaryEvents = useMemo(() => {
    const currentTime = Date.now();
    const upcoming = calendarEvents
      .filter((event) => !event.completed && event.date.getTime() >= currentTime)
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    const nextDayKey = upcoming[0]?.date.toDateString();
    return nextDayKey ? upcoming.filter((event) => event.date.toDateString() === nextDayKey) : [];
  }, [calendarEvents]);
  const summaryEvents = todayEvents.length > 0 ? todayEvents : upcomingSummaryEvents;
  const showingUpcomingEvents = todayEvents.length === 0 && upcomingSummaryEvents.length > 0;
  const groupedSummaryEvents = useMemo(() => {
    return summaryEvents.reduce<Array<{ key: string; label: string; events: typeof summaryEvents }>>((groups, event) => {
      const key = event.date.toDateString();
      const existing = groups.find((group) => group.key === key);
      const label = key === todayKey
        ? t("day_today")
        : formatDateLong(event.date, locale);
      if (existing) {
        existing.events.push(event);
      } else {
        groups.push({ key, label, events: [event] });
      }
      return groups;
    }, []);
  }, [locale, summaryEvents, t, todayKey]);

  // Sheet drag logic
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

  // ── Estado de conexión ───────────────────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const navigate = (tab: Tab) => startTransition(() => setActiveTab(tab));
  // ── Pre-carga de chunks lazy tras render inicial ───────────────────────────
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
  const displayCityName = setup.city ? formatPlaceName(setup.city.name, t) : "";
  const userName = setup.name || displayCityName || t("friend_name");

  // ── Weather (con caché de 30 min) ────────────────────────────────────────────
  const [weather, setWeather] = useState<CurrentWeather | null>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && Date.now() - c.ts < WEATHER_TTL) return c.weather as CurrentWeather;
    } catch {
      // Si la cache esta corrupta, se ignora y se carga desde red.
    }
    return null;
  });
  const [hourlyWeather, setHourlyWeather] = useState<HourlyWeather[]>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && Date.now() - c.ts < WEATHER_TTL && Array.isArray(c.hourly)) {
        return (c.hourly as HourlyWeather[]).map((h) => ({ ...h, date: new Date(h.date) }));
      }
    } catch {
      // Si la cache esta corrupta, se ignora y se carga desde red.
    }
    return [];
  });

  useEffect(() => {
    if (!setup.city) { setWeather(null); setHourlyWeather([]); return; }
    // Usa caché si es reciente
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && c.cityKey === `${setup.city.lat},${setup.city.lng}` && Date.now() - c.ts < WEATHER_TTL) return;
    } catch {
      // Si la cache esta corrupta, se ignora y se carga desde red.
    }

    const { lat, lng } = setup.city;
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=7&timezone=auto`)
      .then((r) => r.json())
      .then((data) => {
        const cw = data?.current_weather;
        let newWeather: CurrentWeather | null = null;
        if (cw) {
          newWeather = { temp: Math.round(cw.temperature), code: cw.weathercode, isDay: typeof cw.is_day === "number" ? cw.is_day === 1 : null };
          setWeather(newWeather);
        }
        const hourly = data?.hourly;
        let newHourly: HourlyWeather[] = [];
        if (Array.isArray(hourly?.time) && Array.isArray(hourly?.temperature_2m) && Array.isArray(hourly?.weather_code)) {
          newHourly = hourly.time.map((time: string, index: number) => ({
            date: new Date(time),
            temp: Math.round(Number(hourly.temperature_2m[index])),
            code: Number(hourly.weather_code[index]),
            precipitationProbability: Array.isArray(hourly.precipitation_probability) ? Number(hourly.precipitation_probability[index]) : null,
          })).filter((item: HourlyWeather) => !Number.isNaN(item.date.getTime()) && Number.isFinite(item.temp) && Number.isFinite(item.code));
          setHourlyWeather(newHourly);
        }
        // Guarda en caché
        if (newWeather) {
          try {
            localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ cityKey: `${lat},${lng}`, ts: Date.now(), weather: newWeather, hourly: newHourly }));
          } catch {
            // El clima es auxiliar; si no se puede cachear no bloquea la app.
          }
        }
      })
      .catch((error) => console.warn("Weather fetch failed:", error));
  }, [setup.city]);

  // Timer background gradient
  const timerCategoryMeta = getCategoryMeta(setup.categorySettings, timerDisplayCategory);
  const timerBackground = `linear-gradient(160deg, ${hexToRgba(timerCategoryMeta.gradient[0], 0.28)} 0%, ${hexToRgba(timerCategoryMeta.gradient[1], 0.2)} 100%), #f8fafc`;

  // Monthly total from completed calendar events (source of truth for hours)
  const calMonthMs = useMemo(() => {
    return calendarEvents
      .filter((e) => {
        return (
          e.completed &&
          e.endTime &&
          e.date.getMonth() === now.getMonth() &&
          e.date.getFullYear() === now.getFullYear()
        );
      })
      .reduce((acc, e) => {
        if (!e.endTime) return acc;
        const [h, m] = e.endTime.split(":").map(Number);
        const end = new Date(e.date);
        end.setHours(h, m, 0, 0);
        return acc + Math.max(0, end.getTime() - e.date.getTime());
      }, 0);
  }, [calendarEvents, now]);
  const monthTotalHrs = Math.floor(calMonthMs / 3_600_000);
  const monthTotalMins = Math.floor((calMonthMs % 3_600_000) / 60_000);

  // ── Keep-alive del mapa ───────────────────────────────────────────────────
  const mapEverVisited = useRef(false);

  // ── Regla 1: Timer activo >3h ─────────────────────────────────────────────
  const timer3hRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeEntry) {
      if (timer3hRef.current) {
        void cancelEventNotification("timer-3h");
        timer3hRef.current = null;
      }
      return;
    }
    if (timer3hRef.current === activeEntry.id) return;
    timer3hRef.current = activeEntry.id;
    // Nativo: programa el aviso para exactamente startTime + 3h
    void scheduleEventNotification(
      "timer-3h",
      t("notif_timer_3h_title"),
      t("notif_timer_3h_body"),
      timerLongRunFireAt(activeEntry.startTime)
    );
    // Web: intervalo de comprobación cada minuto
    const iv = setInterval(() => {
      if (Date.now() - activeEntry.startTime.getTime() >= 3 * 3_600_000) {
        showBrowserNotification(t("notif_timer_3h_title"), { body: t("notif_timer_3h_body") });
        clearInterval(iv);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [activeEntry, t]);

  // ── Regla 3: Meta mensual ─────────────────────────────────────────────────
  useEffect(() => {
    const goalHours = setup.precursorHours ?? 0;
    if (!goalHours) return;
    const status = getGoalStatus(goalHours, calMonthMs);
    const monthKey = currentMonthKey();

    if (status.kind === "reached") {
      const key = `_ml_goal_reached_${monthKey}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      showBrowserNotification(t("notif_goal_reached_title"), {
        body: t("notif_goal_reached_body"),
      });
    } else if (status.kind === "reminder") {
      const key = `_ml_goal_reminder_${monthKey}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      showBrowserNotification(t("notif_goal_reminder_title"), {
        body: t("notif_goal_reminder_body", {
          hours: String(Math.ceil(status.remainingHours)),
          days: String(status.daysLeft),
        }),
      });
    }
  }, [calMonthMs, setup.precursorHours, t]);

  // ── Regla 4: Contacto sin cita >14 días ──────────────────────────────────
  useEffect(() => {
    const key = `_ml_study_reminder_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    const forgotten = getForgottenContacts(estudios.contacts);
    if (!forgotten.length) return;
    localStorage.setItem(key, "1");
    const body = forgotten.length === 1
      ? t("notif_study_reminder_body", { name: forgotten[0].name })
      : t("notif_study_reminder_body_multi", { count: String(forgotten.length) });
    showBrowserNotification(t("notif_study_reminder_title"), { body });
  }, [estudios.contacts, t]);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      {/* ── Indicador sin conexión ── */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[100] max-w-md mx-auto bg-yellow-400 text-yellow-900 text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-1.5">
          <span>⚠️</span>
          <span>{t("offline_banner")}</span>
        </div>
      )}

      <main className={`${!isOnline ? "pt-7" : ""} ${activeTab === "timer" ? "" : "pb-24"}`}>

        {/* ── HOME TAB ── */}
        {activeTab === "home" && (() => {
          const todayMidnight = new Date();
          todayMidnight.setHours(0, 0, 0, 0);

          // Calendar events — non-completed, from today midnight onwards
          const calUpcoming = calendarEvents
            .filter((e) => !e.completed && e.date.getTime() >= todayMidnight.getTime())
            .map((e) => ({
              id: e.id,
              date: e.date,
              category: e.category as import("@/hooks/useCalendarEvents").EventCategory,
              label: getCategoryLabel(e.category, t),
              contactName: undefined as string | undefined,
              contactId: undefined as string | undefined,
              sessionId: undefined as string | undefined,
            }));

          // Pending study sessions (from useEstudios) — from today midnight onwards
          const estudiosUpcoming = estudios.contacts
            .filter((c) => c.active)
            .flatMap((c) =>
              (c.sessions ?? [])
                .filter((s) => {
                  if (!s.pending) return false;
                  const d = new Date(s.date);
                  return d.getTime() >= todayMidnight.getTime();
                })
                .map((s) => {
                  const d = new Date(s.date);
                  const [hh, mm] = s.time.split(":").map(Number);
                  d.setHours(hh, mm, 0, 0);
                  return {
                    id: s.id,
                    date: d,
                    category: "Estudio" as import("@/hooks/useCalendarEvents").EventCategory,
                    label: `${getCategoryLabel("Estudio", t)} – ${c.name}`,
                    contactName: c.name,
                    contactId: c.id,
                    sessionId: s.id,
                  };
                })
            );

          // Unified sorted list
          const allUpcoming = [...calUpcoming, ...estudiosUpcoming].sort(
            (a, b) => a.date.getTime() - b.date.getTime()
          );
          const totalUpcoming = allUpcoming.length;
          const nextDayGroups = allUpcoming.reduce<Array<{ key: string; label: string; events: typeof allUpcoming }>>((groups, item) => {
            const key = item.date.toDateString();
            const existing = groups.find((group) => group.key === key);
            const label = key === todayKey
              ? t("day_today")
              : formatDateLong(item.date, locale);
            if (existing) {
              existing.events.push(item);
            } else if (groups.length < 2) {
              groups.push({ key, label, events: [item] });
            }
            return groups;
          }, []);
          const displayedUpcomingCount = nextDayGroups.reduce((count, group) => count + group.events.length, 0);
          const hasMore = allUpcoming.length > displayedUpcomingCount;
          const heroTheme = getWeatherHeroTheme(weather);
          const WeatherHeroIcon = heroTheme.Icon;
          const monthlyGoalPct = setup.precursorHours
            ? Math.min(100, Math.round((calMonthMs / (setup.precursorHours * 3_600_000)) * 100))
            : 0;
          return (
            <div className="min-h-screen bg-background pb-24">
              {/* Gradient hero */}
              <div
                className="relative overflow-hidden px-5 pt-14 pb-20"
                style={{ background: heroTheme.background }}
              >
                <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ backgroundImage: heroTheme.overlay }} />
                <div className="absolute right-4 top-24 pointer-events-none">
                  <WeatherHeroIcon className="h-20 w-20 text-white/18" strokeWidth={1.4} />
                </div>
                <div className="relative z-10">
                  <p className="text-white/80 text-sm font-medium">{getGreeting(t)}</p>
                  <h1 className="text-3xl font-black text-white leading-tight mt-0.5">{userName},</h1>
                  {setup.city && (
                    <p className="text-white/75 text-[13px] mt-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      {displayCityName}{weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
                    </p>
                  )}
                  {weather && (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/16 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur">
                      <WeatherHeroIcon className="h-3.5 w-3.5" />
                      {t(heroTheme.label)}
                    </p>
                  )}
                </div>
              </div>

              {/* Background section rounded top */}
              <div className="bg-background rounded-t-[32px] -mt-10 relative z-10 px-5 pt-5 pb-4">

                {/* Monthly hours card */}
                <button
                  type="button"
                  onClick={openMonthlyCalendar}
                  className="w-full rounded-3xl border border-border bg-card shadow-xl p-5 mb-6 text-left transition-transform active:scale-[0.98]"
                >
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("stats_month_total")}</p>
                  <div className="flex items-end gap-1.5 mt-1.5">
                    <span className="text-4xl font-black text-foreground leading-none">{monthTotalHrs}</span>
                    <span className="text-xl font-bold text-muted-foreground mb-0.5">h</span>
                    <span className="text-2xl font-black text-foreground leading-none ml-1">{monthTotalMins}</span>
                    <span className="text-base font-bold text-muted-foreground mb-0.5">m</span>
                  </div>
                  {setup.precursorHours && (
                    <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                          {t("stats_pioneer_goal")}
                        </p>
                        <p className="text-3xl font-black leading-none text-primary tabular-nums">
                          {monthlyGoalPct}%
                        </p>
                      </div>
                      <div className="mt-3 h-4 rounded-full bg-background/70 overflow-hidden ring-1 ring-primary/15">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${monthlyGoalPct}%`, background: "linear-gradient(90deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, white) 100%)" }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-semibold text-foreground">
                        {monthTotalHrs}h {monthTotalMins}m / {setup.precursorHours}h
                      </p>
                    </div>
                  )}
                </button>

                {/* Upcoming activities */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-foreground">
                    {t("home_upcoming_activities")}
                  </h2>
                  <button
                    onClick={() => navigate("calendar")}
                    className="text-xs text-primary font-semibold flex items-center gap-0.5"
                  >
                    {t("home_see_all")} <ChevronRight className="w-3 h-3" />
                  </button>
                </div>

                {totalUpcoming === 0 ? (
                  <div className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center">
                    <p className="text-sm font-semibold text-foreground">{t("home_no_upcoming_activities")}</p>
                    {formatDayWeatherSummary(hourlyWeather, [], t) && (
                      <p className="mt-1 text-xs text-muted-foreground">{formatDayWeatherSummary(hourlyWeather, [], t)}</p>
                    )}
                    <button
                      onClick={() => navigate("calendar")}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-transform"
                    >
                      <Plus className="w-4 h-4" /> {t("home_add_activity")}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {nextDayGroups.map((group, groupIdx) => (
                      <div key={group.key} className="space-y-2">
                        {groupIdx > 0 && <div className="border-t border-border/50 pt-2" />}
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {group.label}
                        </p>
                        {group.events.map((item) => {
                          const style = getCategoryStyle(setup.categorySettings, item.category);
                          const meta = getCategoryMeta(setup.categorySettings, item.category);
                          const timeStr = `${String(item.date.getHours()).padStart(2, "0")}:${String(item.date.getMinutes()).padStart(2, "0")}`;
                          const forecast = formatActivityWeather(hourlyWeather, item.date, t);
                          return (
                            <button
                              key={item.id}
                              onClick={() =>
                                item.contactId && item.sessionId
                                  ? navigateToStudySession(item.contactId, item.sessionId)
                                  : navigate("calendar")
                              }
                              className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-3 text-left active:scale-[0.98] transition-transform ${style.card}`}
                              style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
                            >
                              <CategoryIcon icon={meta.icon} className="text-xl leading-none flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-foreground truncate">{item.label}</p>
                                <p className="text-[11px] text-muted-foreground">{timeStr}</p>
                                {forecast && <p className="text-[10px] text-muted-foreground truncate">{forecast}</p>}
                              </div>
                              <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    ))}

                    {hasMore && (
                      <button
                        onClick={() => navigate("calendar")}
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary"
                      >
                        {t("home_see_more_calendar", { count: allUpcoming.length - displayedUpcomingCount })} <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    )}
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

        {/* ── TIMER TAB ── */}
        {activeTab === "timer" && (
          <div className="h-screen flex flex-col relative pb-16 overflow-hidden" style={{ background: timerBackground }}>
            {/* Header */}
            <div className="px-5 pt-5 flex-shrink-0">
              <div>
                <p className="text-sm text-slate-700 font-medium">{getGreeting(t)}</p>
                <h1 className="text-xl font-bold text-slate-950 leading-tight">{userName}</h1>
                {setup.city && (
                  <p className="text-[11px] text-slate-700">
                    {displayCityName}{weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
                  </p>
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 top-0 h-[58vh] rounded-b-[42px] bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.06)_52%,transparent)] pointer-events-none" />

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
                <button onClick={toggleSummary} className="w-full flex flex-col items-center pt-2.5 pb-1.5 gap-1">
                  <div className="w-10 h-1 rounded-full bg-border" />
                  {!summaryOpen && (
                    <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                      <ChevronLeft className="w-3 h-3 rotate-90" />
                      {showingUpcomingEvents ? t("home_upcoming_activities") : t("day_today")}
                    </p>
                  )}
                </button>
                {summaryOpen && (
                  <div className="px-5 flex items-center justify-between mb-2 cursor-pointer" onClick={toggleSummary}>
                    <p className="text-sm font-bold text-foreground">
                      {showingUpcomingEvents ? t("home_upcoming_activities") : t("day_today")}
                    </p>
                  </div>
                )}

                {summaryEvents.length === 0 ? (
                  <div className="px-5 pb-4 pt-1">
                    <p className="text-sm font-semibold text-foreground">{t("home_nothing_today")}</p>
                    {formatDayWeatherSummary(hourlyWeather, summaryEvents, t) && (
                      <p className="mt-1 text-xs text-muted-foreground">{formatDayWeatherSummary(hourlyWeather, summaryEvents, t)}</p>
                    )}
                  </div>
                ) : (
                  <div className="px-5 pb-3 space-y-3">
                    {formatDayWeatherSummary(hourlyWeather, summaryEvents, t) && (
                      <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                        {formatDayWeatherSummary(hourlyWeather, summaryEvents, t)}
                      </p>
                    )}
                    {showingUpcomingEvents && (
                      <p className="text-sm font-semibold text-foreground">{t("home_nothing_today")}</p>
                    )}
                    {(() => {
                      const MAX_VISIBLE = 8;
                      const allEvents = groupedSummaryEvents.flatMap((g) => g.events);
                      const visibleEvents = showAllEvents ? allEvents : allEvents.slice(0, MAX_VISIBLE);
                      const hiddenCount = allEvents.length - MAX_VISIBLE;
                      const grouped = groupedSummaryEvents.map((group) => ({
                        ...group,
                        events: group.events.filter((e) => visibleEvents.includes(e)),
                      })).filter((g) => g.events.length > 0);
                      return (
                        <>
                          {grouped.map((group) => (
                            <div key={group.key} className="space-y-2">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                {group.label}
                              </p>
                              {group.events.map((event) => {
                          const style = getCategoryStyle(setup.categorySettings, event.category);
                          const meta = getCategoryMeta(setup.categorySettings, event.category);
                          const timeStr = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
                          const forecast = formatActivityWeather(hourlyWeather, event.date, t);
                          return (
                            <button
                              key={event.id}
                              type="button"
                              onClick={() => openCalendarEvent(event.id)}
                              className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left active:scale-[0.98] transition-transform ${style.card}`}
                              style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
                            >
                              {(() => {
                                const isOngoing = tracker.isRunning && activeScheduledEvent?.id === event.id;
                                return (
                                  <>
                                    <CategoryIcon icon={meta.icon} className={`text-lg leading-none flex-shrink-0 ${isOngoing ? "animate-pulse" : ""}`} />
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[13px] font-semibold truncate ${isOngoing ? "text-primary" : event.completed ? "line-through opacity-50 text-foreground" : "text-foreground"}`}>
                                        {getCategoryLabel(event.category, t)}
                                        {isOngoing && <span className="ml-1.5 text-[10px] font-medium text-primary/70">● en curso</span>}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">{timeStr}{event.endTime ? ` – ${event.endTime}` : ""}</p>
                                      {!event.completed && !isOngoing && forecast && <p className="text-[10px] text-muted-foreground truncate">{forecast}</p>}
                                    </div>
                                    {!isOngoing && event.completed && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                                  </>
                                );
                              })()}
                              <span className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="w-7 h-7 rounded-full bg-background/70 border border-border flex items-center justify-center">
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteEventPromptId(event.id);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter" && e.key !== " ") return;
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setDeleteEventPromptId(event.id);
                                  }}
                                  className="w-7 h-7 rounded-full bg-background/70 border border-border flex items-center justify-center"
                                  aria-label={t("home_delete_activity")}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </span>
                              </span>
                            </button>
                          );
                              })}
                            </div>
                          ))}
                          {!showAllEvents && hiddenCount > 0 && (
                            <button
                              onClick={() => setShowAllEvents(true)}
                              className="w-full py-2 text-xs font-semibold text-primary rounded-xl bg-primary/8 hover:bg-primary/12 transition-colors"
                            >
                              + {hiddenCount} {hiddenCount === 1 ? 'actividad más' : 'actividades más'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}

                <div className="px-5 pt-1 pb-6">
                  <button
                    onClick={() => navigate("calendar")}
                    className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20"
                  >
                    {t("home_add_activity")}
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
                  onClockOut={requestClockOut}
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
                    if (activeEntry.linkedEventId) {
                      calendar.updateEvent(activeEntry.linkedEventId, { date: startTime });
                    }
                  }}
                  calendarEvents={calendar.events}
                  activeCategory={activeEntry?.category}
                  activeEntryId={activeEntry?.id}
                  activeEntryStartTime={activeEntry?.startTime}
                  estudios={estudios.contacts.filter((c) => c.active)}
                  onDisplayCategoryChange={setTimerDisplayCategory}
                  onEstudioSession={estudios.addSession}
                  categoryConfigs={setup.categorySettings}
                  activityStartHour={setup.activityStartHour}
                  activityEndHour={setup.activityEndHour}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── CALENDAR TAB ── */}
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
                travelReminder={{
                  enabled: setup.travelTimeEnabled,
                  minutes: setup.travelTimeMinutes,
                }}
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

        {/* ── PROFILE TAB ── */}
        {activeTab === "profile" && (
          <div className="pb-24">
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-5 py-4">
              <div className="flex items-center gap-2.5">
                <MinistryMark size={28} />
                <h1 className="text-xl font-bold text-foreground">{t("nav_settings")}</h1>
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

        {/* ── ESTUDIOS (sub-página desde Perfil) ── */}
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

        {/* ── MAPA (keep-alive: monta al primer acceso, luego oculto en vez de desmontar) ── */}
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
          // Elimina el CalendarEvent anterior antes de reprogramar.
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

      {/* Timer overrun prompt */}
      {showTimerOverrunPrompt && activeScheduledEvent && (() => {
        const end = getEventEndDate(activeScheduledEvent);
        const endLabel = end ? formatTime(end, locale) : "";
        return (
          <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50">
            <div className="rounded-2xl border border-amber-500/30 bg-card p-4 shadow-xl">
              <div className="mb-3">
                <p className="text-sm font-bold text-foreground">{t("timer_overrun_title")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("timer_overrun_body", { category: getCategoryLabel(activeScheduledEvent.category, t), time: endLabel })}
                </p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
                <input
                  type="time"
                  value={timerOverrunSnoozeTime}
                  min={`${String(setup.activityStartHour).padStart(2, "0")}:00`}
                  max={`${String(setup.activityEndHour).padStart(2, "0")}:00`}
                  onChange={(e) => setTimerOverrunSnoozeTime(e.target.value)}
                  onBlur={() => setTimerOverrunSnoozeTime((value) => clampTimeValueToHourRange(value, setup.activityStartHour, setup.activityEndHour))}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  onClick={postponeTimerOverrunPrompt}
                  className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground"
                >
                  {t("timer_overrun_postpone")}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={stopActiveTimer}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
                >
                  {t("timer_overrun_stop")}
                </button>
                <button
                  onClick={() => setTimerOverrunDismissedId(activeScheduledEvent.id)}
                  className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground"
                >
                  {t("timer_overrun_keep_running")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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

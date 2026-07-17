import { lazy, Suspense, useMemo, useState, useEffect, useRef, startTransition } from "react";
import { MinistryMark } from "@/components/MinistryMark";
import { useTimeTracker, TimeEntry } from "@/hooks/useTimeTracker";
import { useCalendarEvents, EventCategory, AddEventParams } from "@/hooks/useCalendarEvents";
import { generateId } from "@/lib/uuid";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";
import { useSetup, SetupData } from "@/hooks/useSetup";
import { BottomNav, AppTab } from "@/components/BottomNav";
import { LanguageProvider, localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { detectLanguage, Lang } from "@/lib/i18n";
import { ChevronLeft, BookOpen, MapPin, Plus, Search } from "lucide-react";
import { hasActiveStudyWork, nearestPendingSession, useEstudios } from "@/hooks/useEstudios";
import {
  peekNotificationIntent,
  clearNotificationIntent,
  NOTIF_INTENT_EVENT,
  STUDY_ACTION_DONE,
  STUDY_ACTION_SKIP,
  type NotifIntent,
} from "@/lib/notifications";
import { useDarkMode } from "@/hooks/useDarkMode";
import { useSpecialCampaign } from "@/hooks/useSpecialCampaign";
import { useMonthlyReportCarryover } from "@/hooks/useMonthlyReportCarryover";
import { getCategoryMeta, getActiveCategoryConfigs } from "@/lib/categories";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { removeJsonValue } from "@/lib/jsonFileStorage";
import { findActiveScheduledEvent } from "@/lib/timerOverrun";
import { resolveEndDate } from "@/lib/eventTime";
import { consumeWidgetAction, setWidgetCategories } from "@/lib/timerNotification";
import { formatPlaceName } from "@/lib/placeNames";
import { formatDateLong } from "@/lib/dateFormat";
import { hexToRgba, getWeatherHeroTheme } from "@/lib/weatherUtils";
import { useWeather } from "@/hooks/useWeather";
import { useNotificationEffects } from "@/hooks/useNotificationEffects";
import { useSummarySheet } from "@/hooks/useSummarySheet";
import { AppDialogs } from "@/components/AppDialogs";
import { HomeTab } from "@/pages/tabs/HomeTab";
import { TimerTab } from "@/pages/tabs/TimerTab";
import { GlobalSearch } from "@/components/GlobalSearch";
import { ManualEntrySheet } from "@/components/ManualEntrySheet";
import { useAutoBackup } from "@/hooks/useAutoBackup";

const StatsView = lazy(() => import("@/components/StatsView").then((m) => ({ default: m.StatsView })));
const CalendarView = lazy(() => import("@/components/CalendarView").then((m) => ({ default: m.CalendarView })));
const EstudiosView = lazy(() => import("@/components/EstudiosView").then((m) => ({ default: m.EstudiosView })));
const LocationMap = lazy(() => import("@/components/LocationMap").then((m) => ({ default: m.LocationMap })));
const SettingsView = lazy(() => import("@/components/SettingsView").then((m) => ({ default: m.SettingsView })));
const SetupScreen = lazy(() => import("@/components/SetupScreen").then((m) => ({ default: m.SetupScreen })));

type Tab = AppTab;
type Category = EventCategory;
type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

const VALID_TABS = new Set<Tab>(["home", "summary", "timer", "calendar", "profile", "estudios", "map"]);

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
  const { isDark, toggle: toggleDark } = useDarkMode({
    autoDark: setup.autoDarkMode,
    city: setup.city,
  });

  // Accesibilidad: aplica/retira el modo de texto grande en la raíz del documento.
  useEffect(() => {
    document.documentElement.classList.toggle("text-large", !!setup.largeText);
  }, [setup.largeText]);

  // ── Navigation ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>("timer");
  const [timerDisplayCategory, setTimerDisplayCategory] = useState<Category>((setup.defaultCategory as Category) || "Predi");
  const [selectedStudySession, setSelectedStudySession] = useState<{ contactId: string; sessionId: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [manualEntryOpen, setManualEntryOpen] = useState(false);
  const [calendarFocusEventId, setCalendarFocusEventId] = useState<string | null>(null);
  const [calendarFocusMonthDate, setCalendarFocusMonthDate] = useState<Date | null>(null);

  // ── Summary sheet state ───────────────────────────────────────────────────────
  const [shortStopPrompt, setShortStopPrompt] = useState<{ customTime?: Date } | null>(null);
  const [deleteEventPromptId, setDeleteEventPromptId] = useState<string | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);
  const timerContentRef = useRef<HTMLDivElement>(null);

  // ── Data hooks ────────────────────────────────────────────────────────────────
  const tracker = useTimeTracker();
  const calendar = useCalendarEvents();
  const favorites = useFavoritePlaces();
  const estudios = useEstudios();
  const activeStudyCount = estudios.contacts.filter((c) => c.active).length;
  const campaign = useSpecialCampaign();
  // Estado del informe mensual: fuente única compartida por StatsView (envío)
  // y las notificaciones (para no recordar un informe ya enviado).
  const { carryover: reportCarryover, saveMonthlyReport } = useMonthlyReportCarryover();
  const { events: calendarEvents, markNotified, getEventsForDate } = calendar;
  const { justBacked } = useAutoBackup({ setup });

  const handleClearAll = () => {
    void removeJsonValue("time-entries").finally(() => window.location.reload());
  };

  const activeEntry = tracker.entries.find((e) => e.endTime === null);
  const defaultCenter = setup.city ?? undefined;
  const activeScheduledEvent = findActiveScheduledEvent(activeEntry, calendarEvents);

  // ── Timer handlers ────────────────────────────────────────────────────────────
  const completeClockOut = (customTime?: Date) => {
    tracker.clockOut((eventId, endTime) => calendar.updateEvent(eventId, { endTime, completed: true }), customTime);
  };

  // Al editar las horas de un evento del calendario (p.ej. reducir su
  // duración), sincroniza también la TimeEntry enlazada: las estadísticas
  // calculan el total a partir de las TimeEntries, no de los eventos.
  const handleUpdateCalendarEvent = (id: string, updates: Parameters<typeof calendar.updateEvent>[1]) => {
    calendar.updateEvent(id, updates);
    if (updates.date === undefined && updates.endTime === undefined) return;
    // Se busca el entry enlazado esté o no ya cerrado: si sigue abierto
    // (p.ej. quedó "colgado" por un desajuste de sincronización previo) y
    // aquí se le pone una hora de fin, hay que cerrarlo también — si no, el
    // Calendario cuenta esas horas (las lee de los eventos) pero el Resumen
    // nunca las ve (solo cuenta TimeEntries con endTime), y los totales del
    // mismo mes dejan de cuadrar entre las dos pantallas.
    const linkedEntry = tracker.entries.find((e) => e.linkedEventId === id);
    if (!linkedEntry) return;
    const newStart = updates.date ?? linkedEntry.startTime;
    if (typeof updates.endTime === "string" && updates.endTime) {
      // Si la hora de fin "parece" anterior a la de inicio, es que la
      // actividad cruza la medianoche (p.ej. empezó a las 22:00 y terminó a
      // las 02:00): se pasa al día siguiente en vez de recortar a +1h.
      const newEnd = resolveEndDate(newStart, updates.endTime) ?? new Date(newStart.getTime() + 60 * 60_000);
      tracker.updateEntryTimes(linkedEntry.id, newStart, newEnd);
    } else if (updates.date && linkedEntry.endTime) {
      const duration = linkedEntry.endTime.getTime() - linkedEntry.startTime.getTime();
      tracker.updateEntryTimes(linkedEntry.id, newStart, new Date(newStart.getTime() + duration));
    } else if (updates.date) {
      // Entry aún abierto y sin nueva hora de fin: solo se mueve el inicio.
      tracker.updateStartTime(linkedEntry.id, newStart);
    }
  };

  // Añadir actividad desde el Calendario. Una actividad PASADA (de un solo día)
  // debe crear tanto el evento como su TimeEntry enlazada: el Calendario lee de
  // los eventos, pero el Resumen/Home cuenta TimeEntries. Si solo se creara el
  // evento, la actividad aparecería en el Calendario pero NO sumaría en el
  // Resumen (era la causa del descuadre "el Calendario dice 15h y Home 9h").
  // Las actividades futuras o recurrentes siguen siendo solo eventos.
  const handleAddCalendarEvent = (params: AddEventParams) => {
    const end = resolveEndDate(params.date, params.endTime);
    const isPastCompleted =
      params.recurrence === "none" &&
      params.date.getTime() < Date.now() &&
      end !== null &&
      end.getTime() > params.date.getTime();
    if (!isPastCompleted) {
      calendar.addEvent(params);
      return;
    }
    const eventId = calendar.addCompletedEventNow({
      date: params.date,
      category: params.category,
      location: params.location,
    });
    if (eventId && params.endTime) calendar.updateEvent(eventId, { endTime: params.endTime });
    tracker.addManualEntry(params.date, end, params.category, params.notes ?? "", params.location, eventId);
  };

  // ── Reconciliación de arranque ────────────────────────────────────────────────
  // Repara datos ya existentes: por cada evento de calendario COMPLETADO con
  // duración pero sin una TimeEntry enlazada, crea la TimeEntry que falta. Así
  // el Resumen/Home (que cuenta TimeEntries) vuelve a cuadrar con el Calendario
  // (que cuenta eventos) para las actividades pasadas que se añadieron cuando
  // esa ruta aún no creaba la entrada. Se ejecuta una sola vez por sesión, ya
  // con ambos almacenes cargados, para no crear duplicados ni condiciones de
  // carrera con el fichaje en vivo.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (reconciledRef.current) return;
    if (!tracker.loaded || !calendar.loaded) return;
    reconciledRef.current = true;
    const linkedIds = new Set(
      tracker.entries.map((e) => e.linkedEventId).filter((id): id is string => !!id),
    );
    const missing: TimeEntry[] = [];
    for (const ev of calendarEvents) {
      if (!ev.completed || linkedIds.has(ev.id)) continue;
      const end = resolveEndDate(ev.date, ev.endTime);
      if (!end || end.getTime() <= ev.date.getTime()) continue;
      missing.push({
        id: generateId(),
        startTime: ev.date,
        endTime: end,
        description: ev.notes ?? "",
        category: ev.category,
        startLocation: ev.location ?? null,
        endLocation: null,
        linkedEventId: ev.id,
        pausedAt: null,
      });
    }
    if (missing.length > 0) tracker.importEntries(missing);
  }, [tracker.loaded, calendar.loaded, tracker, calendarEvents]);

  const requestClockOut = (customTime?: Date) => {
    if (!activeEntry) { completeClockOut(customTime); return; }
    const end = customTime ?? new Date();
    if (end.getTime() - activeEntry.startTime.getTime() < SHORT_ACTIVITY_MS) {
      setShortStopPrompt({ customTime });
      return;
    }
    completeClockOut(customTime);
  };

  const keepShortActivity = () => { completeClockOut(shortStopPrompt?.customTime); setShortStopPrompt(null); };
  const discardShortActivity = () => {
    if (!activeEntry) { setShortStopPrompt(null); return; }
    if (activeEntry.linkedEventId) calendar.deleteEvent(activeEntry.linkedEventId);
    tracker.deleteEntry(activeEntry.id);
    setShortStopPrompt(null);
  };
  const deleteEventIsRecurring = useMemo(() => {
    if (!deleteEventPromptId) return false;
    const ev = calendarEvents.find((e) => e.id === deleteEventPromptId);
    return ev ? ev.recurrence !== "none" : false;
  }, [deleteEventPromptId, calendarEvents]);

  const confirmDeleteEvent = (scope: "single" | "all" = "all") => {
    if (!deleteEventPromptId) return;
    const target = calendarEvents.find((e) => e.id === deleteEventPromptId);
    const idsToUnlink =
      target && scope === "all" && target.recurrence !== "none"
        ? (() => {
            const parentId = target.parentId || target.id;
            return calendarEvents.filter((e) => e.id === parentId || e.parentId === parentId).map((e) => e.id);
          })()
        : [deleteEventPromptId];
    // Las horas ya fichadas de un evento que se borra no deben perderse ni
    // quedar huérfanas apuntando a un evento inexistente.
    tracker.detachEntriesLinkedToEvents(idsToUnlink);
    calendar.deleteEvent(deleteEventPromptId, scope);
    setDeleteEventPromptId(null);
  };

  const todayKey = new Date().toDateString();
  const now = useMemo(() => new Date(todayKey), [todayKey]);
  // ── Notification effects ──────────────────────────────────────────────────────
  useNotificationEffects({
    calendarEvents,
    isTimerRunning: tracker.isRunning,
    markNotified,
    t,
    activeScheduledEvent: activeScheduledEvent ?? null,
    activeEntry: activeEntry ?? null,
    isPaused: tracker.isPaused,
    calMonthMs: tracker.monthTotal,
    precursorHours: setup.precursorHours,
    estudiosContacts: estudios.contacts,
    notifTimerOverrun: setup.notifTimerOverrun,
    notifTimer3h: setup.notifTimer3h,
    notifMonthlyGoal: setup.notifMonthlyGoal,
    notifUnlogged: setup.notifUnlogged,
    notifReport: setup.notifReport,
    reportCarryover,
    travelTimeEnabled: setup.travelTimeEnabled,
    travelTimeMinutes: setup.travelTimeMinutes,
  });

  // ── Widget: enviar categorías activas (botones ▶ del widget de escritorio) ────
  useEffect(() => {
    const active = getActiveCategoryConfigs(setup.categorySettings).map((c) => ({
      name: c.name,
      color: c.color,
    }));
    void setWidgetCategories(active);
  }, [setup.categorySettings]);

  // ── Widget action: arrancar/detener el timer desde el widget de escritorio ────
  // Mantenemos el handler en un ref para que el listener (montado una vez) use
  // siempre el estado fresco del tracker.
  const widgetActionRef = useRef<() => void>(() => {});
  widgetActionRef.current = () => {
    if (document.visibilityState !== 'visible') return;
    void consumeWidgetAction().then((actions) => {
      // El widget puede haber encolado varias acciones (p.ej. arranca y para
      // sin abrir nunca la app entre medio): se reproducen todas en orden.
      // `tracker.isRunning` no se actualiza hasta el siguiente render, así
      // que se lleva un flag local para saber si ya "arrancamos" dentro de
      // este mismo lote antes de decidir si un CLOCK_OUT tiene con qué parar.
      let localRunning = tracker.isRunning;
      let startedThisBatch = false;
      for (const raw of actions) {
        const [action, msStr, category] = raw.split('|');
        const ms = msStr ? Number(msStr) : NaN;
        const time = Number.isFinite(ms) ? new Date(ms) : undefined;
        if (action === 'CLOCK_IN') {
          if (!localRunning) {
            void tracker.clockIn(
              category || 'Predi',
              ({ date, category: cat, location }) =>
                calendar.addCompletedEventNow({ date, category: cat, location }),
              time,
            );
            localRunning = true;
            startedThisBatch = true;
          }
        } else if (action === 'CLOCK_OUT') {
          if (localRunning) {
            // Si el arranque también vino de este mismo lote, ya sabemos la
            // duración exacta por los timestamps del widget: se cierra
            // directo en vez de pasar por el prompt de "actividad corta"
            // (pensado para paradas en vivo, no para reproducir un ciclo ya
            // ocurrido por completo mientras la app estaba cerrada).
            if (startedThisBatch) completeClockOut(time);
            else requestClockOut(time);
            localRunning = false;
            startedThisBatch = false;
          }
        } else if (action === 'NAV' && msStr && VALID_TABS.has(msStr as Tab)) {
          // Atajos del icono de Android: abrir una pestaña concreta. Se valida
          // contra la lista de pestañas reales porque este valor llega desde un
          // extra de Intent que, en teoría, podría forjar otra app instalada
          // (MainActivity es exported=true, como toda activity launcher).
          navigate(msStr as Tab);
        }
      }
    });
  };
  useEffect(() => {
    const check = () => widgetActionRef.current();
    document.addEventListener('visibilitychange', check);
    // Comprobar también al montar (app abierta directamente por el widget)
    check();
    return () => document.removeEventListener('visibilitychange', check);
  }, []);

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

  // ── Summary sheet ─────────────────────────────────────────────────────────────
  const todayEventCount = summaryEvents.length;
  const {
    summaryOpen, setSummaryOpen,
    summaryDragOffset, summarySheetHeight,
    activeSummaryOffset, summarySheetRef,
    startDrag, moveDrag, endDrag, toggleSummary,
  } = useSummarySheet({ activeTab, todayEventCount, timerContentRef });

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

  // ── Notificaciones: actuar al pulsarlas ───────────────────────────────────────
  // En vez de abrir siempre la pantalla principal, una notificación abre la
  // pantalla que le corresponde (calendario, estudio, timer…). Los recordatorios
  // de estudio traen botones Sí/No: "Sí" marca la sesión como hecha sin abrir
  // nada; "No" sólo descarta el aviso; el tap del cuerpo abre el estudio.
  // Devuelve true si la intención quedó gestionada; false si hay que reintentar
  // (p. ej. los estudios aún no han cargado al abrir la app en frío).
  const handleNotifIntent = (intent: NotifIntent): boolean => {
    const { actionId, nav } = intent;
    if (!nav) return true;
    switch (nav.route) {
      case "study": {
        if (actionId === STUDY_ACTION_DONE || actionId === STUDY_ACTION_SKIP) {
          const contact = estudios.contacts.find((c) => c.id === nav.contactId);
          if (!contact) return false; // contactos aún sin cargar → reintentar
          const sessionId = nav.sessionId ?? nearestPendingSession(contact.sessions, Date.now())?.id;
          if (sessionId) {
            if (actionId === STUDY_ACTION_DONE) estudios.completeSession(nav.contactId, sessionId);
            else estudios.skipSession(nav.contactId, sessionId);
          }
          return true;
        }
        navigateToStudySession(nav.contactId, nav.sessionId ?? "");
        return true;
      }
      case "calendar":
        if (nav.eventId) openCalendarEvent(nav.eventId);
        else openMonthlyCalendar();
        return true;
      case "estudios":
        navigate("estudios");
        return true;
      case "timer":
        navigate("timer");
        return true;
      case "stats":
        navigate("home");
        return true;
      default:
        // Ruta desconocida (payload corrupto o de una versión futura/pasada):
        // se da por gestionada para no reintentar indefinidamente.
        return true;
    }
  };
  // El listener nativo puede dispararse en frío; mantenemos el handler en un ref
  // para usar siempre el estado fresco al consumir la intención pendiente.
  const notifIntentRef = useRef<() => void>(() => {});
  notifIntentRef.current = () => {
    const intent = peekNotificationIntent();
    if (intent && handleNotifIntent(intent)) clearNotificationIntent();
  };
  useEffect(() => {
    const check = () => notifIntentRef.current();
    document.addEventListener("visibilitychange", check);
    window.addEventListener(NOTIF_INTENT_EVENT, check);
    check(); // app abierta directamente por la notificación
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener(NOTIF_INTENT_EVENT, check);
    };
  }, []);
  // Reintenta cuando cambian los estudios: cubre el caso de abrir la app en frío
  // pulsando "Sí" antes de que los contactos terminen de cargar.
  useEffect(() => { notifIntentRef.current(); }, [estudios.contacts]);

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

      {/* Auto-backup toast */}
      {justBacked && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[150] max-w-xs w-max bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
          {t("backup_saved")}
        </div>
      )}

      {/* Global search overlay */}
      {searchOpen && (
        <GlobalSearch
          contacts={estudios.contacts}
          events={calendarEvents}
          onSelectContact={(contactId) => navigateToStudySession(contactId, "")}
          onSelectSession={navigateToStudySession}
          onSelectEvent={openCalendarEvent}
          onClose={() => setSearchOpen(false)}
          t={t}
          locale={locale}
        />
      )}

      {/* Search FAB — fixed within the max-w-md container */}
      {activeTab !== "timer" && (
        <div className="fixed top-0 left-0 right-0 max-w-md mx-auto z-[90] pointer-events-none">
          <div className="flex justify-end pr-3 pt-3">
            <button
              onClick={() => setSearchOpen(true)}
              aria-label={t("search_placeholder")}
              className="pointer-events-auto w-9 h-9 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center active:scale-95 transition-transform"
            >
              <Search className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Manual entry sheet — añadir horas pasadas o actividades futuras */}
      {manualEntryOpen && (
        <ManualEntrySheet
          categoryConfigs={setup.categorySettings}
          estudiosContacts={estudios.contacts.filter((c) => c.active).map((c) => ({ id: c.id, name: c.name }))}
          existingEntries={tracker.entries}
          onSavePast={(start, end, category, description, location) =>
            tracker.addManualEntry(start, end, category, description, location)
          }
          onSaveFuture={(params) => calendar.addEvent(params)}
          onClose={() => setManualEntryOpen(false)}
          t={t}
        />
      )}

      {/* Quick-add FAB — registrar horas con un toque desde Inicio/Estadísticas */}
      {(activeTab === "home" || activeTab === "summary") && (
        <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto z-[90] pointer-events-none">
          <div className="flex justify-end pr-4">
            <button
              onClick={() => setManualEntryOpen(true)}
              aria-label={t("manual_entry_title")}
              className="pointer-events-auto w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/30 flex items-center justify-center active:scale-90 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}

      <main className={`${!isOnline ? "pt-7" : ""} ${activeTab === "timer" ? "" : "pb-24"}`}>

        {/* ── HOME (Inicio: timer + Mis horas unificados) ── */}
        {activeTab === "home" && (
          <HomeTab
            greeting={greeting}
            userName={userName}
            displayCityName={displayCityName}
            weather={weather}
            heroTheme={heroTheme}
            setup={setup}
            timerIsRunning={tracker.isRunning}
            timerElapsed={tracker.elapsed}
            timerCategory={activeEntry?.category}
            onNavigateToTimer={() => navigate("timer")}
            t={t}
            statsSlot={
              <Suspense fallback={<TabLoading />}>
                <StatsView
                  entries={tracker.monthEntries}
                  allEntries={tracker.entries}
                  precursorHours={setup.precursorHours}
                  specialCampaignGoals={campaign.goals}
                  onSetSpecialCampaign={campaign.setGoal}
                  categoryConfigs={setup.categorySettings}
                  carryover={reportCarryover}
                  onSaveMonthlyReport={saveMonthlyReport}
                  reportRounding={setup.monthlyReportRounding}
                />
              </Suspense>
            }
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
                precursorHours={setup.precursorHours}
                specialCampaignGoals={campaign.goals}
                onSetSpecialCampaign={campaign.setGoal}
                categoryConfigs={setup.categorySettings}
                studyCount={activeStudyCount}
                onOpenStudies={() => navigate("estudios")}
                carryover={reportCarryover}
                onSaveMonthlyReport={saveMonthlyReport}
                reportRounding={setup.monthlyReportRounding}
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
            onUpdateEstudioNotes={(contactId, sessionId, notes) => {
              const contact = estudios.contacts.find((c) => c.id === contactId);
              const session = contact?.sessions.find((s) => s.id === sessionId);
              if (!contact || !session) return;
              estudios.updateSession(contactId, sessionId, {
                date: session.date.split("T")[0],
                time: session.time ?? "10:00",
                lesson: session.lesson,
                notes: notes || undefined,
                files: session.files ?? [],
              });
            }}
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
                onAddEvent={handleAddCalendarEvent}
                onDeleteEvent={calendar.deleteEvent}
                onToggleCompleted={calendar.toggleEventCompleted}
                onUpdateEvent={handleUpdateCalendarEvent}
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
                timeEntryMonthTotalMs={tracker.monthTotal}
                timeEntries={tracker.entries}
                onDeleteEntry={tracker.deleteEntry}
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
            <div className="px-5 pt-5 mb-4">
              <button
                onClick={() => navigate("map")}
                className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm active:scale-[0.98] text-left"
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
                firstEntryDate={tracker.entries.length > 0
                  ? new Date(Math.min(...tracker.entries.map((e) => new Date(e.startTime).getTime())))
                  : null
                }
                onClearAll={handleClearAll}
                setup={setup}
                onSaveSetup={saveSetup}
                isDark={isDark}
                onToggleDark={toggleDark}
                autoDarkMode={setup.autoDarkMode}
                onToggleAutoDark={() => saveSetup({ autoDarkMode: !setup.autoDarkMode })}
                hasActiveStudies={estudios.contacts.some(hasActiveStudyWork)}
              />
            </Suspense>
          </div>
        )}

        {/* ── ESTUDIOS ── */}
        {activeTab === "estudios" && (
          <>
            <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border px-4 py-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-foreground">{t("nav_studies")}</h1>
                <MinistryMark size={32} />
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
                onCompleteSessionNow={estudios.completeSessionNow}
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
                    cityName={displayCityName}
                  />
                </Suspense>
              </div>
            </>
          )}
        </div>
      </main>


      <AppDialogs
        shortStopPrompt={shortStopPrompt}
        onShortStopClose={() => setShortStopPrompt(null)}
        onKeepShortActivity={keepShortActivity}
        onDiscardShortActivity={discardShortActivity}
        deleteEventPromptId={deleteEventPromptId}
        deleteEventIsRecurring={deleteEventIsRecurring}
        onDeleteEventClose={() => setDeleteEventPromptId(null)}
        onConfirmDeleteEvent={confirmDeleteEvent}
        t={t}
      />

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

  // Mientras se cargan los datos, mostramos una pantalla idéntica al splash
  // (logo sobre el mismo fondo, sin texto) para que la transición sea invisible
  // y la app sólo aparezca una vez lista.
  if (!storage.ready || setupLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "#f5f7fa" }}
      >
        <img src="/favicon.svg" alt="" className="w-24 h-24" draggable={false} />
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

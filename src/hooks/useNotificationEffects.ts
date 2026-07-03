import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import type { EstudioContact } from "@/hooks/useEstudios";
import { isStalePendingSession, isSessionDone } from "@/hooks/useEstudios";
import { scheduleEventNotification, cancelEventNotification, registerStudyActionType, STUDY_ACTION_TYPE } from "@/lib/notifications";
import { getEventEndDate } from "@/lib/timerOverrun";
import { timerLongRunFireAt, currentMonthKey, nextReportPrepareAt, nextReportDeliverAt, reportReminderMonthKey, missedStudyFireAt, unloggedFireAt, goalReminderFireAt, forgottenFireAt, hasUpcomingSession, lastStudyActivityDate, nextWeekdayAt } from "@/lib/notificationRules";
import type { MonthlyReportCarryoverState } from "@/lib/monthlyReport";
import { getCategoryLabel } from "@/lib/categories";
import { startTimerNotification, stopTimerNotification, pauseTimerNotification } from "@/lib/timerNotification";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface UseNotificationEffectsParams {
  calendarEvents: CalendarEvent[];
  isTimerRunning: boolean;
  markNotified: (id: string) => void;
  t: TranslateFn;
  activeScheduledEvent: CalendarEvent | null;
  activeEntry: TimeEntry | null;
  isPaused: boolean;
  calMonthMs: number;
  precursorHours: number | null;
  estudiosContacts: EstudioContact[];
  // User preferences
  notifTimerOverrun: boolean;
  notifTimer3h: boolean;
  notifMonthlyGoal: boolean;
  notifUnlogged: boolean;
  notifReport: boolean;
  // Estado del informe mensual: para saber si ya se envió el de este mes.
  reportCarryover: MonthlyReportCarryoverState;
  // Travel time for overrun threshold
  travelTimeEnabled: boolean;
  travelTimeMinutes: number;
}

export function useNotificationEffects({
  calendarEvents,
  isTimerRunning,
  markNotified,
  t,
  activeScheduledEvent,
  activeEntry,
  isPaused,
  calMonthMs,
  precursorHours,
  estudiosContacts,
  notifTimerOverrun,
  notifTimer3h,
  notifMonthlyGoal,
  notifUnlogged,
  notifReport,
  reportCarryover,
  travelTimeEnabled,
  travelTimeMinutes,
}: UseNotificationEffectsParams) {
  const scheduledEventFireTimes = useRef<Map<string, number>>(new Map());
  const timer3hRef = useRef<string | null>(null);
  const overrunScheduledKey = useRef<string | null>(null);
  const reportPrepareRef = useRef<number | null>(null);
  const reportDeliverRef = useRef<number | null>(null);
  // Mes (YYYY-MM) para el que ya se disparó el aviso inmediato de informe en
  // esta apertura de la app; se reinicia solo al recargar (nuevo montaje).
  const reportOpenFiredRef = useRef<string | null>(null);
  // Horas de disparo ya programadas, para no reprogramar si no cambian.
  const missedStudyFireRef = useRef<Map<string, number>>(new Map());
  const unloggedFireRef = useRef<Map<string, number>>(new Map());
  const forgottenFireRef = useRef<Map<string, number>>(new Map());
  const studyFixedFireRef = useRef<Map<string, number>>(new Map());
  const goalReminderRef = useRef<string | null>(null);
  // Rastrea el estado pending anterior de cada sesión para detectar
  // cuándo pasa de pendiente → completada y cancelar su notificación.
  const sessionPendingRef = useRef<Map<string, boolean>>(new Map());

  // ── Registrar botones Sí/No para los recordatorios de estudio ──────────────
  useEffect(() => {
    void registerStudyActionType(t("notif_action_yes"), t("notif_action_no"));
  }, [t]);

  // ── Schedule / cancel native event reminders ────────────────────────────────
  // Nota: scheduledEventFireTimes es in-memory y se vacía al reiniciar la app.
  // Para garantizar que los eventos completados/notificados cancelen su
  // notificación nativa incluso tras un reinicio, llamamos a
  // cancelEventNotification para todos ellos (la función es barata porque
  // comprueba el mapa persistido en localStorage antes de llamar al plugin).
  useEffect(() => {
    const now = Date.now();
    const liveReminderIds = new Set<string>();

    calendarEvents.forEach((event) => {
      if (event.completed || event.notified) {
        // Cancelar la notificación nativa aunque el ref esté vacío (reinicio de app)
        void cancelEventNotification(event.id);
        scheduledEventFireTimes.current.delete(event.id);
        // Un evento completado ya no necesita el aviso de "sin fichar".
        void cancelEventNotification(`unlogged-${event.id}`);
        unloggedFireRef.current.delete(event.id);
        return;
      }

      // Nunca se pueden hacer dos eventos en paralelo: si ahora mismo ya se
      // está haciendo OTRA actividad, no tiene sentido avisar de que este
      // evento va a empezar. Se cancela y se reevalúa en cuanto quede libre
      // (si su hora aún no ha pasado, se reprogramará entonces).
      if (isTimerRunning && activeScheduledEvent?.id !== event.id) {
        void cancelEventNotification(event.id);
        scheduledEventFireTimes.current.delete(event.id);
        return;
      }

      const reminder = event.reminderMinutesBefore ?? 0;
      const reminderAtMs = event.date.getTime() - reminder * 60_000;
      const startMs = event.date.getTime();
      const fireAtMs = reminderAtMs > now ? reminderAtMs : startMs;
      if (fireAtMs <= now) return;
      const fireAt = new Date(fireAtMs);
      liveReminderIds.add(event.id);

      if (scheduledEventFireTimes.current.get(event.id) === fireAtMs) return;

      void scheduleEventNotification(
        event.id,
        t("notif_activity_upcoming"),
        t("notif_activity_upcoming_body", { category: getCategoryLabel(event.category, t) }),
        fireAt,
        { extra: { route: "calendar", eventId: event.id } },
      ).then((scheduled) => {
        if (scheduled) scheduledEventFireTimes.current.set(event.id, fireAtMs);
        else if (scheduledEventFireTimes.current.get(event.id) === fireAtMs)
          scheduledEventFireTimes.current.delete(event.id);
      });
    });

    // Cancelar recordatorios de eventos que ya no existen
    scheduledEventFireTimes.current.forEach((_, id) => {
      if (!liveReminderIds.has(id)) {
        void cancelEventNotification(id);
        scheduledEventFireTimes.current.delete(id);
      }
    });
  }, [calendarEvents, isTimerRunning, activeScheduledEvent, t]);

  // ── Timer overrun → notificación nativa ────────────────────────────────────
  useEffect(() => {
    if (!notifTimerOverrun || !activeEntry || !activeScheduledEvent) {
      if (overrunScheduledKey.current) {
        void cancelEventNotification("timer-overrun");
        overrunScheduledKey.current = null;
      }
      return;
    }

    const key = `${activeEntry.id}:${activeScheduledEvent.id}`;
    if (overrunScheduledKey.current === key) return;
    overrunScheduledKey.current = key;

    const end = getEventEndDate(activeScheduledEvent);
    if (!end) return;

    const travelMs = travelTimeEnabled ? travelTimeMinutes * 60_000 : 0;
    const fireAt = new Date(end.getTime() + travelMs);

    // Programar para la hora exacta o, si ya pasó, disparar en 1 s
    void scheduleEventNotification(
      "timer-overrun",
      t("timer_overrun_title"),
      t("timer_overrun_notification_body", { category: getCategoryLabel(activeScheduledEvent.category, t) }),
      fireAt.getTime() > Date.now() ? fireAt : new Date(Date.now() + 1_000),
      { extra: { route: "timer" } },
    );
  }, [activeEntry, activeScheduledEvent, notifTimerOverrun, t, travelTimeEnabled, travelTimeMinutes]);

  // ── Timer activo > 3h ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!notifTimer3h) return;

    if (!activeEntry) {
      if (timer3hRef.current) {
        void cancelEventNotification("timer-3h");
        timer3hRef.current = null;
      }
      return;
    }
    if (timer3hRef.current === activeEntry.id) return;
    timer3hRef.current = activeEntry.id;

    void scheduleEventNotification(
      "timer-3h",
      t("notif_timer_3h_title"),
      t("notif_timer_3h_body"),
      timerLongRunFireAt(activeEntry.startTime),
      { extra: { route: "timer" } },
    );
  }, [activeEntry, notifTimer3h, t]);

  // ── Notificación persistente mientras el timer está activo ─────────────────
  // En pausa se congela (no se vuelve a llamar a start con el mismo startTime,
  // que dejaría el cronómetro nativo del widget/notificación avanzando aunque
  // la app muestre el timer parado); al reanudar, activeEntry.startTime ya
  // llega desplazado por el tiempo en pausa, así que un start normal reanuda
  // el conteo nativo en el punto correcto.
  useEffect(() => {
    if (!activeEntry) {
      void stopTimerNotification();
      return;
    }
    if (isPaused) {
      const elapsedMs = activeEntry.pausedAt
        ? activeEntry.pausedAt.getTime() - activeEntry.startTime.getTime()
        : 0;
      void pauseTimerNotification(
        elapsedMs,
        t("notif_timer_paused_title"),
        getCategoryLabel(activeEntry.category, t),
      );
      return;
    }
    void startTimerNotification(
      activeEntry.startTime,
      t("notif_timer_running_title"),
      t("notif_timer_running_body", { category: getCategoryLabel(activeEntry.category, t) }),
      getCategoryLabel(activeEntry.category, t),
    );
    return () => { void stopTimerNotification(); };
  }, [activeEntry, isPaused, t]);

  // ── Cancelar notificación cuando una sesión pasa de pendiente → completada ──
  useEffect(() => {
    const prevMap = sessionPendingRef.current;
    for (const contact of estudiosContacts) {
      for (const session of contact.sessions ?? []) {
        const wasPending = prevMap.get(session.id);
        // Si antes estaba pendiente y ahora no → se acaba de completar
        if (wasPending === true && !session.pending) {
          void cancelEventNotification(`missed-study-${session.id}`);
        }
        prevMap.set(session.id, session.pending ?? false);
      }
    }
  }, [estudiosContacts]);

  // ── Estudios perdidos → alarma nativa a la hora de la sesión + margen ──────
  // Programamos la alarma para la fecha/hora futura de la sesión pendiente, de
  // modo que salte aunque la app esté cerrada. Si la sesión ya venció mientras la
  // app estaba cerrada, disparamos una vez al abrir (guarda en localStorage).
  useEffect(() => {
    const now = Date.now();
    const live = new Set<string>();
    // Si ahora mismo se está estudiando (timer activo en categoría Estudio), no
    // tiene sentido avisar de sesiones pendientes: se cancelan mientras dure y se
    // reevalúan en cuanto el timer se detenga o la sesión se marque como hecha.
    const studyingNow = isTimerRunning && activeEntry?.category === "Estudio";
    for (const contact of estudiosContacts) {
      if (!contact.active) continue;
      for (const session of contact.sessions ?? []) {
        if (!session.pending) continue;
        if (isStalePendingSession(contact, session, now)) continue;
        if (studyingNow) continue;
        const id = `missed-study-${session.id}`;
        const fireAtMs = missedStudyFireAt(new Date(session.date)).getTime();
        const isToday = now - new Date(session.date).getTime() < 24 * 3_600_000;
        const body = t(isToday ? "notif_study_missed_today" : "notif_study_missed_week", { name: contact.name });
        const opts = {
          actionTypeId: STUDY_ACTION_TYPE,
          extra: { route: "study" as const, contactId: contact.id, sessionId: session.id },
        };

        if (fireAtMs > now) {
          live.add(id);
          if (missedStudyFireRef.current.get(id) === fireAtMs) continue;
          void scheduleEventNotification(id, t("notif_study_missed_title"), body, new Date(fireAtMs), opts)
            .then((ok) => { if (ok) missedStudyFireRef.current.set(id, fireAtMs); });
        } else {
          // Ya venció: dispara una sola vez al abrir la app.
          const key = `_ml_missed_${session.id}`;
          try { if (localStorage.getItem(key)) continue; } catch { continue; }
          try { localStorage.setItem(key, "1"); } catch { /* nada */ }
          void scheduleEventNotification(id, t("notif_study_missed_title"), body, new Date(Date.now() + 2_000), opts);
        }
      }
    }
    // Cancelar alarmas de sesiones que ya no están pendientes/activas.
    missedStudyFireRef.current.forEach((_, id) => {
      if (!live.has(id)) {
        void cancelEventNotification(id);
        missedStudyFireRef.current.delete(id);
      }
    });
  }, [estudiosContacts, isTimerRunning, activeEntry, t]);

  // ── Notificaciones semanales de estudio ────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isTimerRunning) return;

    const now = Date.now();
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setHours(0, 0, 0, 0);
    const dow = weekStart.getDay();
    weekStart.setDate(weekStart.getDate() - (dow === 0 ? 6 : dow - 1));
    const weekStartMs = weekStart.getTime();
    const weekKey = weekStart.toDateString();

    const nextSundayEvening = (): Date => {
      const d = new Date();
      d.setHours(20, 0, 0, 0);
      const d2 = d.getDay();
      d.setDate(d.getDate() + (d2 === 0 ? 0 : 7 - d2));
      if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 7);
      return d;
    };

    estudiosContacts.forEach((contact) => {
      const fixedId = `study-fixed-${contact.id}`;
      const flexId = `study-flex-${contact.id}`;

      if (!contact.active || !contact.schedule) {
        void cancelEventNotification(fixedId);
        void cancelEventNotification(flexId);
        studyFixedFireRef.current.delete(fixedId);
        return;
      }

      const { schedule } = contact;
      const lastDone = contact.sessions
        .filter(isSessionDone)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;
      const lessonSuffix = lastDone?.lesson
        ? t("notif_study_ctx_lesson").replace("{lesson}", lastDone.lesson)
        : "";

      if (schedule.dayOfWeek !== undefined) {
        void cancelEventNotification(flexId);
        // Si ya se estudió en algún día de esta semana (no solo hoy), no hace
        // falta recordar en esta ocurrencia del día fijo.
        const doneThisWeek = contact.sessions.some(
          (s) => !s.pending && new Date(s.date).getTime() >= weekStartMs
        );
        if (doneThisWeek) {
          void cancelEventNotification(fixedId);
          studyFixedFireRef.current.delete(fixedId);
          return;
        }
        // Programa la PRÓXIMA ocurrencia del día fijo + 90 min (futuro), para que
        // salte ese día aunque la app esté cerrada.
        const fireAtMs = nextWeekdayAt(schedule.dayOfWeek, schedule.time, today).getTime() + 90 * 60_000;
        if (studyFixedFireRef.current.get(fixedId) === fireAtMs) return;
        void scheduleEventNotification(
          fixedId,
          t("notif_study_missed_title"),
          t("notif_study_missed_today", { name: contact.name }) + lessonSuffix,
          new Date(fireAtMs),
          {
            actionTypeId: STUDY_ACTION_TYPE,
            extra: { route: "study", contactId: contact.id },
          },
        ).then((ok) => { if (ok) studyFixedFireRef.current.set(fixedId, fireAtMs); });
      } else {
        void cancelEventNotification(fixedId);
        const doneThisWeek = contact.sessions.some(
          (s) => !s.pending && new Date(s.date).getTime() >= weekStartMs
        );
        if (doneThisWeek) { void cancelEventNotification(flexId); return; }
        const storageKey = `_sn_flex_${contact.id}_${weekKey}`;
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "1");
        void scheduleEventNotification(
          flexId,
          t("notif_study_missed_title"),
          t("notif_study_missed_week", { name: contact.name }) + lessonSuffix,
          nextSundayEvening(),
          {
            actionTypeId: STUDY_ACTION_TYPE,
            extra: { route: "study", contactId: contact.id },
          },
        );
      }
    });
  }, [estudiosContacts, isTimerRunning, t]);

  // ── Contactos olvidados (sin cita en >14 días) ─────────────────────────────
  // Una alarma nativa por contacto, programada a "última actividad + 14 días",
  // para que salte aunque la app esté cerrada. Se cancela si el contacto pasa a
  // inactivo o gana una cita futura.
  useEffect(() => {
    const now = Date.now();
    const live = new Set<string>();
    for (const contact of estudiosContacts) {
      const id = `forgotten-${contact.id}`;
      if (!contact.active || hasUpcomingSession(contact)) continue; // se limpia abajo
      live.add(id);
      const fireAtMs = forgottenFireAt(lastStudyActivityDate(contact)).getTime();
      const body = t("notif_study_reminder_body", { name: contact.name });

      if (fireAtMs > now) {
        if (forgottenFireRef.current.get(id) === fireAtMs) continue;
        void scheduleEventNotification(id, t("notif_study_reminder_title"), body, new Date(fireAtMs), { extra: { route: "estudios" } })
          .then((ok) => { if (ok) forgottenFireRef.current.set(id, fireAtMs); });
      } else {
        // Ya lleva >14 días olvidado: dispara una vez al día al abrir la app.
        const key = `_ml_forgotten_${contact.id}_${new Date().toDateString()}`;
        try { if (localStorage.getItem(key)) continue; } catch { continue; }
        try { localStorage.setItem(key, "1"); } catch { /* nada */ }
        void scheduleEventNotification(id, t("notif_study_reminder_title"), body, new Date(Date.now() + 2_000), { extra: { route: "estudios" } });
      }
    }
    // Cancelar los que ya no aplican (inactivos o con cita futura).
    forgottenFireRef.current.forEach((_, id) => {
      if (!live.has(id)) {
        void cancelEventNotification(id);
        forgottenFireRef.current.delete(id);
      }
    });
  }, [estudiosContacts, t]);

  // ── Actividad del calendario que pasó sin fichar ───────────────────────────
  // Alarma nativa a "hora del evento + 30 min" para que salte aunque la app esté
  // cerrada. Se cancela al completar el evento (ver limpieza arriba). Solo se
  // programan eventos dentro de una ventana próxima para acotar el número de
  // alarmas pendientes de Android.
  useEffect(() => {
    if (!notifUnlogged) {
      unloggedFireRef.current.forEach((_, id) => void cancelEventNotification(`unlogged-${id}`));
      unloggedFireRef.current.clear();
      return;
    }
    const UNLOGGED_WINDOW_MS = 7 * 24 * 3_600_000;
    const now = Date.now();
    const live = new Set<string>();
    for (const event of calendarEvents) {
      if (event.completed) continue;
      if (activeScheduledEvent?.id === event.id) continue;
      const fireAtMs = unloggedFireAt(event.date).getTime();
      if (fireAtMs - now > UNLOGGED_WINDOW_MS) continue; // demasiado lejos; ya se programará
      const time = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
      const body = t("notif_unlogged_body", { category: getCategoryLabel(event.category, t), time });

      if (fireAtMs > now) {
        live.add(event.id);
        if (unloggedFireRef.current.get(event.id) === fireAtMs) continue;
        void scheduleEventNotification(`unlogged-${event.id}`, t("notif_unlogged_title"), body, new Date(fireAtMs), { extra: { route: "calendar", eventId: event.id } })
          .then((ok) => { if (ok) unloggedFireRef.current.set(event.id, fireAtMs); });
      } else if (now - fireAtMs < 24 * 3_600_000) {
        // Pasó hace poco con la app cerrada: dispara una vez al abrir.
        const key = `_ml_unlogged_${event.id}`;
        try { if (localStorage.getItem(key)) continue; } catch { continue; }
        try { localStorage.setItem(key, "1"); } catch { /* nada */ }
        void scheduleEventNotification(`unlogged-${event.id}`, t("notif_unlogged_title"), body, new Date(Date.now() + 1_000), { extra: { route: "calendar", eventId: event.id } });
      }
    }
    // Cancelar los de eventos que ya no aplican.
    unloggedFireRef.current.forEach((_, id) => {
      if (!live.has(id)) {
        void cancelEventNotification(`unlogged-${id}`);
        unloggedFireRef.current.delete(id);
      }
    });
  }, [calendarEvents, activeScheduledEvent, notifUnlogged, t]);

  // ── Meta mensual ────────────────────────────────────────────────────────────
  // Recordatorio "vas por detrás": alarma nativa 5 días antes de fin de mes, para
  // que salte con la app cerrada; se cancela si alcanzas la meta. "Meta conseguida"
  // se mantiene inmediata a propósito: es el instante exacto de cruzarla al fichar
  // horas, algo que solo se detecta dentro de la app.
  useEffect(() => {
    const monthKey = currentMonthKey();
    const reminderId = `goal-reminder-${monthKey}`;
    const goalHours = precursorHours ?? 0;

    if (!notifMonthlyGoal || !goalHours) {
      void cancelEventNotification(reminderId);
      goalReminderRef.current = null;
      return;
    }

    const remainingHours = goalHours - calMonthMs / 3_600_000;

    // Meta conseguida → aviso inmediato una vez (excepción justificada).
    if (remainingHours <= 0) {
      void cancelEventNotification(reminderId);
      goalReminderRef.current = null;
      const key = `_ml_goal_reached_${monthKey}`;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
      void scheduleEventNotification(
        `goal-reached-${monthKey}`,
        t("notif_goal_reached_title"),
        t("notif_goal_reached_body"),
        new Date(Date.now() + 1_000),
        { extra: { route: "stats" } },
      );
      return;
    }

    // Casi lograda (≤2h) → no molestamos.
    if (remainingHours <= 2) {
      void cancelEventNotification(reminderId);
      goalReminderRef.current = null;
      return;
    }

    // Vas por detrás → recordatorio programado a futuro.
    const hoursLabel = String(Math.ceil(remainingHours));
    const fireAt = goalReminderFireAt();
    if (fireAt.getTime() > Date.now()) {
      const sig = `${fireAt.getTime()}:${hoursLabel}`;
      if (goalReminderRef.current === sig) return;
      goalReminderRef.current = sig;
      void scheduleEventNotification(
        reminderId,
        t("notif_goal_reminder_title"),
        t("notif_goal_reminder_body", { hours: hoursLabel, days: "5" }),
        fireAt,
        { extra: { route: "stats" } },
      );
    } else {
      // Ya en los últimos 5 días: dispara una vez al abrir la app.
      const key = `_ml_goal_reminder_${monthKey}`;
      try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { return; }
      const nowDate = new Date();
      const daysLeft = new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 0).getDate() - nowDate.getDate();
      void scheduleEventNotification(
        reminderId,
        t("notif_goal_reminder_title"),
        t("notif_goal_reminder_body", { hours: hoursLabel, days: String(daysLeft) }),
        new Date(Date.now() + 1_000),
        { extra: { route: "stats" } },
      );
    }
  }, [calMonthMs, notifMonthlyGoal, precursorHours, t]);

  // ── Recordatorio de informe mensual ────────────────────────────────────────
  // El informe se envía por el mes en curso, así que si ya está enviado (existe
  // registro para este mes) no molestamos. Si no, programamos dos alarmas fijas
  // que llegan con la app cerrada (último día y día 1 a las 9:00) y, además,
  // recordamos con la app abierta en cada apertura durante la ventana de 5 días
  // alrededor del cambio de mes.
  useEffect(() => {
    if (!notifReport) {
      void cancelEventNotification("report-prepare");
      void cancelEventNotification("report-deliver");
      reportPrepareRef.current = null;
      reportDeliverRef.current = null;
      reportOpenFiredRef.current = null;
      return;
    }

    const now = new Date();
    const monthKey = currentMonthKey(now);
    const alreadyReported = Boolean(reportCarryover.reports[monthKey]);

    if (alreadyReported) {
      void cancelEventNotification("report-prepare");
      void cancelEventNotification("report-deliver");
      reportPrepareRef.current = null;
      reportDeliverRef.current = null;
      reportOpenFiredRef.current = null;
      return;
    }

    // Aviso "prepara" — último día del mes a las 9:00.
    const prepareAtMs = nextReportPrepareAt(now).getTime();
    if (reportPrepareRef.current !== prepareAtMs) {
      reportPrepareRef.current = prepareAtMs;
      void scheduleEventNotification(
        "report-prepare",
        t("notif_report_prepare_title"),
        t("notif_report_prepare_body"),
        new Date(prepareAtMs),
        { extra: { route: "stats" } },
      );
    }

    // Aviso "envía" — día 1 del mes siguiente a las 9:00.
    const deliverAtMs = nextReportDeliverAt(now).getTime();
    if (reportDeliverRef.current !== deliverAtMs) {
      reportDeliverRef.current = deliverAtMs;
      void scheduleEventNotification(
        "report-deliver",
        t("notif_report_deliver_title"),
        t("notif_report_deliver_body"),
        new Date(deliverAtMs),
        { extra: { route: "stats" } },
      );
    }

    // Recordatorio inmediato cada vez que se abre la app dentro de la ventana de
    // 5 días (2 antes de fin de mes, el propio último día, y los 2 primeros días
    // del mes siguiente), mientras el informe de ese mes siga sin marcarse como
    // enviado. A diferencia de las alarmas fijas de arriba, este se dispara en
    // cada apertura (no solo una vez al día) y deja de hacerlo en cuanto
    // reportCarryover registra el informe de ese mes.
    const windowMonthKey = reportReminderMonthKey(now);
    if (windowMonthKey && !reportCarryover.reports[windowMonthKey]) {
      if (reportOpenFiredRef.current !== windowMonthKey) {
        reportOpenFiredRef.current = windowMonthKey;
        void scheduleEventNotification(
          "report-deliver-now",
          t("notif_report_deliver_title"),
          t("notif_report_deliver_body"),
          new Date(Date.now() + 1_000),
          { extra: { route: "stats" } },
        );
      }
    } else {
      reportOpenFiredRef.current = null;
    }
  }, [notifReport, reportCarryover, t]);

}

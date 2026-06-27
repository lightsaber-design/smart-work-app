import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import type { EstudioContact } from "@/hooks/useEstudios";
import { isStalePendingSession, isSessionDone } from "@/hooks/useEstudios";
import { scheduleEventNotification, cancelEventNotification, registerStudyActionType, STUDY_ACTION_TYPE } from "@/lib/notifications";
import { getEventEndDate } from "@/lib/timerOverrun";
import { timerLongRunFireAt, getGoalStatus, currentMonthKey, getForgottenContacts } from "@/lib/notificationRules";
import { getCategoryLabel } from "@/lib/categories";
import { startTimerNotification, stopTimerNotification } from "@/lib/timerNotification";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface UseNotificationEffectsParams {
  calendarEvents: CalendarEvent[];
  isTimerRunning: boolean;
  markNotified: (id: string) => void;
  t: TranslateFn;
  activeScheduledEvent: CalendarEvent | null;
  activeEntry: TimeEntry | null;
  calMonthMs: number;
  precursorHours: number | null;
  estudiosContacts: EstudioContact[];
  // User preferences
  notifTimerOverrun: boolean;
  notifTimer3h: boolean;
  notifMonthlyGoal: boolean;
  notifUnlogged: boolean;
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
  calMonthMs,
  precursorHours,
  estudiosContacts,
  notifTimerOverrun,
  notifTimer3h,
  notifMonthlyGoal,
  notifUnlogged,
  travelTimeEnabled,
  travelTimeMinutes,
}: UseNotificationEffectsParams) {
  const scheduledEventFireTimes = useRef<Map<string, number>>(new Map());
  const timer3hRef = useRef<string | null>(null);
  const overrunScheduledKey = useRef<string | null>(null);
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
  }, [calendarEvents, t]);

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
  useEffect(() => {
    if (!activeEntry) {
      void stopTimerNotification();
      return;
    }
    void startTimerNotification(
      activeEntry.startTime,
      t("notif_timer_running_title"),
      t("notif_timer_running_body", { category: getCategoryLabel(activeEntry.category, t) }),
      getCategoryLabel(activeEntry.category, t),
    );
    return () => { void stopTimerNotification(); };
  }, [activeEntry, t]);

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

  // ── Estudios perdidos → notificación una vez por sesión ───────────────────
  useEffect(() => {
    const now = Date.now();
    for (const contact of estudiosContacts) {
      if (!contact.active) continue;
      for (const session of contact.sessions ?? []) {
        if (!session.pending) continue;
        if (isStalePendingSession(contact, session, now)) continue;
        const sessionMs = new Date(session.date).getTime();
        if (now - sessionMs <= 5 * 60_000) continue; // aún no vencida
        const key = `_ml_missed_${session.id}`;
        try { if (localStorage.getItem(key)) continue; } catch { continue; }
        try { localStorage.setItem(key, "1"); } catch { /* nada */ }
        const isToday = now - sessionMs < 24 * 3_600_000;
        void scheduleEventNotification(
          `missed-study-${session.id}`,
          t("notif_study_missed_title"),
          t(isToday ? "notif_study_missed_today" : "notif_study_missed_week", { name: contact.name }),
          new Date(Date.now() + 2_000),
          {
            actionTypeId: STUDY_ACTION_TYPE,
            extra: { route: "study", contactId: contact.id, sessionId: session.id },
          },
        );
      }
    }
  }, [estudiosContacts, t]);

  // ── Notificaciones semanales de estudio ────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (isTimerRunning) return;

    const now = Date.now();
    const today = new Date();
    const todayStr = today.toDateString();
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
        if (today.getDay() !== schedule.dayOfWeek) return;
        const doneToday = contact.sessions.some(
          (s) => !s.pending && new Date(s.date).toDateString() === todayStr
        );
        if (doneToday) { void cancelEventNotification(fixedId); return; }
        const [h, m] = schedule.time.split(":").map(Number);
        const scheduledMs = new Date(today).setHours(h, m, 0, 0);
        if (now < scheduledMs + 90 * 60_000) return;
        const storageKey = `_sn_fixed_${contact.id}_${todayStr}`;
        if (localStorage.getItem(storageKey)) return;
        localStorage.setItem(storageKey, "1");
        void scheduleEventNotification(
          fixedId,
          t("notif_study_missed_title"),
          t("notif_study_missed_today", { name: contact.name }) + lessonSuffix,
          new Date(Date.now() + 1_000),
          {
            actionTypeId: STUDY_ACTION_TYPE,
            extra: { route: "study", contactId: contact.id },
          },
        );
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
  useEffect(() => {
    const forgotten = getForgottenContacts(estudiosContacts);
    if (forgotten.length === 0) return;

    const storageKey = `_ml_forgotten_${new Date().toDateString()}`;
    try { if (localStorage.getItem(storageKey)) return; } catch { return; }
    try { localStorage.setItem(storageKey, "1"); } catch { /* nada */ }

    const body =
      forgotten.length === 1
        ? t("notif_study_reminder_body", { name: forgotten[0].name })
        : t("notif_study_reminder_body_multi", { count: forgotten.length });

    void scheduleEventNotification(
      "forgotten-contacts",
      t("notif_study_reminder_title"),
      body,
      new Date(Date.now() + 2_000),
      { extra: { route: "estudios" } },
    );
  }, [estudiosContacts, t]);

  // ── Actividad del calendario que pasó sin fichar ───────────────────────────
  // Avisa una vez por evento cuando su hora pasó (margen 30 min) y sigue sin
  // completarse, dentro de las últimas 24 h para no arrastrar pendientes viejos.
  useEffect(() => {
    if (!notifUnlogged) return;
    const now = Date.now();
    for (const event of calendarEvents) {
      if (event.completed) continue;
      if (activeScheduledEvent?.id === event.id) continue;
      const sincePassed = now - event.date.getTime();
      if (sincePassed <= 30 * 60_000) continue;
      if (sincePassed >= 24 * 3_600_000) continue;
      const key = `_ml_unlogged_${event.id}`;
      try { if (localStorage.getItem(key)) continue; } catch { continue; }
      try { localStorage.setItem(key, "1"); } catch { /* nada */ }
      const time = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
      void scheduleEventNotification(
        `unlogged-${event.id}`,
        t("notif_unlogged_title"),
        t("notif_unlogged_body", { category: getCategoryLabel(event.category, t), time }),
        new Date(Date.now() + 1_000),
        { extra: { route: "calendar", eventId: event.id } },
      );
    }
  }, [calendarEvents, activeScheduledEvent, notifUnlogged, t]);

  // ── Meta mensual ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!notifMonthlyGoal) return;
    const goalHours = precursorHours ?? 0;
    if (!goalHours) return;
    const status = getGoalStatus(goalHours, calMonthMs);
    const monthKey = currentMonthKey();

    if (status.kind === "reached") {
      const key = `_ml_goal_reached_${monthKey}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      void scheduleEventNotification(
        `goal-reached-${monthKey}`,
        t("notif_goal_reached_title"),
        t("notif_goal_reached_body"),
        new Date(Date.now() + 1_000),
        { extra: { route: "stats" } },
      );
    } else if (status.kind === "reminder") {
      const key = `_ml_goal_reminder_${monthKey}`;
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
      void scheduleEventNotification(
        `goal-reminder-${monthKey}`,
        t("notif_goal_reminder_title"),
        t("notif_goal_reminder_body", {
          hours: String(Math.ceil(status.remainingHours)),
          days: String(status.daysLeft),
        }),
        new Date(Date.now() + 1_000),
        { extra: { route: "stats" } },
      );
    }
  }, [calMonthMs, notifMonthlyGoal, precursorHours, t]);

}

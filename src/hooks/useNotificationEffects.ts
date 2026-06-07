import { useEffect, useRef } from "react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import { scheduleEventNotification, cancelEventNotification } from "@/lib/notifications";
import { getEventEndDate } from "@/lib/timerOverrun";
import { timerLongRunFireAt, getGoalStatus, currentMonthKey } from "@/lib/notificationRules";
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
  // User preferences
  notifTimerOverrun: boolean;
  notifTimer3h: boolean;
  notifMonthlyGoal: boolean;
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
  notifTimerOverrun,
  notifTimer3h,
  notifMonthlyGoal,
  travelTimeEnabled,
  travelTimeMinutes,
}: UseNotificationEffectsParams) {
  const scheduledEventFireTimes = useRef<Map<string, number>>(new Map());
  const timer3hRef = useRef<string | null>(null);
  const overrunScheduledKey = useRef<string | null>(null);

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
    );
    return () => { void stopTimerNotification(); };
  }, [activeEntry, t]);

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
      );
    }
  }, [calMonthMs, notifMonthlyGoal, precursorHours, t]);

  // Referencia estable para markNotified (usado por efectos internos si fuera necesario)
  void isTimerRunning;
  void markNotified;
}

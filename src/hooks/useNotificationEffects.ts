import { useState, useEffect, useRef } from "react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import { showBrowserNotification, scheduleEventNotification, cancelEventNotification } from "@/lib/notifications";
import { shouldNotifyEvent } from "@/lib/eventReminders";
import { getEventEndDate } from "@/lib/timerOverrun";
import { timerLongRunFireAt, getGoalStatus, currentMonthKey } from "@/lib/notificationRules";
import { getCategoryLabel } from "@/lib/categories";

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
  const [overrunNotifiedId, setOverrunNotifiedId] = useState<string | null>(null);

  // ── Schedule native event reminders ────────────────────────────────────────
  useEffect(() => {
    const now = Date.now();
    const liveReminderIds = new Set<string>();

    calendarEvents.forEach((event) => {
      if (event.completed || event.notified) return;
      const reminder = event.reminderMinutesBefore ?? 0;
      const reminderAtMs = event.date.getTime() - reminder * 60_000;
      const startMs = event.date.getTime();
      // Si el recordatorio previo aún no pasó, se usa; si ya pasó (o no hay),
      // se programa para la hora del evento, siempre que siga en el futuro.
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

    // Cancel reminders for events that no longer exist or are completed
    scheduledEventFireTimes.current.forEach((_, id) => {
      if (!liveReminderIds.has(id)) {
        void cancelEventNotification(id);
        scheduledEventFireTimes.current.delete(id);
      }
    });
  }, [calendarEvents, t]);

  // ── Fallback periodic check (web / app open) ────────────────────────────────
  useEffect(() => {
    const hasPending = calendarEvents.some(
      (e) => !e.completed && !e.notified && Date.now() < e.date.getTime() + 5 * 60_000,
    );
    if (!hasPending) return;

    const check = () => {
      const now = Date.now();
      calendarEvents.forEach((event) => {
        if (!shouldNotifyEvent(now, event)) return;
        if (isTimerRunning) return;
        showBrowserNotification(t("notif_activity_upcoming"), {
          body: t("notif_activity_upcoming_body", { category: getCategoryLabel(event.category, t) }),
        });
        markNotified(event.id);
      });
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [calendarEvents, isTimerRunning, markNotified, t]);

  // ── Timer overrun → native notification ────────────────────────────────────
  useEffect(() => {
    if (!notifTimerOverrun || !activeEntry || !activeScheduledEvent) {
      if (overrunScheduledKey.current) {
        void cancelEventNotification("timer-overrun");
        overrunScheduledKey.current = null;
      }
      return;
    }

    const key = `${activeEntry.id}:${activeScheduledEvent.id}`;
    if (overrunScheduledKey.current === key) return; // already handled this pair
    overrunScheduledKey.current = key;

    const end = getEventEndDate(activeScheduledEvent);
    if (!end) return; // event has no explicit endTime → skip

    const travelMs = travelTimeEnabled ? travelTimeMinutes * 60_000 : 0;
    const fireAt = new Date(end.getTime() + travelMs);

    if (fireAt.getTime() > Date.now()) {
      // Schedule for exact time (native platforms deliver even with app closed)
      void scheduleEventNotification(
        "timer-overrun",
        t("timer_overrun_title"),
        t("timer_overrun_notification_body", { category: getCategoryLabel(activeScheduledEvent.category, t) }),
        fireAt,
      );
    } else if (overrunNotifiedId !== key) {
      // Already past overrun time when app opened → notify immediately
      showBrowserNotification(t("timer_overrun_title"), {
        body: t("timer_overrun_notification_body", { category: getCategoryLabel(activeScheduledEvent.category, t) }),
      });
      setOverrunNotifiedId(key);
    }
  }, [activeEntry, activeScheduledEvent, notifTimerOverrun, overrunNotifiedId, t, travelTimeEnabled, travelTimeMinutes]);

  // ── Timer active > 3h ───────────────────────────────────────────────────────
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
    // Web fallback: interval check
    const iv = setInterval(() => {
      if (Date.now() - activeEntry.startTime.getTime() >= 3 * 3_600_000) {
        showBrowserNotification(t("notif_timer_3h_title"), { body: t("notif_timer_3h_body") });
        clearInterval(iv);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [activeEntry, notifTimer3h, t]);

  // ── Monthly goal ────────────────────────────────────────────────────────────
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
      showBrowserNotification(t("notif_goal_reached_title"), { body: t("notif_goal_reached_body") });
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
  }, [calMonthMs, notifMonthlyGoal, precursorHours, t]);
}

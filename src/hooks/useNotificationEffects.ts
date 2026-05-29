import { useState, useEffect, useRef } from "react";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import type { EstudioContact } from "@/hooks/useEstudios";
import { showBrowserNotification, scheduleEventNotification, cancelEventNotification } from "@/lib/notifications";
import { shouldNotifyEvent } from "@/lib/eventReminders";
import { timerLongRunFireAt, getGoalStatus, getForgottenContacts, currentMonthKey } from "@/lib/notificationRules";
import { getCategoryLabel } from "@/lib/categories";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface UseNotificationEffectsParams {
  calendarEvents: CalendarEvent[];
  isTimerRunning: boolean;
  markNotified: (id: string) => void;
  t: TranslateFn;
  showTimerOverrunPrompt: boolean;
  activeScheduledEvent: CalendarEvent | null;
  activeEntry: TimeEntry | null;
  calMonthMs: number;
  precursorHours: number | null;
  estudiosContacts: EstudioContact[];
}

export function useNotificationEffects({
  calendarEvents,
  isTimerRunning,
  markNotified,
  t,
  showTimerOverrunPrompt,
  activeScheduledEvent,
  activeEntry,
  calMonthMs,
  precursorHours,
  estudiosContacts,
}: UseNotificationEffectsParams) {
  const [timerOverrunNotifiedId, setTimerOverrunNotifiedId] = useState<string | null>(null);
  const scheduledEventFireTimes = useRef<Map<string, number>>(new Map());
  const timer3hRef = useRef<string | null>(null);

  // Schedule native event reminders whenever calendarEvents changes
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
        fireAt,
      ).then((scheduled) => {
        if (scheduled) scheduledEventFireTimes.current.set(event.id, fireAtMs);
        else if (scheduledEventFireTimes.current.get(event.id) === fireAtMs) scheduledEventFireTimes.current.delete(event.id);
      });
    });

    scheduledEventFireTimes.current.forEach((_, id) => {
      if (!liveReminderIds.has(id)) {
        void cancelEventNotification(id);
        scheduledEventFireTimes.current.delete(id);
      }
    });
  }, [calendarEvents, t]);

  // Fallback periodic check when app is open (web / no native reminder)
  useEffect(() => {
    const hasPendingReminder = calendarEvents.some(
      (event) => !event.completed && !event.notified && Date.now() < event.date.getTime() + 5 * 60_000,
    );
    if (!hasPendingReminder) return;

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

  // Timer overrun notification
  useEffect(() => {
    if (!showTimerOverrunPrompt || !activeScheduledEvent || timerOverrunNotifiedId === activeScheduledEvent.id) return;
    showBrowserNotification(t("timer_overrun_title"), {
      body: t("timer_overrun_notification_body", { category: getCategoryLabel(activeScheduledEvent.category, t) }),
    });
    setTimerOverrunNotifiedId(activeScheduledEvent.id);
  }, [activeScheduledEvent, showTimerOverrunPrompt, t, timerOverrunNotifiedId]);

  // Rule 1: Active timer > 3h
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
    void scheduleEventNotification(
      "timer-3h",
      t("notif_timer_3h_title"),
      t("notif_timer_3h_body"),
      timerLongRunFireAt(activeEntry.startTime),
    );
    const iv = setInterval(() => {
      if (Date.now() - activeEntry.startTime.getTime() >= 3 * 3_600_000) {
        showBrowserNotification(t("notif_timer_3h_title"), { body: t("notif_timer_3h_body") });
        clearInterval(iv);
      }
    }, 60_000);
    return () => clearInterval(iv);
  }, [activeEntry, t]);

  // Rule 3: Monthly goal
  useEffect(() => {
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
  }, [calMonthMs, precursorHours, t]);

  // Rule 4: Contact without appointment > 14 days
  useEffect(() => {
    const key = `_ml_study_reminder_${new Date().toDateString()}`;
    if (localStorage.getItem(key)) return;
    const forgotten = getForgottenContacts(estudiosContacts);
    if (!forgotten.length) return;
    localStorage.setItem(key, "1");
    const body =
      forgotten.length === 1
        ? t("notif_study_reminder_body", { name: forgotten[0].name })
        : t("notif_study_reminder_body_multi", { count: String(forgotten.length) });
    showBrowserNotification(t("notif_study_reminder_title"), { body });
  }, [estudiosContacts, t]);
}

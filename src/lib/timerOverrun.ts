import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import { clampReminderMinutes } from "@/lib/eventReminders";

export function getEventEndDate(event: CalendarEvent): Date | null {
  if (!event.endTime) return null;
  const [hours, minutes] = event.endTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const end = new Date(event.date);
  end.setHours(hours, minutes, 0, 0);
  return end.getTime() > event.date.getTime() ? end : null;
}

function isSameDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

export function findActiveScheduledEvent(activeEntry: TimeEntry | undefined, events: CalendarEvent[]): CalendarEvent | null {
  if (!activeEntry || activeEntry.endTime) return null;

  return events
    .filter((event) => {
      const end = getEventEndDate(event);
      if (!end || event.completed || event.category !== activeEntry.category) return false;
      if (!isSameDay(event.date, activeEntry.startTime)) return false;
      return activeEntry.startTime.getTime() >= event.date.getTime() - 15 * 60_000 && activeEntry.startTime.getTime() <= end.getTime();
    })
    .sort((a, b) => Math.abs(a.date.getTime() - activeEntry.startTime.getTime()) - Math.abs(b.date.getTime() - activeEntry.startTime.getTime()))[0] ?? null;
}

export function shouldShowTimerOverrunPrompt(
  now: Date,
  event: CalendarEvent | null,
  travelTimeMinutes: number,
  snoozedUntilMs?: number
): boolean {
  if (!event) return false;
  if (snoozedUntilMs && now.getTime() < snoozedUntilMs) return false;
  const end = getEventEndDate(event);
  if (!end) return false;
  const dueMs = end.getTime() + clampReminderMinutes(travelTimeMinutes) * 60_000;
  return now.getTime() >= dueMs;
}

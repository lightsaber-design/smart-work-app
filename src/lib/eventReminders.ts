import type { CalendarEvent } from "@/hooks/useCalendarEvents";

export interface TravelReminderSettings {
  enabled: boolean;
  minutes: number;
}

function parseEndDate(event: CalendarEvent): Date {
  if (!event.endTime) return event.date;
  const [hours, minutes] = event.endTime.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return event.date;
  const end = new Date(event.date);
  end.setHours(hours, minutes, 0, 0);
  return end.getTime() >= event.date.getTime() ? end : event.date;
}

export function clampReminderMinutes(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(180, Math.max(0, Math.round(value)));
}

export function getTravelReminderMinutes(
  eventDate: Date,
  events: CalendarEvent[],
  settings: TravelReminderSettings
): number {
  const requested = settings.enabled ? clampReminderMinutes(settings.minutes) : 0;
  if (requested === 0) return 0;

  const previousEvent = events
    .filter((event) => event.date.toDateString() === eventDate.toDateString() && parseEndDate(event).getTime() <= eventDate.getTime())
    .sort((a, b) => parseEndDate(b).getTime() - parseEndDate(a).getTime())[0];

  if (!previousEvent) return requested;

  const gapMinutes = Math.floor((eventDate.getTime() - parseEndDate(previousEvent).getTime()) / 60_000);
  return Math.min(requested, Math.max(0, gapMinutes));
}

export function shouldNotifyEvent(nowMs: number, event: CalendarEvent): boolean {
  if (event.notified || event.completed) return false;
  const reminderAt = event.date.getTime() - clampReminderMinutes(event.reminderMinutesBefore) * 60_000;
  return nowMs >= reminderAt && nowMs < event.date.getTime() + 60_000;
}

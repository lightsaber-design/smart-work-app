import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import { clampReminderMinutes } from "@/lib/eventReminders";

const DEFAULT_EVENT_DURATION_MINUTES = 60;

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

function getEstimatedEventEndDate(event: CalendarEvent): Date {
  return getEventEndDate(event) ?? new Date(event.date.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60_000);
}

interface FindScheduledEventOptions {
  category?: CalendarEvent["category"];
  /** Evento ya enlazado a la actividad (p.ej. por linkedEventId): se acepta
   * aunque esté marcado como completado. */
  linkedEventId?: string;
}

/** Busca, entre los eventos del mismo día, el más cercano a `referenceTime`
 * dentro de la ventana [inicio-15min, fin estimado]. Puro, no muta. */
function findScheduledEventNear(
  referenceTime: Date,
  events: CalendarEvent[],
  options: FindScheduledEventOptions = {}
): CalendarEvent | null {
  return events
    .filter((event) => {
      const isLinkedEvent = options.linkedEventId !== undefined && options.linkedEventId === event.id;
      if (!isLinkedEvent && event.completed) return false;
      if (options.category !== undefined && event.category !== options.category) return false;
      if (!isSameDay(event.date, referenceTime)) return false;
      const end = getEstimatedEventEndDate(event);
      return referenceTime.getTime() >= event.date.getTime() - 15 * 60_000 && referenceTime.getTime() <= end.getTime();
    })
    .sort((a, b) => Math.abs(a.date.getTime() - referenceTime.getTime()) - Math.abs(b.date.getTime() - referenceTime.getTime()))[0] ?? null;
}

export function findScheduledEventForTimerStart(
  startTime: Date,
  category: CalendarEvent["category"],
  events: CalendarEvent[]
): CalendarEvent | null {
  return findScheduledEventNear(startTime, events, { category });
}

export function findScheduledEventAtTimerStart(startTime: Date, events: CalendarEvent[]): CalendarEvent | null {
  return findScheduledEventNear(startTime, events);
}

export function findActiveScheduledEvent(activeEntry: TimeEntry | undefined, events: CalendarEvent[]): CalendarEvent | null {
  if (!activeEntry || activeEntry.endTime) return null;
  return findScheduledEventNear(activeEntry.startTime, events, {
    category: activeEntry.category,
    linkedEventId: activeEntry.linkedEventId,
  });
}

export function shouldShowTimerOverrunPrompt(
  now: Date,
  event: CalendarEvent | null,
  travelTimeMinutes: number,
  snoozedUntilMs?: number
): boolean {
  if (!event) return false;
  if (snoozedUntilMs && now.getTime() < snoozedUntilMs) return false;
  const end = getEstimatedEventEndDate(event);
  const dueMs = end.getTime() + clampReminderMinutes(travelTimeMinutes) * 60_000;
  return now.getTime() >= dueMs;
}

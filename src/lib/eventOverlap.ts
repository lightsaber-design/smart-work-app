import { resolveEndDate } from "@/lib/eventTime";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

/**
 * Duración asumida para un evento sin hora de fin. Un evento programado sin fin
 * (o la actividad del timer que aún está en curso) ocupa al menos esta franja.
 */
const DEFAULT_EVENT_DURATION_MS = 60 * 60_000;

/** Fin del evento: el real si tiene `endTime`; si no, inicio + 1 h. */
export function estimatedEventEnd(event: CalendarEvent): Date {
  return resolveEndDate(event.date, event.endTime) ?? new Date(event.date.getTime() + DEFAULT_EVENT_DURATION_MS);
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

/** ¿Se solapan en el tiempo dos eventos del mismo día? */
export function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  if (!isSameCalendarDay(a.date, b.date)) return false;
  return a.date.getTime() < estimatedEventEnd(b).getTime() && estimatedEventEnd(a).getTime() > b.date.getTime();
}

/**
 * Un evento programado solo se puede descartar automaticamente si su hora de
 * inicio YA llego. Al futuro no se toca: sigue siendo el recordatorio de algo
 * que todavia piensas hacer, aunque ahora mismo estes fichando otra cosa.
 *
 * Sin esta regla, fichar a las 10:00 borraba en silencio el recordatorio de las
 * 10:30 que aun no habia llegado: al no saberse todavia cuanto va a durar la
 * actividad se asume una hora, y esa hora asumida se comia lo que venia detras.
 */
export function hasStarted(event: CalendarEvent, now = new Date()): boolean {
  return event.date.getTime() <= now.getTime();
}

/**
 * Una actividad REAL ya registrada (completada y con hora de fin fichada) que
 * cubre la franja de este evento programado.
 *
 * Los eventos programados son solo una REFERENCIA de lo que se pensaba hacer:
 * si a esa hora acabó ocurriendo una actividad de verdad —aunque sea de otra
 * categoría—, la referencia sobra. Sin esto seguía avisando ("va a empezar X",
 * "¿registraste X?") y se quedaba dibujada en el calendario como un segundo
 * cuadro encima de la actividad real.
 *
 * Se exige `endTime` para no confundir la propia actividad en curso del timer
 * (que se guarda completada pero todavía sin fin) con una actividad terminada.
 */
export function findLoggedActivityCovering(
  event: CalendarEvent,
  events: CalendarEvent[],
  now = new Date()
): CalendarEvent | null {
  if (event.completed) return null;
  if (!hasStarted(event, now)) return null;
  return (
    events.find(
      (other) => other.id !== event.id && other.completed && !!other.endTime && eventsOverlap(event, other)
    ) ?? null
  );
}

export function isCoveredByLoggedActivity(
  event: CalendarEvent,
  events: CalendarEvent[],
  now = new Date()
): boolean {
  return findLoggedActivityCovering(event, events, now) !== null;
}

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue } from "@/lib/jsonFileStorage";
import { useDebouncedJsonWriter } from "@/hooks/useDebouncedJsonWriter";
import { clampReminderMinutes } from "@/lib/eventReminders";
import { findScheduledEventAtTimerStart, findScheduledEventForTimerStart } from "@/lib/timerOverrun";
import { eventsOverlap, hasStarted, isCoveredByLoggedActivity } from "@/lib/eventOverlap";
import { isRecord } from "@/lib/utils";

export type EventCategory = string;
export type RecurrenceType = "none" | "weekly" | "monthly";

export interface CalendarEvent {
  id: string;
  date: Date;
  endTime?: string;
  category: EventCategory;
  reminderMinutesBefore: number;
  notified: boolean;
  location?: { lat: number; lng: number };
  recurrence: RecurrenceType;
  parentId?: string;
  completed: boolean;
  notes?: string;
}

export interface AddEventParams {
  date: Date;
  endTime?: string;
  category: EventCategory;
  reminderMinutesBefore: number;
  location?: { lat: number; lng: number };
  recurrence: RecurrenceType;
  notes?: string;
}

interface PersistedCalendarEvent extends Omit<CalendarEvent, "date"> {
  date: string;
}

function isEventCategory(value: unknown): value is EventCategory {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecurrenceType(value: unknown): value is RecurrenceType {
  return value === "none" || value === "weekly" || value === "monthly";
}

function parseStoredEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value) || typeof value.id !== "string" || !isEventCategory(value.category)) return null;

  const date = new Date(String(value.date));
  if (Number.isNaN(date.getTime())) return null;

  const recurrence = isRecurrenceType(value.recurrence) ? value.recurrence : "none";
  const reminder =
    typeof value.reminderMinutesBefore === "number" && Number.isFinite(value.reminderMinutesBefore)
      ? clampReminderMinutes(value.reminderMinutesBefore)
      : 15;
  const location =
    isRecord(value.location) &&
    typeof value.location.lat === "number" &&
    typeof value.location.lng === "number" &&
    Number.isFinite(value.location.lat) &&
    Number.isFinite(value.location.lng)
      ? { lat: value.location.lat, lng: value.location.lng }
      : undefined;

  return {
    id: value.id,
    date,
    endTime: typeof value.endTime === "string" ? value.endTime : undefined,
    category: value.category,
    reminderMinutesBefore: reminder,
    notified: typeof value.notified === "boolean" ? value.notified : false,
    location,
    recurrence,
    parentId: typeof value.parentId === "string" ? value.parentId : undefined,
    completed: typeof value.completed === "boolean" ? value.completed : false,
    notes: typeof value.notes === "string" && value.notes.trim() ? value.notes : undefined,
  };
}

// Suma `months` meses conservando el día del mes cuando existe en el mes de
// destino, y si no (p.ej. 31 de enero + 1 mes) lo recorta al último día de
// ese mes en vez de dejar que JS lo desborde al mes siguiente (31 ene → 3
// mar en vez de 28/29 feb).
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getDate();
  const firstOfTargetMonth = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const daysInTargetMonth = new Date(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth() + 1, 0).getDate();
  const result = new Date(date);
  result.setDate(1); // evita desbordar el mes al reasignarlo mientras el día original aún no encaja
  result.setFullYear(firstOfTargetMonth.getFullYear(), firstOfTargetMonth.getMonth(), Math.min(day, daysInTargetMonth));
  return result;
}

function generateRecurringEvents(params: AddEventParams, count: number): CalendarEvent[] {
  const parentId = generateId();
  const events: CalendarEvent[] = [];

  for (let i = 0; i < count; i++) {
    const date = params.recurrence === "monthly" ? addMonthsClamped(params.date, i) : new Date(params.date);
    if (params.recurrence === "weekly") {
      date.setDate(date.getDate() + i * 7);
    }

    events.push({
      id: i === 0 ? parentId : generateId(),
      date,
      endTime: params.endTime,
      category: params.category,
      reminderMinutesBefore: params.reminderMinutesBefore,
      notified: date.getTime() < Date.now(),
      location: params.location,
      recurrence: params.recurrence,
      parentId: i === 0 ? undefined : parentId,
      completed: date.getTime() < Date.now(),
    });
  }

  return events;
}

function removeCompletedScheduleDuplicates(events: CalendarEvent[], completedEvent: CalendarEvent): CalendarEvent[] {
  if (!completedEvent.completed) return events;
  // Solo elimina eventos PENDIENTES (no completados) que solapen con el evento
  // completado. Se conservan siempre:
  //  · los ya completados (llevan duración real: ahí puede haber horas tuyas),
  //  · y los que todavía NO han empezado (ver hasStarted). Al fichar aún no se
  //    sabe cuánto va a durar la actividad, así que se asume una hora; sin este
  //    freno, fichar a las 10:00 borraba en silencio el recordatorio de las
  //    10:30 que seguías pensando hacer. Cuando su hora llegue y quede cubierto
  //    de verdad, lo descarta la parada del timer o la limpieza de carga.
  return events.filter((event) =>
    event.id === completedEvent.id ||
    event.completed ||
    !hasStarted(event) ||
    !eventsOverlap(event, completedEvent)
  );
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const eventsRef = useRef<CalendarEvent[]>([]);
  const writeCalendarEvents = useDebouncedJsonWriter("calendar-events");

  const writeCalendarEventsRef = useRef(writeCalendarEvents);
  writeCalendarEventsRef.current = writeCalendarEvents;

  useEffect(() => {
    readJsonValue<unknown[]>("calendar-events", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        const parsed = value.map(parseStoredEvent).filter((event): event is CalendarEvent => event !== null);
        // Limpia eventos completados con más de 6 meses de antigüedad
        const cutoff = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000;
        const aged = parsed.filter((e) => !(e.completed && e.date.getTime() < cutoff));
        // Y descarta los eventos PROGRAMADOS que ya quedaron cubiertos por una
        // actividad real fichada en su misma franja: el evento programado es
        // solo la referencia de lo que se pensaba hacer, así que una vez hecho
        // sobra. Sin esta pasada se quedaban dibujados como un segundo cuadro
        // encima de la actividad real en el calendario (y seguían avisando).
        // La limpieza al escribir ya lo hace, pero no alcanza a los eventos que
        // se solaparon después (p.ej. una actividad que se alargó, o un evento
        // programado creado a posteriori sobre una franja ya fichada).
        const cleaned = aged.filter((e) => !isCoveredByLoggedActivity(e, aged));
        if (cleaned.length < parsed.length) {
          // Persiste el cleanup silenciosamente
          writeCalendarEventsRef.current(cleaned.map((e) => ({ ...e, date: e.date.toISOString() })));
        }
        eventsRef.current = cleaned;
        setEvents(cleaned);
      })
      .catch((error) => console.error("Error loading events:", error))
      .finally(() => setLoaded(true));
  }, []);

  const persistEvents = useCallback((updated: CalendarEvent[]) => {
    const persisted: PersistedCalendarEvent[] = updated.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    }));
    writeCalendarEvents(persisted);
  }, [writeCalendarEvents]);

  const markNotified = useCallback((id: string) => {
    setEvents((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, notified: true } : e));
      eventsRef.current = updated;
      persistEvents(updated);
      return updated;
    });
  }, [persistEvents]);

  const addEvent = useCallback((params: AddEventParams) => {
    if (params.recurrence !== "none") {
      const recurring = generateRecurringEvents(params, 12);
      setEvents((prev) => {
        const updated = [...prev, ...recurring].sort((a, b) => a.date.getTime() - b.date.getTime());
        eventsRef.current = updated;
        persistEvents(updated);
        return updated;
      });
    } else {
      const event: CalendarEvent = {
        id: generateId(),
        date: params.date,
        endTime: params.endTime || undefined,
        category: params.category,
        reminderMinutesBefore: params.reminderMinutesBefore,
        notified: params.date.getTime() < Date.now(),
        location: params.location,
        recurrence: "none",
        completed: params.date.getTime() < Date.now(),
        notes: params.notes || undefined,
      };
      setEvents((prev) => {
        const updated = [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime());
        eventsRef.current = updated;
        persistEvents(updated);
        return updated;
      });
    }
  }, [persistEvents]);

  const addCompletedEventNow = useCallback(
    (params: { date: Date; category: EventCategory; location?: { lat: number; lng: number } }) => {
      const scheduledEvent =
        findScheduledEventForTimerStart(params.date, params.category, eventsRef.current) ??
        findScheduledEventAtTimerStart(params.date, eventsRef.current);
      if (scheduledEvent) {
        setEvents((prev) => {
          const completedEvent = {
            ...scheduledEvent,
            date: params.date,
            // La actividad ACABA de empezar (o es una entrada manual): la hora de
            // fin PLANIFICADA del evento programado no aplica. Se limpia y la fija
            // el momento de parar (o el llamador, en una entrada manual). Si no,
            // como la actividad deriva del evento, heredaba un fin anterior a la
            // hora de inicio y se calculaba una duración enorme (p.ej. ~20h,
            // "todo el día", al cruzar la medianoche).
            endTime: undefined,
            category: params.category,
            notified: true,
            location: params.location ?? scheduledEvent.location,
            completed: true,
          };
          const updated = removeCompletedScheduleDuplicates(prev, completedEvent).map((event) =>
            event.id === scheduledEvent.id
              ? { ...event, ...completedEvent }
              : event
          ).sort((a, b) => a.date.getTime() - b.date.getTime());
          eventsRef.current = updated;
          persistEvents(updated);
          return updated;
        });
        return scheduledEvent.id;
      }

      const id = generateId();
      const event: CalendarEvent = {
        id,
        date: params.date,
        endTime: undefined,
        category: params.category,
        reminderMinutesBefore: 0,
        notified: true,
        location: params.location,
        recurrence: "none",
        completed: true,
      };
      setEvents((prev) => {
        const updated = [...removeCompletedScheduleDuplicates(prev, event), event].sort((a, b) => a.date.getTime() - b.date.getTime());
        eventsRef.current = updated;
        persistEvents(updated);
        return updated;
      });
      return id;
    },
    [persistEvents]
  );

  const deleteEvent = useCallback((id: string, scope: "single" | "all" = "all") => {
    setEvents((prev) => {
      const event = prev.find((e) => e.id === id);
      if (!event) return prev;
      if (scope === "all" && event.recurrence !== "none") {
        const parentId = event.parentId || event.id;
        const updated = prev.filter((e) => e.id !== parentId && e.parentId !== parentId);
        eventsRef.current = updated;
        persistEvents(updated);
        return updated;
      }
      const updated = prev.filter((e) => e.id !== id);
      eventsRef.current = updated;
      persistEvents(updated);
      return updated;
    });
  }, [persistEvents]);

  const getEventsForDate = useCallback(
    (date: Date) =>
      events.filter(
        (e) =>
          e.date.getDate() === date.getDate() &&
          e.date.getMonth() === date.getMonth() &&
          e.date.getFullYear() === date.getFullYear()
      ),
    [events]
  );

  const toggleEventCompleted = useCallback((id: string) => {
    setEvents((prev) => {
      const target = prev.find((event) => event.id === id);
      if (!target) return prev;

      const nextCompleted = !target.completed;
      if (nextCompleted && target.date.getTime() > Date.now()) return prev;

      const targetAfterToggle = { ...target, completed: nextCompleted };
      const base = nextCompleted ? removeCompletedScheduleDuplicates(prev, targetAfterToggle) : prev;
      const updated = base.map((e) => (e.id === id ? targetAfterToggle : e));
      eventsRef.current = updated;
      persistEvents(updated);
      return updated;
    });
  }, [persistEvents]);

  const updateEvent = useCallback(
    (
      id: string,
      updates: {
        date?: Date;
        endTime?: string;
        category?: EventCategory;
        reminderMinutesBefore?: number;
        notified?: boolean;
        completed?: boolean;
        location?: { lat: number; lng: number };
        recurrence?: RecurrenceType;
        parentId?: string;
        notes?: string;
      }
    ) => {
      setEvents((prev) => {
        const target = prev.find((event) => event.id === id);
        if (!target) return prev;
        const targetDate = updates.date ?? target.date;
        if (updates.completed === true && targetDate.getTime() > Date.now()) return prev;

        const shouldResetNotification =
          updates.notified === undefined &&
          (updates.date !== undefined || updates.reminderMinutesBefore !== undefined);
        const mapped = prev
          .map((e) => (e.id === id ? { ...e, ...updates, notified: shouldResetNotification ? false : updates.notified ?? e.notified } : e))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        const completedEvent = mapped.find((event) => event.id === id && event.completed);
        const updated = completedEvent ? removeCompletedScheduleDuplicates(mapped, completedEvent) : mapped;
        eventsRef.current = updated;
        persistEvents(updated);
        return updated;
      });
    },
    [persistEvents]
  );

  return { events, loaded, addEvent, addCompletedEventNow, deleteEvent, getEventsForDate, toggleEventCompleted, updateEvent, markNotified };
}

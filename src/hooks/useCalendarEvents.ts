import { useState, useEffect, useCallback, useRef } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { clampReminderMinutes } from "@/lib/eventReminders";
import { findScheduledEventAtTimerStart, findScheduledEventForTimerStart } from "@/lib/timerOverrun";
import { requestNotificationPermission } from "@/lib/notifications";

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
}

export interface AddEventParams {
  date: Date;
  endTime?: string;
  category: EventCategory;
  reminderMinutesBefore: number;
  location?: { lat: number; lng: number };
  recurrence: RecurrenceType;
}

interface PersistedCalendarEvent extends Omit<CalendarEvent, "date"> {
  date: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  };
}

function generateRecurringEvents(params: AddEventParams, count: number): CalendarEvent[] {
  const parentId = generateId();
  const events: CalendarEvent[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(params.date);
    if (params.recurrence === "weekly") {
      date.setDate(date.getDate() + i * 7);
    } else if (params.recurrence === "monthly") {
      date.setMonth(date.getMonth() + i);
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

function getEventEndDate(event: CalendarEvent): Date {
  if (!event.endTime) return new Date(event.date.getTime() + 60 * 60_000);
  const [hours, minutes] = event.endTime.split(":").map(Number);
  const end = new Date(event.date);
  end.setHours(hours, minutes, 0, 0);
  return end.getTime() > event.date.getTime() ? end : new Date(event.date.getTime() + 60 * 60_000);
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function eventsShareSchedule(a: CalendarEvent, b: CalendarEvent): boolean {
  if (!isSameCalendarDay(a.date, b.date)) return false;
  return a.date.getTime() < getEventEndDate(b).getTime() && getEventEndDate(a).getTime() > b.date.getTime();
}

function removeCompletedScheduleDuplicates(events: CalendarEvent[], completedEvent: CalendarEvent): CalendarEvent[] {
  if (!completedEvent.completed) return events;
  return events.filter((event) => event.id === completedEvent.id || !eventsShareSchedule(event, completedEvent));
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const eventsRef = useRef<CalendarEvent[]>([]);

  useEffect(() => {
    readJsonValue<unknown[]>("calendar-events", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        const parsedEvents = value.map(parseStoredEvent).filter((event): event is CalendarEvent => event !== null);
        eventsRef.current = parsedEvents;
        setEvents(parsedEvents);
      })
      .catch((error) => console.error("Error loading events:", error));
  }, []);

  const persistEvents = useCallback((updated: CalendarEvent[]) => {
    const persisted: PersistedCalendarEvent[] = updated.map((event) => ({
      ...event,
      date: event.date.toISOString(),
    }));
    void writeJsonValue("calendar-events", persisted).catch((error) => console.error("Error saving events:", error));
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

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

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const event = prev.find((e) => e.id === id);
      if (!event) return prev;
      if (event.recurrence !== "none") {
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

  return { events, addEvent, addCompletedEventNow, deleteEvent, getEventsForDate, toggleEventCompleted, updateEvent, markNotified };
}

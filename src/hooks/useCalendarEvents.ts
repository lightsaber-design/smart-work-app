import { useState, useEffect, useCallback } from "react";
import { generateId } from "@/lib/uuid";

export type EventCategory = "Predi" | "Carrito" | "LDC" | "Visitas" | "Estudio";
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
  return value === "Predi" || value === "Carrito" || value === "LDC" || value === "Visitas" || value === "Estudio";
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
      ? value.reminderMinutesBefore
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
      notified: false,
      location: params.location,
      recurrence: params.recurrence,
      parentId: i === 0 ? undefined : parentId,
      completed: false,
    });
  }

  return events;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem("calendar-events");
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (!Array.isArray(parsed)) throw new Error("bad format");
        return parsed.map(parseStoredEvent).filter((event): event is CalendarEvent => event !== null);
      }
    } catch {
      localStorage.removeItem("calendar-events");
    }
    return [];
  });

  useEffect(() => {
    try {
      const persisted: PersistedCalendarEvent[] = events.map((event) => ({
        ...event,
        date: event.date.toISOString(),
      }));
      localStorage.setItem("calendar-events", JSON.stringify(persisted));
    } catch (e) {
      console.error("Error guardando eventos:", e);
    }
  }, [events]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const markNotified = useCallback((id: string) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, notified: true } : e)));
  }, []);

  const addEvent = useCallback((params: AddEventParams) => {
    if (params.recurrence !== "none") {
      const recurring = generateRecurringEvents(params, 12);
      setEvents((prev) => [...prev, ...recurring].sort((a, b) => a.date.getTime() - b.date.getTime()));
    } else {
      const event: CalendarEvent = {
        id: generateId(),
        date: params.date,
        endTime: params.endTime || undefined,
        category: params.category,
        reminderMinutesBefore: params.reminderMinutesBefore,
        notified: false,
        location: params.location,
        recurrence: "none",
        completed: false,
      };
      setEvents((prev) => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()));
    }
  }, []);

  const addCompletedEventNow = useCallback(
    (params: { date: Date; category: EventCategory; location?: { lat: number; lng: number } }) => {
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
      setEvents((prev) => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()));
      return id;
    },
    []
  );

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const event = prev.find((e) => e.id === id);
      if (!event) return prev;
      if (event.recurrence !== "none") {
        const parentId = event.parentId || event.id;
        return prev.filter((e) => e.id !== parentId && e.parentId !== parentId);
      }
      return prev.filter((e) => e.id !== id);
    });
  }, []);

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
    setEvents((prev) =>
      prev.map((e) => (e.id === id ? { ...e, completed: !e.completed } : e))
    );
  }, []);

  const updateEvent = useCallback(
    (
      id: string,
      updates: { date?: Date; endTime?: string; category?: EventCategory; reminderMinutesBefore?: number }
    ) => {
      setEvents((prev) =>
        prev
          .map((e) => (e.id === id ? { ...e, ...updates, notified: false } : e))
          .sort((a, b) => a.date.getTime() - b.date.getTime())
      );
    },
    []
  );

  return { events, addEvent, addCompletedEventNow, deleteEvent, getEventsForDate, toggleEventCompleted, updateEvent, markNotified };
}

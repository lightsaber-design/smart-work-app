import { useState, useEffect, useCallback } from "react";

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

function generateRecurringEvents(params: AddEventParams, count: number): CalendarEvent[] {
  const parentId = crypto.randomUUID();
  const events: CalendarEvent[] = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(params.date);
    if (params.recurrence === "weekly") {
      date.setDate(date.getDate() + i * 7);
    } else if (params.recurrence === "monthly") {
      date.setMonth(date.getMonth() + i);
    }

    events.push({
      id: i === 0 ? parentId : crypto.randomUUID(),
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
    const saved = localStorage.getItem("calendar-events");
    if (saved) {
      return JSON.parse(saved).map((e: any) => ({
        ...e,
        date: new Date(e.date),
        recurrence: e.recurrence || "none",
      }));
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("calendar-events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setEvents((prev) =>
        prev.map((event) => {
          if (event.notified) return event;
          const triggerAt = event.date.getTime() - event.reminderMinutesBefore * 60 * 1000;
          if (now >= triggerAt && now < event.date.getTime() + 60000) {
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ Recordatorio de fichaje", {
                body: `${event.category} — ¡Es hora de registrar tus horas!`,
                icon: "/placeholder.svg",
              });
            }
            return { ...event, notified: true };
          }
          return event;
        })
      );
    };

    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const addEvent = useCallback((params: AddEventParams) => {
    if (params.recurrence !== "none") {
      const recurring = generateRecurringEvents(params, 12);
      setEvents((prev) => [...prev, ...recurring].sort((a, b) => a.date.getTime() - b.date.getTime()));
    } else {
      const event: CalendarEvent = {
        id: crypto.randomUUID(),
        date: params.date,
        endTime: params.endTime || undefined,
        category: params.category,
        reminderMinutesBefore: params.reminderMinutesBefore,
        notified: false,
        location: params.location,
        recurrence: "none",
      };
      setEvents((prev) => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()));
    }
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const event = prev.find((e) => e.id === id);
      if (event?.recurrence !== "none") {
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

  return { events, addEvent, deleteEvent, getEventsForDate };
}

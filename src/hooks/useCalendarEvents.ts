import { useState, useEffect, useCallback } from "react";

export type EventCategory = "Predi" | "Carrito" | "LDC" | "Visitas" | "Estudio";

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  endTime?: string; // HH:mm format, optional
  category: EventCategory;
  location?: { lat: number; lng: number } | null;
  reminderMinutesBefore: number;
  notified: boolean;
}

export interface AddEventParams {
  title: string;
  date: Date;
  endTime?: string;
  category: EventCategory;
  location?: { lat: number; lng: number } | null;
  reminderMinutesBefore: number;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem("calendar-events");
    if (saved) {
      return JSON.parse(saved).map((e: any) => ({
        ...e,
        date: new Date(e.date),
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
                body: `${event.title} (${event.category}) — ¡Es hora de registrar tus horas!`,
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
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: params.title,
      date: params.date,
      endTime: params.endTime || undefined,
      category: params.category,
      location: params.location || null,
      reminderMinutesBefore: params.reminderMinutesBefore,
      notified: false,
    };
    setEvents((prev) => [...prev, event].sort((a, b) => a.date.getTime() - b.date.getTime()));
  }, []);

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== id));
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

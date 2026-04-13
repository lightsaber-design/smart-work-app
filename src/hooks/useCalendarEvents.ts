import { useState, useEffect, useCallback } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  reminderMinutesBefore: number;
  notified: boolean;
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

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Check for upcoming events every 30 seconds
  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setEvents((prev) =>
        prev.map((event) => {
          if (event.notified) return event;
          const triggerAt = event.date.getTime() - event.reminderMinutesBefore * 60 * 1000;
          if (now >= triggerAt && now < event.date.getTime() + 60000) {
            // Send notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("⏰ Recordatorio de fichaje", {
                body: `${event.title} — ¡Es hora de empezar a registrar tus horas!`,
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

  const addEvent = useCallback((title: string, date: Date, reminderMinutesBefore: number) => {
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      date,
      reminderMinutesBefore,
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

import { describe, expect, it } from "vitest";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { getTravelReminderMinutes, shouldNotifyEvent } from "./eventReminders";

function event(startHour: number, startMinute: number, endTime?: string): CalendarEvent {
  return {
    id: `${startHour}:${startMinute}`,
    date: new Date(2026, 4, 10, startHour, startMinute),
    endTime,
    category: "Predi",
    reminderMinutesBefore: 15,
    notified: false,
    recurrence: "none",
    completed: false,
  };
}

describe("event reminders", () => {
  it("uses the configured travel time when there is no previous event", () => {
    expect(getTravelReminderMinutes(new Date(2026, 4, 10, 10, 0), [], { enabled: true, minutes: 60 })).toBe(60);
  });

  it("does not place a travel reminder before the previous event has ended", () => {
    const previous = event(10, 0, "12:00");

    expect(getTravelReminderMinutes(new Date(2026, 4, 10, 12, 0), [previous], { enabled: true, minutes: 60 })).toBe(0);
    expect(getTravelReminderMinutes(new Date(2026, 4, 10, 12, 10), [previous], { enabled: true, minutes: 60 })).toBe(10);
  });

  it("notifies at the reminder time instead of only at the start time", () => {
    const next = event(10, 0);
    next.reminderMinutesBefore = 60;

    expect(shouldNotifyEvent(new Date(2026, 4, 10, 9, 0).getTime(), next)).toBe(true);
    expect(shouldNotifyEvent(new Date(2026, 4, 10, 8, 59).getTime(), next)).toBe(false);
  });
});

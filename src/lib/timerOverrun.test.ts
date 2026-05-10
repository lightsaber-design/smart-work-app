import { describe, expect, it } from "vitest";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { TimeEntry } from "@/hooks/useTimeTracker";
import { findActiveScheduledEvent, shouldShowTimerOverrunPrompt } from "./timerOverrun";

const event: CalendarEvent = {
  id: "event-1",
  date: new Date(2026, 4, 10, 10, 0),
  endTime: "12:00",
  category: "Predi",
  reminderMinutesBefore: 60,
  notified: false,
  recurrence: "none",
  completed: false,
};

const entry: TimeEntry = {
  id: "entry-1",
  startTime: new Date(2026, 4, 10, 10, 5),
  endTime: null,
  description: "",
  category: "Predi",
  startLocation: null,
  endLocation: null,
};

describe("timer overrun prompt", () => {
  it("matches the running timer to the scheduled event", () => {
    expect(findActiveScheduledEvent(entry, [event])?.id).toBe("event-1");
  });

  it("waits until the event end plus travel time", () => {
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 12, 59), event, 60)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 0), event, 60)).toBe(true);
  });

  it("respects a snoozed time", () => {
    const snoozedUntil = new Date(2026, 4, 10, 13, 30).getTime();

    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 10), event, 60, snoozedUntil)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 30), event, 60, snoozedUntil)).toBe(true);
  });
});

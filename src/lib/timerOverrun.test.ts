import { describe, expect, it } from "vitest";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { TimeEntry } from "@/hooks/useTimeTracker";
import { findActiveScheduledEvent, findScheduledEventForTimerStart, shouldShowTimerOverrunPrompt } from "./timerOverrun";

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

const eventWithoutEnd: CalendarEvent = {
  ...event,
  endTime: undefined,
};

describe("timer overrun prompt", () => {
  it("matches a timer start to the scheduled event before a reminder is due", () => {
    expect(findScheduledEventForTimerStart(new Date(2026, 4, 10, 9, 50), "Predi", [event])?.id).toBe("event-1");
  });

  it("does not match a completed scheduled event", () => {
    expect(findScheduledEventForTimerStart(new Date(2026, 4, 10, 10, 5), "Predi", [{ ...event, completed: true }])).toBeNull();
  });

  it("matches the running timer to the scheduled event", () => {
    expect(findActiveScheduledEvent(entry, [event])?.id).toBe("event-1");
  });

  it("keeps matching a completed linked event while its timer is running", () => {
    const linkedEntry = { ...entry, linkedEventId: "event-1" };

    expect(findActiveScheduledEvent(linkedEntry, [{ ...eventWithoutEnd, completed: true, notified: true }])?.id).toBe("event-1");
  });

  it("uses the reused timer start for the estimated end notification", () => {
    const reusedEvent = { ...eventWithoutEnd, date: new Date(2026, 4, 10, 10, 5), completed: true, notified: true };

    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 12, 4), reusedEvent, 60)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 12, 5), reusedEvent, 60)).toBe(true);
  });

  it("waits until the event end plus travel time", () => {
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 12, 59), event, 60)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 0), event, 60)).toBe(true);
  });

  it("does not add travel time when settings pass it as disabled", () => {
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 11, 59), event, 0)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 12, 0), event, 0)).toBe(true);
  });

  it("uses a one hour estimated end when the scheduled event has no end time", () => {
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 10, 59), eventWithoutEnd, 0)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 11, 0), eventWithoutEnd, 0)).toBe(true);
  });

  it("respects a snoozed time", () => {
    const snoozedUntil = new Date(2026, 4, 10, 13, 30).getTime();

    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 10), event, 60, snoozedUntil)).toBe(false);
    expect(shouldShowTimerOverrunPrompt(new Date(2026, 4, 10, 13, 30), event, 60, snoozedUntil)).toBe(true);
  });
});

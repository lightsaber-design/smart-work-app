import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  readJsonValue: vi.fn(),
  writeJsonValue: vi.fn(),
}));

vi.mock("@/lib/jsonFileStorage", () => ({
  readJsonValue: storageMocks.readJsonValue,
  writeJsonValue: storageMocks.writeJsonValue,
}));

import { useCalendarEvents } from "./useCalendarEvents";

describe("useCalendarEvents", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 12, 0));
    storageMocks.readJsonValue.mockResolvedValue([]);
    storageMocks.writeJsonValue.mockResolvedValue(undefined);
    storageMocks.readJsonValue.mockClear();
    storageMocks.writeJsonValue.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sanitizes stored events and clamps reminder values", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      {
        id: "event-1",
        date: new Date(2026, 4, 11, 9, 0).toISOString(),
        category: "Predi",
        reminderMinutesBefore: 999,
        recurrence: "broken",
      },
      { id: "bad", date: "invalid", category: "Predi" },
    ]);

    const { result } = renderHook(() => useCalendarEvents());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({
      id: "event-1",
      recurrence: "none",
      completed: false,
      notified: false,
    });
    expect(result.current.events[0].reminderMinutesBefore).toBe(180);
  });

  it("does not allow future events to be marked completed manually", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await act(async () => {
      await Promise.resolve();
    });
    expect(storageMocks.readJsonValue).toHaveBeenCalled();

    act(() => {
      result.current.addEvent({
        date: new Date(2026, 4, 11, 9, 0),
        category: "Predi",
        reminderMinutesBefore: 15,
        recurrence: "none",
      });
    });

    const eventId = result.current.events[0].id;
    act(() => {
      result.current.toggleEventCompleted(eventId);
    });

    expect(result.current.events[0].completed).toBe(false);
  });

  it("deletes an entire recurring series from any child event", async () => {
    const { result } = renderHook(() => useCalendarEvents());
    await act(async () => {
      await Promise.resolve();
    });
    expect(storageMocks.readJsonValue).toHaveBeenCalled();

    act(() => {
      result.current.addEvent({
        date: new Date(2026, 4, 11, 9, 0),
        category: "Predi",
        reminderMinutesBefore: 15,
        recurrence: "weekly",
      });
    });

    expect(result.current.events).toHaveLength(12);
    const childId = result.current.events[3].id;
    act(() => {
      result.current.deleteEvent(childId);
    });

    expect(result.current.events).toEqual([]);
  });

  it("reuses a matching scheduled event when clocking in", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      {
        id: "scheduled",
        date: new Date(2026, 4, 10, 10, 0).toISOString(),
        endTime: "11:00",
        category: "Predi",
        reminderMinutesBefore: 15,
        notified: false,
        recurrence: "none",
        completed: false,
      },
    ]);
    const { result } = renderHook(() => useCalendarEvents());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.events).toHaveLength(1);

    let linkedId = "";
    act(() => {
      linkedId = result.current.addCompletedEventNow({ date: new Date(2026, 4, 10, 10, 5), category: "Predi" });
    });

    expect(linkedId).toBe("scheduled");
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0]).toMatchObject({ id: "scheduled", completed: true, notified: true });
    expect(result.current.events[0].date).toEqual(new Date(2026, 4, 10, 10, 5));
  });
});

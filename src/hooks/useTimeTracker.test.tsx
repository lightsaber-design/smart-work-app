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

import { useTimeTracker, type TimeTrackerEventOps } from "./useTimeTracker";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

function makeOps(overrides: Partial<TimeTrackerEventOps> = {}): TimeTrackerEventOps {
  return {
    addCompletedEventNow: vi.fn(() => "event-1"),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    ...overrides,
  };
}

function completedEvent(id: string, start: Date, endTime: string, category = "Predi"): CalendarEvent {
  return {
    id,
    date: start,
    endTime,
    category,
    reminderMinutesBefore: 0,
    notified: true,
    recurrence: "none",
    completed: true,
  };
}

describe("useTimeTracker (calendar as single source of truth)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 10, 0));
    storageMocks.readJsonValue.mockResolvedValue(null);
    storageMocks.writeJsonValue.mockResolvedValue(undefined);
    storageMocks.readJsonValue.mockClear();
    storageMocks.writeJsonValue.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives completed entries from completed calendar events", async () => {
    const events = [completedEvent("event-1", new Date(2026, 4, 10, 9, 0), "10:00", "Predi")];
    const { result } = renderHook(() => useTimeTracker(events, makeOps(), true));
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].linkedEventId).toBe("event-1");
    expect(result.current.entries[0].endTime).toEqual(new Date(2026, 4, 10, 10, 0));
    expect(result.current.isRunning).toBe(false);
  });

  it("clocks in by creating a completed event and marks the timer running", async () => {
    const ops = makeOps({ addCompletedEventNow: vi.fn(() => "event-1") });
    const { result } = renderHook(() => useTimeTracker([], ops, true));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.clockIn("Predi", new Date(2026, 4, 10, 9, 30));
    });

    expect(ops.addCompletedEventNow).toHaveBeenCalledWith(
      expect.objectContaining({ category: "Predi" })
    );
    expect(result.current.isRunning).toBe(true);
  });

  it("clocks out by writing the end time onto the linked event", async () => {
    const ops = makeOps({ addCompletedEventNow: vi.fn(() => "event-1") });
    const { result } = renderHook(() => useTimeTracker([], ops, true));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.clockIn("Predi", new Date(2026, 4, 10, 9, 30));
    });
    act(() => {
      result.current.clockOut(new Date(2026, 4, 10, 10, 45));
    });

    expect(ops.updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ endTime: "10:45", completed: true })
    );
    expect(result.current.isRunning).toBe(false);
  });

  it("clamps updateStartTime to now (no future start / negative duration)", async () => {
    const ops = makeOps();
    const { result } = renderHook(() => useTimeTracker([], ops, true));
    await act(async () => {
      await Promise.resolve();
    });

    // Hora del sistema 10:00; elegir 11:00 sería futuro → se recorta a ahora.
    act(() => {
      result.current.updateStartTime("event-1", new Date(2026, 4, 10, 11, 0));
    });

    expect(ops.updateEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ date: new Date(2026, 4, 10, 10, 0) })
    );
  });

  it("deleting an entry removes its event (delete = gone, no second store)", async () => {
    const events = [completedEvent("event-1", new Date(2026, 4, 10, 9, 0), "10:00")];
    const ops = makeOps();
    const { result } = renderHook(() => useTimeTracker(events, ops, true));
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.deleteEntry("event-1");
    });

    expect(ops.deleteEvent).toHaveBeenCalledWith("event-1");
  });

  it("discardActive deletes a freshly-created event (accidental short widget cycle)", async () => {
    // addCompletedEventNow devuelve un id que NO existía antes → evento nuevo.
    const ops = makeOps({ addCompletedEventNow: vi.fn(() => "new-event") });
    const { result } = renderHook(() => useTimeTracker([], ops, true));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.clockIn("Predi", new Date(2026, 4, 10, 9, 59, 50));
    });
    act(() => {
      result.current.discardActive();
    });

    expect(ops.deleteEvent).toHaveBeenCalledWith("new-event");
    expect(ops.updateEvent).not.toHaveBeenCalled();
    expect(result.current.isRunning).toBe(false);
  });

  it("discardActive reverts a scheduled event to pending instead of deleting it", async () => {
    // El fichaje se engancha a un evento programado ya existente (mismo id).
    const scheduled = completedEvent("sched-1", new Date(2026, 4, 10, 9, 59, 50), "10:30");
    const ops = makeOps({ addCompletedEventNow: vi.fn(() => "sched-1") });
    const { result } = renderHook(() => useTimeTracker([scheduled], ops, true));
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      result.current.clockIn("Predi", new Date(2026, 4, 10, 9, 59, 55));
    });
    act(() => {
      result.current.discardActive();
    });

    expect(ops.deleteEvent).not.toHaveBeenCalled();
    expect(ops.updateEvent).toHaveBeenCalledWith(
      "sched-1",
      expect.objectContaining({ completed: false })
    );
    expect(result.current.isRunning).toBe(false);
  });
});

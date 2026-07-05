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

import { useTimeTracker } from "./useTimeTracker";

describe("useTimeTracker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 10, 0));
    storageMocks.readJsonValue.mockResolvedValue([]);
    storageMocks.writeJsonValue.mockResolvedValue(undefined);
    storageMocks.readJsonValue.mockClear();
    storageMocks.writeJsonValue.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads only valid stored entries and restores a running timer", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      { id: "active", startTime: new Date(2026, 4, 10, 9, 0).toISOString(), endTime: null, category: "Predi" },
      { id: "bad-date", startTime: "not-a-date", endTime: null, category: "Predi" },
    ]);

    const { result } = renderHook(() => useTimeTracker());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.isRunning).toBe(true);
    expect(result.current.elapsed).toBe(3600);
  });

  it("clocks in and out while updating a linked calendar event", async () => {
    const { result } = renderHook(() => useTimeTracker());
    await act(async () => {
      await Promise.resolve();
    });
    expect(storageMocks.readJsonValue).toHaveBeenCalled();

    act(() => {
      void result.current.clockIn("Predi", () => "event-1", new Date(2026, 4, 10, 9, 30));
    });

    expect(result.current.isRunning).toBe(true);
    expect(result.current.entries[0].linkedEventId).toBe("event-1");

    const updateEvent = vi.fn();
    act(() => {
      void result.current.clockOut(updateEvent, new Date(2026, 4, 10, 10, 45));
    });

    expect(result.current.isRunning).toBe(false);
    expect(result.current.entries[0].endTime).toEqual(new Date(2026, 4, 10, 10, 45));
    expect(updateEvent).toHaveBeenCalledWith("event-1", "10:45");
  });

  it("clamps updateStartTime to now instead of allowing a future start (negative duration)", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      { id: "active", startTime: new Date(2026, 4, 10, 9, 0).toISOString(), endTime: null, category: "Predi" },
    ]);
    const { result } = renderHook(() => useTimeTracker());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRunning).toBe(true);

    // System time is 2026-05-10 10:00; picking 11:00 as the start would be in the future.
    act(() => {
      result.current.updateStartTime("active", new Date(2026, 4, 10, 11, 0));
    });

    expect(result.current.entries[0].startTime).toEqual(new Date(2026, 4, 10, 10, 0));
    expect(result.current.elapsed).toBe(0);
  });

  it("stops the running state when deleting the active entry", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      { id: "active", startTime: new Date(2026, 4, 10, 9, 45).toISOString(), endTime: null, category: "Predi" },
    ]);
    const { result } = renderHook(() => useTimeTracker());
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.isRunning).toBe(true);

    act(() => {
      result.current.deleteEntry("active");
    });

    expect(result.current.entries).toEqual([]);
    expect(result.current.isRunning).toBe(false);
    expect(result.current.elapsed).toBe(0);
  });

  it("detaches (without deleting) entries linked to a deleted calendar event", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      {
        id: "logged",
        startTime: new Date(2026, 4, 10, 9, 0).toISOString(),
        endTime: new Date(2026, 4, 10, 10, 0).toISOString(),
        category: "Predi",
        linkedEventId: "event-1",
      },
    ]);
    const { result } = renderHook(() => useTimeTracker());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.detachEntriesLinkedToEvents(["event-1"]);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].linkedEventId).toBeUndefined();
    expect(result.current.entries[0].endTime).toEqual(new Date(2026, 4, 10, 10, 0));
  });
});

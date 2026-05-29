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

import { getNextOccurrences, hasActiveStudyWork, useEstudios } from "./useEstudios";

describe("study scheduling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 10, 8, 0));
    storageMocks.readJsonValue.mockResolvedValue([]);
    storageMocks.writeJsonValue.mockResolvedValue(undefined);
    storageMocks.readJsonValue.mockClear();
    storageMocks.writeJsonValue.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates future weekly, fortnightly, and monthly occurrences", () => {
    expect(getNextOccurrences({ frequency: "weekly", dayOfWeek: 1, time: "10:30" }, 2).map((date) => date.toISOString())).toEqual([
      new Date(2026, 4, 11, 10, 30).toISOString(),
      new Date(2026, 4, 18, 10, 30).toISOString(),
    ]);
    expect(getNextOccurrences({ frequency: "fortnightly", dayOfWeek: 1, time: "10:30" }, 2)[1]).toEqual(new Date(2026, 4, 25, 10, 30));
    expect(getNextOccurrences({ frequency: "monthly", dayOfWeek: 1, time: "10:30" }, 2)[1]).toEqual(new Date(2026, 5, 11, 10, 30));
  });

  it("detects active study work only for active contacts with schedule or pending sessions", () => {
    expect(hasActiveStudyWork({ id: "1", name: "A", active: true, createdAt: "", sessions: [], schedule: { frequency: "weekly", dayOfWeek: 1, time: "10:00" } })).toBe(true);
    expect(hasActiveStudyWork({ id: "2", name: "B", active: true, createdAt: "", sessions: [{ id: "s", date: "", time: "10:00", files: [], pending: true }] })).toBe(true);
    expect(hasActiveStudyWork({ id: "3", name: "C", active: false, createdAt: "", sessions: [{ id: "s", date: "", time: "10:00", files: [], pending: true }] })).toBe(false);
  });

  it("loads contacts, removes duplicate pending slots, and fills scheduled sessions", async () => {
    const pendingDate = new Date(2026, 4, 11, 10, 0).toISOString();
    storageMocks.readJsonValue.mockResolvedValue([
      {
        id: "contact",
        name: "Student",
        active: true,
        createdAt: new Date(2026, 4, 1).toISOString(),
        schedule: { frequency: "weekly", dayOfWeek: 1, time: "10:00" },
        sessions: [
          { id: "a", date: pendingDate, time: "10:00", files: [], pending: true },
          { id: "b", date: pendingDate, time: "10:00", files: [], pending: true },
        ],
      },
    ]);

    const { result } = renderHook(() => useEstudios());
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.contacts).toHaveLength(1);
    expect(result.current.contacts[0].sessions.filter((session) => session.pending)).toHaveLength(4);
    expect(result.current.contacts[0].sessions.filter((session) => session.date === pendingDate && session.pending)).toHaveLength(1);
  });

  it("completes a pending session and keeps the schedule topped up", async () => {
    storageMocks.readJsonValue.mockResolvedValue([
      {
        id: "contact",
        name: "Student",
        active: true,
        createdAt: new Date(2026, 4, 1).toISOString(),
        schedule: { frequency: "weekly", dayOfWeek: 1, time: "10:00" },
        sessions: [{ id: "first", date: new Date(2026, 4, 11, 10).toISOString(), time: "10:00", files: [], pending: true }],
      },
    ]);

    const { result } = renderHook(() => useEstudios());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      result.current.completeSession("contact", "first");
    });

    expect(result.current.contacts[0].sessions.find((session) => session.id === "first")?.pending).toBe(false);
    expect(result.current.contacts[0].sessions.filter((session) => session.pending)).toHaveLength(4);
  });
});

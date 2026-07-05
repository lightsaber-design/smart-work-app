import { describe, expect, it } from "vitest";
import { overlapsExisting } from "./ManualEntrySheet";

describe("overlapsExisting", () => {
  const entries = [
    { startTime: new Date(2026, 4, 10, 9, 0), endTime: new Date(2026, 4, 10, 11, 0) },
  ];

  it("detects a new entry that overlaps an existing completed one", () => {
    const startMs = new Date(2026, 4, 10, 10, 0).getTime();
    const endMs = new Date(2026, 4, 10, 12, 0).getTime();
    expect(overlapsExisting(startMs, endMs, entries)).toBe(true);
  });

  it("allows back-to-back entries that just touch at the boundary", () => {
    const startMs = new Date(2026, 4, 10, 11, 0).getTime();
    const endMs = new Date(2026, 4, 10, 12, 0).getTime();
    expect(overlapsExisting(startMs, endMs, entries)).toBe(false);
  });

  it("does not flag a non-overlapping entry on the same day", () => {
    const startMs = new Date(2026, 4, 10, 13, 0).getTime();
    const endMs = new Date(2026, 4, 10, 14, 0).getTime();
    expect(overlapsExisting(startMs, endMs, entries)).toBe(false);
  });

  it("treats a still-running entry (no endTime) as occupied until now", () => {
    const running = [{ startTime: new Date(Date.now() - 30 * 60_000), endTime: null }];
    const startMs = Date.now() - 10 * 60_000;
    const endMs = Date.now() + 10 * 60_000;
    expect(overlapsExisting(startMs, endMs, running)).toBe(true);
  });
});

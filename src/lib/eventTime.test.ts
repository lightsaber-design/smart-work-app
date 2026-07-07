import { describe, expect, it } from "vitest";
import { resolveEndDate } from "./eventTime";

describe("resolveEndDate", () => {
  it("resolves a same-day end time normally", () => {
    const start = new Date(2026, 6, 7, 9, 0);
    expect(resolveEndDate(start, "11:30")).toEqual(new Date(2026, 6, 7, 11, 30));
  });

  it("rolls over to the next day when the end time crosses midnight", () => {
    const start = new Date(2026, 6, 6, 22, 0);
    expect(resolveEndDate(start, "02:00")).toEqual(new Date(2026, 6, 7, 2, 0));
  });

  it("returns null when there is no end time", () => {
    const start = new Date(2026, 6, 7, 9, 0);
    expect(resolveEndDate(start, undefined)).toBeNull();
  });

  it("returns null for a malformed end time", () => {
    const start = new Date(2026, 6, 7, 9, 0);
    expect(resolveEndDate(start, "not-a-time")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  clampActivityHour,
  clampTimeValueToHourRange,
  formatHourRange,
  hourToTimeValue,
  normalizeActivityHours,
} from "./activityHours";

describe("activity hours", () => {
  it("normalizes invalid hour ranges back to defaults", () => {
    expect(normalizeActivityHours(18, 8)).toEqual({ startHour: 6, endHour: 22 });
    expect(normalizeActivityHours("bad", Number.NaN)).toEqual({ startHour: 6, endHour: 22 });
  });

  it("clamps individual hours into Android/browser-safe day bounds", () => {
    expect(clampActivityHour(-5, 6)).toBe(0);
    expect(clampActivityHour(24.7, 6)).toBe(23);
    expect(clampActivityHour("9", 6)).toBe(6);
  });

  it("formats and clamps time inputs without drifting outside the range", () => {
    expect(hourToTimeValue(7)).toBe("07:00");
    expect(formatHourRange(6, 22)).toBe("06:00 - 22:00");
    expect(clampTimeValueToHourRange("05:59", 6, 22)).toBe("06:00");
    expect(clampTimeValueToHourRange("22:30", 6, 22)).toBe("22:00");
    expect(clampTimeValueToHourRange("13:15", 6, 22)).toBe("13:15");
    expect(clampTimeValueToHourRange("bad", 6, 22)).toBe("06:00");
  });
});

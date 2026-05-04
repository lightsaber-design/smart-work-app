import { describe, expect, it } from "vitest";
import { getNextOccurrences } from "@/hooks/useEstudios";
import { formatDuration } from "@/hooks/useTimeTracker";
import { generateId } from "@/lib/uuid";

describe("time helpers", () => {
  it("formats durations as hh:mm:ss", () => {
    expect(formatDuration(3_723_000)).toBe("01:02:03");
    expect(formatDuration(0)).toBe("00:00:00");
  });
});

describe("schedule helpers", () => {
  it("generates the requested number of future occurrences", () => {
    const occurrences = getNextOccurrences({ frequency: "weekly", dayOfWeek: 1, time: "09:30" }, 3);
    const calendarDayDiff = Math.round(
      (Date.UTC(
        occurrences[1].getFullYear(),
        occurrences[1].getMonth(),
        occurrences[1].getDate()
      ) -
        Date.UTC(
          occurrences[0].getFullYear(),
          occurrences[0].getMonth(),
          occurrences[0].getDate()
        )) /
        (24 * 60 * 60 * 1000)
    );

    expect(occurrences).toHaveLength(3);
    expect(occurrences.every((date) => date.getDay() === 1)).toBe(true);
    expect(occurrences.every((date) => date.getHours() === 9 && date.getMinutes() === 30)).toBe(true);
    expect(calendarDayDiff).toBe(7);
  });
});

describe("id helpers", () => {
  it("generates UUID-shaped ids", () => {
    expect(generateId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });
});

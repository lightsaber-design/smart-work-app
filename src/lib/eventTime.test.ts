import { describe, expect, it } from "vitest";
import { clampActivityEnd, resolveEndDate } from "./eventTime";

/** Duración real que acabaría guardada: el evento trunca el fin a "HH:MM". */
function storedDurationHours(start: Date, rawEnd: Date): number {
  const end = clampActivityEnd(start, rawEnd);
  const hhmm = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
  const resolved = resolveEndDate(start, hhmm)!;
  return (resolved.getTime() - start.getTime()) / 3_600_000;
}

describe("clampActivityEnd", () => {
  it("leaves a normal end time untouched", () => {
    const start = new Date(2026, 6, 20, 9, 0, 0);
    const end = new Date(2026, 6, 20, 11, 30, 0);
    expect(clampActivityEnd(start, end)).toEqual(end);
  });

  it("never lets a sub-minute activity be stored as ~24h", () => {
    // Fichar y parar en el mismo minuto: el fin truncado ("08:07") caería antes
    // del inicio (08:07:30) y resolveEndDate lo mandaría al día siguiente.
    const start = new Date(2026, 6, 20, 8, 7, 30);
    const stop = new Date(2026, 6, 20, 8, 7, 45);
    expect(storedDurationHours(start, stop)).toBeLessThan(0.05);
  });

  it("keeps the stored end after the start even when stopping on the exact minute", () => {
    const start = new Date(2026, 6, 20, 8, 7, 0);
    const stop = new Date(2026, 6, 20, 8, 7, 30);
    expect(storedDurationHours(start, stop)).toBeGreaterThan(0);
    expect(storedDurationHours(start, stop)).toBeLessThan(0.05);
  });
});

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

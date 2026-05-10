import { describe, expect, it } from "vitest";
import {
  applyMonthlyReportCalculation,
  calculateMonthlyReport,
  emptyMonthlyReportCarryover,
} from "./monthlyReport";

describe("monthly report carryover", () => {
  it("reports closed hours and keeps extra minutes", () => {
    const january = calculateMonthlyReport((31 * 60 + 45) * 60_000, new Date(2026, 0, 31), emptyMonthlyReportCarryover);

    expect(january.reportedHours).toBe(31);
    expect(january.carriedOutMinutes).toBe(45);

    const state = applyMonthlyReportCalculation(emptyMonthlyReportCarryover, january, "2026-01-31T12:00:00.000Z");
    const february = calculateMonthlyReport((32 * 60 + 20) * 60_000, new Date(2026, 1, 28), state);

    expect(february.carriedInMinutes).toBe(45);
    expect(february.reportedHours).toBe(33);
    expect(february.carriedOutMinutes).toBe(5);
  });

  it("does not add the same month carryover twice after a report is saved", () => {
    const first = calculateMonthlyReport((31 * 60 + 45) * 60_000, new Date(2026, 0, 31), emptyMonthlyReportCarryover);
    const state = applyMonthlyReportCalculation(emptyMonthlyReportCarryover, first, "2026-01-31T12:00:00.000Z");
    const repeated = calculateMonthlyReport((31 * 60 + 45) * 60_000, new Date(2026, 0, 31), state);

    expect(repeated.carriedInMinutes).toBe(0);
    expect(repeated.reportedHours).toBe(31);
    expect(repeated.carriedOutMinutes).toBe(45);
  });
});

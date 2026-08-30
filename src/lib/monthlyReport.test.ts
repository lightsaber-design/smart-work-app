import { describe, expect, it } from "vitest";
import {
  applyMonthlyReportCalculation,
  calculateMonthlyReport,
  emptyMonthlyReportCarryover,
  emptyMonthlyReportSent,
  parseMonthlyReportSent,
  setMonthlyReportSent,
} from "./monthlyReport";
import { reportReminderMonthKey } from "./notificationRules";

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

  it("still honors a pending carryover from a prior 'carryover'-mode month after switching to 'round'", () => {
    const january = calculateMonthlyReport((31 * 60 + 45) * 60_000, new Date(2026, 0, 31), emptyMonthlyReportCarryover, "carryover");
    expect(january.carriedOutMinutes).toBe(45);
    const state = applyMonthlyReportCalculation(emptyMonthlyReportCarryover, january, "2026-01-31T12:00:00.000Z");

    // El usuario cambia el ajuste a "round" antes de informar febrero: los 45
    // minutos pendientes de enero no deben perderse.
    const february = calculateMonthlyReport(32 * 60 * 60_000, new Date(2026, 1, 28), state, "round");

    expect(february.carriedInMinutes).toBe(45);
    expect(february.reportedHours).toBe(33); // (32h + 45min) redondeado
    expect(february.carriedOutMinutes).toBe(0); // el modo "round" no genera arrastre nuevo
  });
});

describe("monthly report sent flag", () => {
  it("marks and unmarks a month without touching the hours calculation", () => {
    const marked = setMonthlyReportSent(emptyMonthlyReportSent, "2026-08", true, "2026-08-31T10:00:00.000Z");
    expect(marked["2026-08"]).toBe("2026-08-31T10:00:00.000Z");
    expect(setMonthlyReportSent(marked, "2026-08", false)).toEqual({});
  });

  it("drops junk keys when parsing stored flags", () => {
    expect(parseMonthlyReportSent({ "2026-08": "x", nope: "y", "2026-13-01": "z", "2026-09": 5 })).toEqual({
      "2026-08": "x",
    });
  });

  it("marks the month that ENDS when the reminder window straddles the month change", () => {
    // El 1 de septiembre el informe pendiente sigue siendo el de agosto: si la
    // casilla marcara el mes en curso, el aviso de agosto nunca se callaria.
    expect(reportReminderMonthKey(new Date(2026, 8, 1, 10, 0))).toBe("2026-08");
    expect(reportReminderMonthKey(new Date(2026, 7, 31, 10, 0))).toBe("2026-08");
    expect(reportReminderMonthKey(new Date(2026, 7, 15, 10, 0))).toBeNull();
  });
});

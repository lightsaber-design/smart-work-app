import { describe, expect, it } from "vitest";
import { EstudioContact } from "@/hooks/useEstudios";
import { currentMonthKey, getForgottenContacts, getGoalStatus, timerLongRunFireAt, nextReportPrepareAt, nextReportDeliverAt, isReportDeliverWindow } from "./notificationRules";

function contact(overrides: Partial<EstudioContact>): EstudioContact {
  return {
    id: "contact-1",
    name: "Student",
    sessions: [],
    active: true,
    createdAt: new Date(2026, 4, 1).toISOString(),
    ...overrides,
  };
}

describe("notification rules", () => {
  it("fires long-running timer notifications exactly three hours after start", () => {
    const start = new Date(2026, 4, 10, 9, 15);

    expect(timerLongRunFireAt(start)).toEqual(new Date(2026, 4, 10, 12, 15));
  });

  it("reports reached monthly goals before reminders", () => {
    expect(getGoalStatus(30, 30 * 3_600_000, new Date(2026, 4, 25))).toEqual({ kind: "reached" });
  });

  it("only reminds near month end when more than two hours remain", () => {
    expect(getGoalStatus(30, 20 * 3_600_000, new Date(2026, 4, 27))).toEqual({
      kind: "reminder",
      daysLeft: 4,
      remainingHours: 10,
    });
    expect(getGoalStatus(30, 29 * 3_600_000, new Date(2026, 4, 27))).toEqual({ kind: "none" });
    expect(getGoalStatus(30, 20 * 3_600_000, new Date(2026, 4, 20))).toEqual({ kind: "none" });
  });

  it("formats month keys with a leading zero", () => {
    expect(currentMonthKey(new Date(2026, 0, 1))).toBe("2026-01");
  });

  it("finds active study contacts with no upcoming work for more than fourteen days", () => {
    const now = new Date(2026, 4, 20, 12);
    const forgotten = contact({
      id: "forgotten",
      sessions: [{ id: "done", date: new Date(2026, 4, 1).toISOString(), time: "10:00", files: [], pending: false }],
    });
    const upcoming = contact({
      id: "upcoming",
      sessions: [{ id: "pending", date: new Date(2026, 4, 21).toISOString(), time: "10:00", files: [], pending: true }],
    });
    const archived = contact({ id: "archived", active: false });

    expect(getForgottenContacts([forgotten, upcoming, archived], now).map((item) => item.id)).toEqual(["forgotten"]);
  });

  it("schedules the report 'prepare' reminder for the last day of the month at 9:00", () => {
    // Mitad de mayo → último día de mayo (31) a las 9:00.
    expect(nextReportPrepareAt(new Date(2026, 4, 15, 12))).toEqual(new Date(2026, 4, 31, 9, 0, 0, 0));
  });

  it("rolls the 'prepare' reminder to next month once this month's last day passed", () => {
    // 31 de mayo a las 10:00 (ya pasó el aviso) → último día de junio (30).
    expect(nextReportPrepareAt(new Date(2026, 4, 31, 10))).toEqual(new Date(2026, 5, 30, 9, 0, 0, 0));
  });

  it("schedules the report 'deliver' reminder for day 1 at 9:00", () => {
    // Mitad de mayo → día 1 de junio a las 9:00.
    expect(nextReportDeliverAt(new Date(2026, 4, 15, 12))).toEqual(new Date(2026, 5, 1, 9, 0, 0, 0));
    // Día 1 antes de las 9:00 → hoy mismo a las 9:00.
    expect(nextReportDeliverAt(new Date(2026, 5, 1, 7))).toEqual(new Date(2026, 5, 1, 9, 0, 0, 0));
  });

  it("opens the deliver retry window only on the first days of the month", () => {
    expect(isReportDeliverWindow(new Date(2026, 5, 1, 7))).toBe(false); // día 1 antes de las 9
    expect(isReportDeliverWindow(new Date(2026, 5, 1, 9))).toBe(true);  // día 1 a las 9
    expect(isReportDeliverWindow(new Date(2026, 5, 3, 0))).toBe(true);  // día 3 a cualquier hora
    expect(isReportDeliverWindow(new Date(2026, 5, 4, 12))).toBe(false); // día 4 ya fuera
  });
});

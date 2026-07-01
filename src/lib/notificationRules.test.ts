import { describe, expect, it } from "vitest";
import { EstudioContact } from "@/hooks/useEstudios";
import { currentMonthKey, getForgottenContacts, getGoalStatus, timerLongRunFireAt, nextReportPrepareAt, nextReportDeliverAt, isReportDeliverWindow, missedStudyFireAt, unloggedFireAt, goalReminderFireAt, forgottenFireAt, hasUpcomingSession, lastStudyActivityDate, nextWeekdayAt } from "./notificationRules";

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

  it("schedules missed-study and unlogged alarms with their grace margins", () => {
    const base = new Date(2026, 4, 10, 10, 0, 0, 0);
    expect(missedStudyFireAt(base)).toEqual(new Date(2026, 4, 10, 10, 5, 0, 0));
    expect(unloggedFireAt(base)).toEqual(new Date(2026, 4, 10, 10, 30, 0, 0));
  });

  it("schedules the monthly-goal reminder five days before month end at 9:00", () => {
    // Mayo tiene 31 días → recordatorio el día 26 a las 9:00.
    expect(goalReminderFireAt(new Date(2026, 4, 3, 12))).toEqual(new Date(2026, 4, 26, 9, 0, 0, 0));
    // Febrero 2026 tiene 28 días → día 23.
    expect(goalReminderFireAt(new Date(2026, 1, 10))).toEqual(new Date(2026, 1, 23, 9, 0, 0, 0));
  });

  it("schedules the forgotten-contact alarm 14 days after last activity at 9:00", () => {
    expect(forgottenFireAt(new Date(2026, 4, 1, 15, 30))).toEqual(new Date(2026, 4, 15, 9, 0, 0, 0));
  });

  it("finds the next future weekday occurrence at a given time", () => {
    // 2026-05-11 es lunes (getDay 1). Próximo martes (2) a las 10:00 → 2026-05-12 10:00.
    expect(nextWeekdayAt(2, "10:00", new Date(2026, 4, 11, 12))).toEqual(new Date(2026, 4, 12, 10, 0, 0, 0));
    // Si hoy es el día pero la hora ya pasó, salta a la semana siguiente.
    expect(nextWeekdayAt(1, "10:00", new Date(2026, 4, 11, 12))).toEqual(new Date(2026, 4, 18, 10, 0, 0, 0));
  });

  it("derives last study activity and upcoming-session state per contact", () => {
    const now = new Date(2026, 4, 20, 12);
    const withDone = contact({
      createdAt: new Date(2026, 3, 1).toISOString(),
      sessions: [{ id: "d", date: new Date(2026, 4, 5).toISOString(), time: "10:00", files: [], pending: false }],
    });
    expect(lastStudyActivityDate(withDone)).toEqual(new Date(new Date(2026, 4, 5).toISOString()));

    const neverStudied = contact({ createdAt: new Date(2026, 3, 1).toISOString(), sessions: [] });
    expect(lastStudyActivityDate(neverStudied)).toEqual(new Date(new Date(2026, 3, 1).toISOString()));

    const upcoming = contact({
      sessions: [{ id: "p", date: new Date(2026, 4, 25).toISOString(), time: "10:00", files: [], pending: true }],
    });
    expect(hasUpcomingSession(upcoming, now)).toBe(true);
    expect(hasUpcomingSession(neverStudied, now)).toBe(false);
  });
});

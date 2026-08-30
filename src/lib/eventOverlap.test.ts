import { describe, expect, it } from "vitest";
import { eventsOverlap, hasStarted, isCoveredByLoggedActivity, estimatedEventEnd } from "./eventOverlap";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

function ev(id: string, start: Date, endTime?: string, completed = false): CalendarEvent {
  return {
    id,
    date: start,
    endTime,
    category: "Predi",
    reminderMinutesBefore: 0,
    notified: false,
    recurrence: "none",
    completed,
  };
}

const d = (h: number, m = 0) => new Date(2026, 7, 20, h, m);

describe("eventOverlap", () => {
  it("assumes one hour for an event with no end time", () => {
    expect(estimatedEventEnd(ev("a", d(10)))).toEqual(d(11));
  });

  it("detects overlap only within the same calendar day", () => {
    expect(eventsOverlap(ev("a", d(10), "12:00"), ev("b", d(11), "13:00"))).toBe(true);
    expect(eventsOverlap(ev("a", d(10), "11:00"), ev("b", d(11), "12:00"))).toBe(false); // se tocan, no solapan
    const nextDay = new Date(2026, 7, 21, 10, 30);
    expect(eventsOverlap(ev("a", d(10), "12:00"), ev("b", nextDay, "12:00"))).toBe(false);
  });

  it("treats a scheduled event as covered by a logged activity on its slot", () => {
    const scheduled = ev("sched", d(10), "11:00");
    const logged = ev("logged", d(10, 15), "10:50", true);
    expect(isCoveredByLoggedActivity(scheduled, [scheduled, logged])).toBe(true);
  });

  it("does not treat the running timer's own event as a logged activity", () => {
    // El evento del timer en curso se guarda completado pero SIN hora de fin:
    // no debe borrar ni silenciar todavía al evento programado de referencia.
    const scheduled = ev("sched", d(10), "11:00");
    const running = ev("running", d(10, 15), undefined, true);
    expect(isCoveredByLoggedActivity(scheduled, [scheduled, running])).toBe(false);
  });

  it("never reports an already-completed event as covered (no hours are dropped)", () => {
    const done = ev("done", d(10), "11:00", true);
    const other = ev("other", d(10, 10), "10:50", true);
    expect(isCoveredByLoggedActivity(done, [done, other])).toBe(false);
  });

  it("never discards a reference event that has not started yet", () => {
    // Fichar a las 10:00 no puede borrar el recordatorio de las 10:30: todavia
    // no ha llegado su hora y sigue siendo algo que piensas hacer.
    const now = d(10, 5);
    const upcoming = ev("upcoming", d(10, 30), "11:30");
    const logged = ev("logged", d(10), "11:00", true);
    expect(hasStarted(upcoming, now)).toBe(false);
    expect(isCoveredByLoggedActivity(upcoming, [upcoming, logged], now)).toBe(false);
  });

  it("discards it once its time has passed and real work covered the slot", () => {
    const later = d(12);
    const past = ev("past", d(10, 30), "11:30");
    const logged = ev("logged", d(10), "11:00", true);
    expect(hasStarted(past, later)).toBe(true);
    expect(isCoveredByLoggedActivity(past, [past, logged], later)).toBe(true);
  });

  it("leaves a past reference alone when nothing was logged over it", () => {
    // Se queda en el pasado SIN marcar, para que puedas marcarlo tu.
    const later = d(12);
    const past = ev("past", d(10, 30), "11:30");
    expect(isCoveredByLoggedActivity(past, [past], later)).toBe(false);
    expect(past.completed).toBe(false);
  });
});

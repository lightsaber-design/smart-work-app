import type { EstudioContact } from "@/hooks/useEstudios";

// ── Regla 1: Timer activo más de N horas ──────────────────────────────────────
export const TIMER_LONG_RUN_MS = 3 * 60 * 60 * 1000; // 3 horas

export function timerLongRunFireAt(startTime: Date): Date {
  return new Date(startTime.getTime() + TIMER_LONG_RUN_MS);
}

// ── Regla 3: Meta mensual ─────────────────────────────────────────────────────
export function daysLeftInMonth(now = new Date()): number {
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return last.getDate() - now.getDate();
}

export type GoalStatus =
  | { kind: "reached" }
  | { kind: "reminder"; daysLeft: number; remainingHours: number }
  | { kind: "none" };

export function getGoalStatus(
  goalHours: number,
  doneMs: number,
  now = new Date()
): GoalStatus {
  if (!goalHours || goalHours <= 0) return { kind: "none" };
  const goalMs = goalHours * 3_600_000;
  if (doneMs >= goalMs) return { kind: "reached" };
  const daysLeft = daysLeftInMonth(now);
  const remainingHours = (goalMs - doneMs) / 3_600_000;
  if (daysLeft <= 5 && remainingHours > 2) {
    return { kind: "reminder", daysLeft, remainingHours };
  }
  return { kind: "none" };
}

/** Clave para evitar repetir avisos: mes actual YYYY-MM */
export function currentMonthKey(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── Regla 4: Contacto activo sin cita próxima >14 días ───────────────────────
const FORGOTTEN_DAYS = 14;

export function getForgottenContacts(
  contacts: EstudioContact[],
  now = new Date()
): EstudioContact[] {
  const nowMs = now.getTime();
  return contacts.filter((c) => {
    if (!c.active) return false;
    const hasUpcoming = (c.sessions ?? []).some(
      (s) => s.pending && new Date(s.date).getTime() > nowMs
    );
    if (hasUpcoming) return false;
    const done = (c.sessions ?? []).filter((s) => !s.pending);
    if (done.length === 0) {
      // Nunca tuvo sesión; avisa si fue creado hace >14 días
      return nowMs - new Date(c.createdAt).getTime() > FORGOTTEN_DAYS * 86_400_000;
    }
    const last = done.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )[0];
    return (nowMs - new Date(last.date).getTime()) / 86_400_000 > FORGOTTEN_DAYS;
  });
}

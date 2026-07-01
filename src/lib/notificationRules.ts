import { isSessionDone, type EstudioContact } from "@/hooks/useEstudios";

// ── Regla 1: Timer activo más de N horas ──────────────────────────────────────
export const TIMER_LONG_RUN_MS = 3 * 60 * 60 * 1000; // 3 horas

export function timerLongRunFireAt(startTime: Date): Date {
  return new Date(startTime.getTime() + TIMER_LONG_RUN_MS);
}

// ── Regla 3: Meta mensual ─────────────────────────────────────────────────────
function daysLeftInMonth(now = new Date()): number {
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

// ── Regla 5: Recordatorio de informe mensual ─────────────────────────────────
// El informe se envía por el mes en curso (ver StatsView). Recordamos dos veces:
//  · "prepara" el último día del mes a las 9:00 (cierra y envía antes del cambio).
//  · "envía" el día 1 del mes siguiente a las 9:00 (por si no lo enviaste a tiempo).
export const REPORT_REMINDER_HOUR = 9;

/** Próximo "último día de mes" a las `hour` que aún esté en el futuro. */
export function nextReportPrepareAt(now = new Date(), hour = REPORT_REMINDER_HOUR): Date {
  let d = new Date(now.getFullYear(), now.getMonth() + 1, 0, hour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d = new Date(now.getFullYear(), now.getMonth() + 2, 0, hour, 0, 0, 0);
  }
  return d;
}

/** Próximo "día 1 de mes" a las `hour` que aún esté en el futuro. */
export function nextReportDeliverAt(now = new Date(), hour = REPORT_REMINDER_HOUR): Date {
  let d = new Date(now.getFullYear(), now.getMonth(), 1, hour, 0, 0, 0);
  if (d.getTime() <= now.getTime()) {
    d = new Date(now.getFullYear(), now.getMonth() + 1, 1, hour, 0, 0, 0);
  }
  return d;
}

/**
 * ¿Estamos dentro de la ventana de reintento de "envía tu informe"?
 * Los primeros `days` días del mes; el día 1 sólo a partir de la hora del aviso.
 */
export function isReportDeliverWindow(
  now = new Date(),
  hour = REPORT_REMINDER_HOUR,
  days = 3
): boolean {
  const day = now.getDate();
  if (day > days) return false;
  return day > 1 || now.getHours() >= hour;
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
    const done = (c.sessions ?? []).filter(isSessionDone);
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

// ── Regla 6: horas de disparo para avisos nativos programados a futuro ─────────
// Convertimos avisos que antes se disparaban "en caliente" (solo con la app
// abierta) en alarmas con hora futura calculada desde los datos, para que Android
// las dispare aunque la app esté cerrada.

/** Estudio pendiente vencido: su fecha/hora + un pequeño margen. */
export function missedStudyFireAt(sessionDate: Date, graceMin = 5): Date {
  return new Date(sessionDate.getTime() + graceMin * 60_000);
}

/** Actividad del calendario sin fichar: su hora + un margen. */
export function unloggedFireAt(eventDate: Date, graceMin = 30): Date {
  return new Date(eventDate.getTime() + graceMin * 60_000);
}

/** Recordatorio de meta mensual: 5 días antes de fin de mes, a las `hour`. */
export function goalReminderFireAt(now = new Date(), hour = 9): Date {
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return new Date(now.getFullYear(), now.getMonth(), lastDay - 5, hour, 0, 0, 0);
}

/** Contacto olvidado: última actividad + N días, a las `hour`. */
export function forgottenFireAt(lastActivity: Date, days = FORGOTTEN_DAYS, hour = 9): Date {
  const d = new Date(lastActivity.getTime() + days * 86_400_000);
  d.setHours(hour, 0, 0, 0);
  return d;
}

/** ¿El contacto tiene una sesión pendiente en el futuro? (aún no "olvidado"). */
export function hasUpcomingSession(contact: EstudioContact, now = new Date()): boolean {
  const nowMs = now.getTime();
  return (contact.sessions ?? []).some(
    (s) => s.pending && new Date(s.date).getTime() > nowMs
  );
}

/** Fecha de la última actividad de estudio (sesión hecha) o, si no hay, su creación. */
export function lastStudyActivityDate(contact: EstudioContact): Date {
  const done = (contact.sessions ?? []).filter(isSessionDone);
  if (done.length === 0) return new Date(contact.createdAt);
  const last = done.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )[0];
  return new Date(last.date);
}

/** Próxima ocurrencia futura de un día de la semana (0=dom) a una hora "HH:MM". */
export function nextWeekdayAt(dayOfWeek: number, timeHHMM: string, now = new Date()): Date {
  const [h, m] = timeHHMM.split(":").map(Number);
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

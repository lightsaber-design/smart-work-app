/**
 * Combina una fecha base con una hora "HH:MM" (p.ej. el `endTime` de un
 * CalendarEvent), pasando al día siguiente si esa hora ya "ha pasado"
 * respecto a la hora de la fecha base — es decir, si la actividad cruza la
 * medianoche (empieza a las 22:00 y termina a las 02:00).
 *
 * Antes de esta función, varias copias de esta lógica interpretaban esa hora
 * como si fuera siempre el mismo día que el inicio, así que una actividad
 * que cruzaba medianoche calculaba una duración negativa y cortocircuitaba a
 * un valor arbitrario de "+1h" en vez de la hora real que cruza al día
 * siguiente.
 */
/**
 * Hora de fin segura para guardar en un evento, que almacena el fin como
 * "HH:MM" (truncado al minuto) mientras que el inicio lleva segundos.
 *
 * En una actividad de menos de un minuto (fichar y parar casi seguido, o el
 * widget reproduciendo CLOCK_IN + CLOCK_OUT juntos) ese fin truncado quedaría
 * ANTES del inicio, y `resolveEndDate` lo interpretaría como del día siguiente:
 * salía una duración de ~24h ("me guardó todo el día"). Garantizando un mínimo
 * de un minuto, el fin truncado siempre cae después del inicio.
 */
export function clampActivityEnd(start: Date, rawEnd: Date): Date {
  const minEndMs = start.getTime() + 60_000;
  return rawEnd.getTime() < minEndMs ? new Date(minEndMs) : rawEnd;
}

export function resolveEndDate(baseDate: Date, endTimeStr: string | undefined): Date | null {
  if (!endTimeStr) return null;
  const [hours, minutes] = endTimeStr.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const end = new Date(baseDate);
  end.setHours(hours, minutes, 0, 0);
  if (end.getTime() <= baseDate.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Una actividad de más de estas horas casi nunca es real: sale de invertir sin
 * querer inicio y fin al editar (poner el inicio DESPUÉS del fin), que
 * `resolveEndDate` interpreta —correctamente para el caso legítimo de 22:00 ->
 * 02:00— como que cruza la medianoche, y entonces guarda ~24 h de golpe.
 */
export const SUSPICIOUS_ACTIVITY_MS = 12 * 60 * 60_000;

/** Duración que implicaría guardar este inicio con esta hora de fin "HH:MM". */
export function impliedActivityMs(date: Date, endTime: string | undefined): number {
  const end = resolveEndDate(date, endTime);
  return end ? Math.max(0, end.getTime() - date.getTime()) : 0;
}

/** ¿Guardar esto crearía una actividad sospechosamente larga? */
export function isSuspiciouslyLongActivity(date: Date, endTime: string | undefined): boolean {
  return impliedActivityMs(date, endTime) > SUSPICIOUS_ACTIVITY_MS;
}

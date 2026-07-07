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
export function resolveEndDate(baseDate: Date, endTimeStr: string | undefined): Date | null {
  if (!endTimeStr) return null;
  const [hours, minutes] = endTimeStr.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const end = new Date(baseDate);
  end.setHours(hours, minutes, 0, 0);
  if (end.getTime() <= baseDate.getTime()) end.setDate(end.getDate() + 1);
  return end;
}

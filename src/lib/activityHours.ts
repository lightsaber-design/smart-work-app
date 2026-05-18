export const DEFAULT_ACTIVITY_START_HOUR = 6;
export const DEFAULT_ACTIVITY_END_HOUR = 22;

export interface ActivityHours {
  startHour: number;
  endHour: number;
}

export function clampActivityHour(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(23, Math.max(0, Math.round(value)));
}

export function normalizeActivityHours(startHour: unknown, endHour: unknown): ActivityHours {
  const start = clampActivityHour(startHour, DEFAULT_ACTIVITY_START_HOUR);
  const end = clampActivityHour(endHour, DEFAULT_ACTIVITY_END_HOUR);
  if (end <= start) {
    return { startHour: DEFAULT_ACTIVITY_START_HOUR, endHour: DEFAULT_ACTIVITY_END_HOUR };
  }
  return { startHour: start, endHour: end };
}

export function hourToTimeValue(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function clampTimeValueToHourRange(value: string, startHour: number, endHour: number): string {
  const [hours, minutes] = value.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  if (!Number.isFinite(totalMinutes) || totalMinutes < startMinutes) return hourToTimeValue(startHour);
  if (totalMinutes > endMinutes) return hourToTimeValue(endHour);
  return value;
}

export function formatHourRange(startHour: number, endHour: number): string {
  return `${hourToTimeValue(startHour)} - ${hourToTimeValue(endHour)}`;
}

export function formatDateLong(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
}

export function formatDateFull(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function formatMonthYear(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: "long", year: "numeric" });
}

export function formatShortMonth(date: Date, locale: string): string {
  return date.toLocaleDateString(locale, { month: "short" });
}

export function formatWeekday(date: Date, locale: string, format: "short" | "long" = "long"): string {
  return date.toLocaleDateString(locale, { weekday: format });
}

export function formatTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

export function formatHourLabel(hour: number, locale: string): string {
  return new Date(2024, 0, 1, hour, 0).toLocaleTimeString(locale, { hour: "numeric" });
}

/** Format milliseconds as "Xh Ym", "Xh" or "Ym". */
export function msToLabel(ms: number): string {
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

/** Stable string key for a calendar day, e.g. "2026-4-7". */
export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

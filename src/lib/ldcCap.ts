import type { EventCategory } from "@/hooks/useCalendarEvents";

export const MONTHLY_LDC_CAP_MS = 55 * 3_600_000;

export type CategoryTotal = {
  cat: EventCategory;
  ms: number;
};

export function applyMonthlyLdcCap(totals: CategoryTotal[], capMs = MONTHLY_LDC_CAP_MS): CategoryTotal[] {
  const nonLdcMs = totals
    .filter((item) => item.cat !== "LDC")
    .reduce((sum, item) => sum + item.ms, 0);
  const remainingForLdc = Math.max(0, capMs - nonLdcMs);

  return totals.map((item) =>
    item.cat === "LDC"
      ? { ...item, ms: Math.min(item.ms, remainingForLdc) }
      : item
  );
}

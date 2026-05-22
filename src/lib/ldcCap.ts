import type { EventCategory } from "@/hooks/useCalendarEvents";
import type { CategoryConfig } from "@/lib/categories";

export const MONTHLY_LDC_CAP_MS = 55 * 3_600_000;

export type CategoryTotal = {
  cat: EventCategory;
  ms: number;
};

export function applyMonthlyLdcCap(totals: CategoryTotal[], capMs = MONTHLY_LDC_CAP_MS): CategoryTotal[] {
  return applyMonthlySupportCap(totals, [{ name: "LDC", support: true }], capMs);
}

export function applyMonthlySupportCap(
  totals: CategoryTotal[],
  categories: Pick<CategoryConfig, "name" | "support">[],
  capMs = MONTHLY_LDC_CAP_MS
): CategoryTotal[] {
  const supportNames = new Set(categories.filter((category) => category.support).map((category) => category.name));
  const nonSupportMs = totals
    .filter((item) => !supportNames.has(item.cat))
    .reduce((sum, item) => sum + item.ms, 0);
  let remainingSupportMs = Math.max(0, capMs - nonSupportMs);

  return totals.map((item) => {
    if (!supportNames.has(item.cat)) return item;
    const ms = Math.min(item.ms, remainingSupportMs);
    remainingSupportMs = Math.max(0, remainingSupportMs - ms);
    return { ...item, ms };
  });
}

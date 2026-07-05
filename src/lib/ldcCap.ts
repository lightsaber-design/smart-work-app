import type { EventCategory } from "@/hooks/useCalendarEvents";
import type { CategoryConfig } from "@/lib/categories";
import { SUPPORT_CAP_HOURS } from "@/lib/categories";

// Deriva de SUPPORT_CAP_HOURS (categories.ts) en vez de repetir el número:
// dos constantes independientes para el mismo tope de 55h podían desincronizarse
// si una se cambiaba sin la otra (el aviso mostrado y el tope aplicado de verdad).
export const MONTHLY_LDC_CAP_MS = SUPPORT_CAP_HOURS * 3_600_000;

export type CategoryTotal = {
  cat: EventCategory;
  ms: number;
};

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

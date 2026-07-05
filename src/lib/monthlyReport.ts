export type MonthlyReportRoundingMode = "carryover" | "round";

export interface MonthlyReportRecord {
  carriedInMinutes: number;
  reportedHours: number;
  carriedOutMinutes: number;
  reportedAt: string;
}

export interface MonthlyReportCarryoverState {
  reports: Record<string, MonthlyReportRecord>;
}

export interface MonthlyReportCalculation {
  monthKey: string;
  actualMinutes: number;
  carriedInMinutes: number;
  totalMinutes: number;
  reportedHours: number;
  carriedOutMinutes: number;
}

export const emptyMonthlyReportCarryover: MonthlyReportCarryoverState = { reports: {} };

export function monthlyReportKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMinutes(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function parseMonthlyReportCarryover(value: unknown): MonthlyReportCarryoverState {
  if (typeof value !== "object" || value === null || !("reports" in value)) return emptyMonthlyReportCarryover;
  const rawReports = (value as { reports: unknown }).reports;
  if (typeof rawReports !== "object" || rawReports === null) return emptyMonthlyReportCarryover;

  const reports = Object.entries(rawReports).reduce<Record<string, MonthlyReportRecord>>((acc, [key, raw]) => {
    if (typeof raw !== "object" || raw === null) return acc;
    const record = raw as Partial<MonthlyReportRecord>;
    if (
      !isValidMinutes(record.carriedInMinutes) ||
      !isValidMinutes(record.reportedHours) ||
      !isValidMinutes(record.carriedOutMinutes) ||
      record.carriedOutMinutes >= 60 ||
      typeof record.reportedAt !== "string"
    ) {
      return acc;
    }
    acc[key] = {
      carriedInMinutes: record.carriedInMinutes,
      reportedHours: record.reportedHours,
      carriedOutMinutes: record.carriedOutMinutes,
      reportedAt: record.reportedAt,
    };
    return acc;
  }, {});

  return { reports };
}

function getCarriedInMinutes(state: MonthlyReportCarryoverState, monthKey: string): number {
  const currentReport = state.reports[monthKey];
  if (currentReport) return currentReport.carriedInMinutes;

  const previousKey = Object.keys(state.reports)
    .filter((key) => key < monthKey)
    .sort()
    .at(-1);

  return previousKey ? state.reports[previousKey].carriedOutMinutes : 0;
}

export function calculateMonthlyReport(
  actualMs: number,
  date: Date,
  state: MonthlyReportCarryoverState,
  mode: MonthlyReportRoundingMode = "carryover"
): MonthlyReportCalculation {
  const key = monthlyReportKey(date);
  const actualMinutes = Math.max(0, Math.floor(actualMs / 60_000));
  // En modo "round" no se genera arrastre saliente propio, pero si venía un
  // arrastre pendiente de un mes anterior en modo "carryover" (o de antes de
  // cambiar el ajuste), se sigue sumando esta vez para no perderlo: solo se
  // deja de generar arrastre nuevo, no se descarta el que ya existía.
  const carriedInMinutes = getCarriedInMinutes(state, key);
  const totalMinutes = actualMinutes + carriedInMinutes;

  return {
    monthKey: key,
    actualMinutes,
    carriedInMinutes,
    totalMinutes,
    reportedHours: mode === "round" ? Math.round(totalMinutes / 60) : Math.floor(totalMinutes / 60),
    carriedOutMinutes: mode === "round" ? 0 : totalMinutes % 60,
  };
}

export function applyMonthlyReportCalculation(
  state: MonthlyReportCarryoverState,
  calculation: MonthlyReportCalculation,
  reportedAt = new Date().toISOString()
): MonthlyReportCarryoverState {
  return {
    reports: {
      ...state.reports,
      [calculation.monthKey]: {
        carriedInMinutes: calculation.carriedInMinutes,
        reportedHours: calculation.reportedHours,
        carriedOutMinutes: calculation.carriedOutMinutes,
        reportedAt,
      },
    },
  };
}

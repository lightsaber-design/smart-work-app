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
  if (currentReport) return Math.max(0, currentReport.carriedInMinutes);

  const previousKey = Object.keys(state.reports)
    .filter((key) => key < monthKey)
    .sort()
    .at(-1);

  return previousKey ? Math.max(0, state.reports[previousKey].carriedOutMinutes) : 0;
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
  const totalMinutes = Math.max(0, actualMinutes + carriedInMinutes);

  return {
    monthKey: key,
    actualMinutes,
    carriedInMinutes,
    totalMinutes,
    // Clamps defensivos: ni las horas del informe ni los minutos de arrastre
    // deben poder mostrarse en negativo (el arrastre solo acumula/reparte, nunca
    // resta). `((x % 60) + 60) % 60` evita un módulo negativo si algún dato
    // heredado llegara corrupto.
    reportedHours: Math.max(0, mode === "round" ? Math.round(totalMinutes / 60) : Math.floor(totalMinutes / 60)),
    carriedOutMinutes: mode === "round" ? 0 : ((totalMinutes % 60) + 60) % 60,
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

// ── "Informe ya enviado" ─────────────────────────────────────────────────────
// Registro aparte del arrastre, a propósito: marcar un informe como enviado NO
// debe tocar el cálculo de horas ni la cadena de arrastre. Hace falta separarlo
// porque el informe se envía a caballo entre dos meses (el último día o los
// primeros del siguiente), así que la casilla tiene que poder marcar el mes
// ANTERIOR sin recalcular nada con las horas del mes en curso.
export type MonthlyReportSentState = Record<string, string>;

export const emptyMonthlyReportSent: MonthlyReportSentState = {};

export function parseMonthlyReportSent(value: unknown): MonthlyReportSentState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return emptyMonthlyReportSent;
  return Object.entries(value).reduce<MonthlyReportSentState>((acc, [key, raw]) => {
    if (/^\d{4}-\d{2}$/.test(key) && typeof raw === "string" && raw) acc[key] = raw;
    return acc;
  }, {});
}

export function setMonthlyReportSent(
  state: MonthlyReportSentState,
  monthKey: string,
  sent: boolean,
  sentAt = new Date().toISOString()
): MonthlyReportSentState {
  if (!sent) {
    const { [monthKey]: _removed, ...rest } = state;
    return rest;
  }
  return { ...state, [monthKey]: sentAt };
}

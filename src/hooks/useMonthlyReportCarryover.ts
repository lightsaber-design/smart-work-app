import { useCallback, useEffect, useState } from "react";
import {
  applyMonthlyReportCalculation,
  emptyMonthlyReportCarryover,
  emptyMonthlyReportSent,
  MonthlyReportCalculation,
  MonthlyReportCarryoverState,
  MonthlyReportSentState,
  parseMonthlyReportCarryover,
  parseMonthlyReportSent,
  setMonthlyReportSent,
} from "@/lib/monthlyReport";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export function useMonthlyReportCarryover() {
  const [carryover, setCarryover] = useState<MonthlyReportCarryoverState>(emptyMonthlyReportCarryover);
  const [reportSent, setReportSent] = useState<MonthlyReportSentState>(emptyMonthlyReportSent);

  useEffect(() => {
    readJsonValue<unknown>("monthly-report-carryover", emptyMonthlyReportCarryover)
      .then((value) => setCarryover(parseMonthlyReportCarryover(value)))
      .catch((error) => console.error("Error loading monthly report carryover:", error));
    readJsonValue<unknown>("monthly-report-sent", emptyMonthlyReportSent)
      .then((value) => setReportSent(parseMonthlyReportSent(value)))
      .catch((error) => console.error("Error loading monthly report sent flags:", error));
  }, []);

  const saveMonthlyReport = useCallback((calculation: MonthlyReportCalculation) => {
    setCarryover((prev) => {
      const next = applyMonthlyReportCalculation(prev, calculation);
      void writeJsonValue("monthly-report-carryover", next).catch((error) =>
        console.error("Error saving monthly report carryover:", error)
      );
      return next;
    });
  }, []);

  /** Marca/desmarca un mes como "informe ya enviado" (la casilla del Resumen). */
  const markReportSent = useCallback((monthKey: string, sent: boolean) => {
    setReportSent((prev) => {
      const next = setMonthlyReportSent(prev, monthKey, sent);
      void writeJsonValue("monthly-report-sent", next).catch((error) =>
        console.error("Error saving monthly report sent flags:", error)
      );
      return next;
    });
  }, []);

  return { carryover, saveMonthlyReport, reportSent, markReportSent };
}

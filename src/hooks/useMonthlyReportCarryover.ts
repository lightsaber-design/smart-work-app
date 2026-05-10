import { useCallback, useEffect, useState } from "react";
import {
  applyMonthlyReportCalculation,
  emptyMonthlyReportCarryover,
  MonthlyReportCalculation,
  MonthlyReportCarryoverState,
  parseMonthlyReportCarryover,
} from "@/lib/monthlyReport";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export function useMonthlyReportCarryover() {
  const [carryover, setCarryover] = useState<MonthlyReportCarryoverState>(emptyMonthlyReportCarryover);

  useEffect(() => {
    readJsonValue<unknown>("monthly-report-carryover", emptyMonthlyReportCarryover)
      .then((value) => setCarryover(parseMonthlyReportCarryover(value)))
      .catch((error) => console.error("Error loading monthly report carryover:", error));
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

  return { carryover, saveMonthlyReport };
}

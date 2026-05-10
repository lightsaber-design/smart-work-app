import { useState, useCallback, useEffect } from "react";
import { EventCategory } from "@/hooks/useCalendarEvents";
import { CATEGORY_LIST } from "@/lib/categories";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export function useCategoryFilter() {
  const [excluded, setExcluded] = useState<Set<EventCategory>>(new Set());

  useEffect(() => {
    readJsonValue<unknown[]>("excludedCategories", [])
      .then((parsed) => {
        setExcluded(new Set(parsed.filter((v): v is EventCategory => CATEGORY_LIST.includes(v as EventCategory))));
      })
      .catch((error) => console.error("Error loading category filters:", error));
  }, []);

  const toggle = useCallback((cat: EventCategory) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      void writeJsonValue("excludedCategories", [...next]).catch((error) => console.error("Error saving category filters:", error));
      return next;
    });
  }, []);

  const isIncluded = useCallback(
    (cat: EventCategory) => !excluded.has(cat),
    [excluded]
  );

  return { excluded, toggle, isIncluded };
}

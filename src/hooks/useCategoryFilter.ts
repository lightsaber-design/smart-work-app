import { useState, useCallback } from "react";
import { EventCategory } from "@/hooks/useCalendarEvents";
import { CATEGORY_LIST } from "@/lib/categories";

const STORAGE_KEY = "excludedCategories";

function load(): Set<EventCategory> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown[];
    return new Set(parsed.filter((v): v is EventCategory => CATEGORY_LIST.includes(v as EventCategory)));
  } catch {
    return new Set();
  }
}

function save(excluded: Set<EventCategory>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...excluded]));
  } catch { /* ignore */ }
}

export function useCategoryFilter() {
  const [excluded, setExcluded] = useState<Set<EventCategory>>(load);

  const toggle = useCallback((cat: EventCategory) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      save(next);
      return next;
    });
  }, []);

  const isIncluded = useCallback(
    (cat: EventCategory) => !excluded.has(cat),
    [excluded]
  );

  return { excluded, toggle, isIncluded };
}

import { useState, useCallback } from "react";
import { Lang, detectLanguage } from "@/lib/i18n";

export interface SetupData {
  name?: string;
  city: { name: string; lat: number; lng: number } | null;
  isPrecursor: boolean;
  hasBibleStudies: boolean;
  completed: boolean;
  language?: Lang;
}

const DEFAULT: SetupData = {
  city: null,
  isPrecursor: false,
  hasBibleStudies: false,
  completed: false,
  language: detectLanguage(),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLanguage(value: unknown): value is Lang {
  return value === "es" || value === "en" || value === "pt";
}

function parseStoredCity(value: unknown): SetupData["city"] {
  if (!isRecord(value) || typeof value.name !== "string") return null;
  if (typeof value.lat !== "number" || typeof value.lng !== "number") return null;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  return { name: value.name, lat: value.lat, lng: value.lng };
}

function parseStoredSetup(value: unknown): SetupData {
  if (!isRecord(value)) return DEFAULT;

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    city: parseStoredCity(value.city),
    isPrecursor: typeof value.isPrecursor === "boolean" ? value.isPrecursor : DEFAULT.isPrecursor,
    hasBibleStudies: typeof value.hasBibleStudies === "boolean" ? value.hasBibleStudies : DEFAULT.hasBibleStudies,
    completed: typeof value.completed === "boolean" ? value.completed : DEFAULT.completed,
    language: isLanguage(value.language) ? value.language : DEFAULT.language,
  };
}

function load(): SetupData {
  try {
    const saved = localStorage.getItem("setup");
    return saved ? parseStoredSetup(JSON.parse(saved) as unknown) : DEFAULT;
  } catch {
    localStorage.removeItem("setup");
    return DEFAULT;
  }
}

export function useSetup() {
  const [setup, setSetup] = useState<SetupData>(load);

  const saveSetup = useCallback((data: Partial<SetupData>) => {
    setSetup((prev) => {
      const updated = { ...prev, ...data };
      try { localStorage.setItem("setup", JSON.stringify(updated)); } catch { /* ignorar */ }
      return updated;
    });
  }, []);

  const completeSetup = useCallback((data: Omit<SetupData, "completed">) => {
    const updated = { ...data, completed: true };
    try { localStorage.setItem("setup", JSON.stringify(updated)); } catch { /* ignorar */ }
    setSetup(updated);
  }, []);

  return { setup, saveSetup, completeSetup };
}

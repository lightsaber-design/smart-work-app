import { useState, useCallback, useEffect } from "react";
import { Lang, detectLanguage } from "@/lib/i18n";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export interface SetupData {
  name?: string;
  city: { name: string; lat: number; lng: number } | null;
  precursorHours: number | null;
  travelTimeEnabled: boolean;
  travelTimeMinutes: number;
  hasBibleStudies: boolean;
  completed: boolean;
  language?: Lang;
}

const DEFAULT: SetupData = {
  city: null,
  precursorHours: null,
  travelTimeEnabled: false,
  travelTimeMinutes: 0,
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
  const travelTimeMinutes = typeof value.travelTimeMinutes === "number" && Number.isFinite(value.travelTimeMinutes)
    ? Math.min(180, Math.max(0, Math.round(value.travelTimeMinutes)))
    : DEFAULT.travelTimeMinutes;

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    city: parseStoredCity(value.city),
    precursorHours: typeof value.precursorHours === "number"
      ? value.precursorHours
      : (value.isPrecursor === true ? 30 : DEFAULT.precursorHours),
    travelTimeEnabled: typeof value.travelTimeEnabled === "boolean" ? value.travelTimeEnabled : DEFAULT.travelTimeEnabled,
    travelTimeMinutes,
    hasBibleStudies: typeof value.hasBibleStudies === "boolean" ? value.hasBibleStudies : DEFAULT.hasBibleStudies,
    completed: typeof value.completed === "boolean" ? value.completed : DEFAULT.completed,
    language: isLanguage(value.language) ? value.language : DEFAULT.language,
  };
}

export function useSetup() {
  const [setup, setSetup] = useState<SetupData>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    readJsonValue("setup", DEFAULT)
      .then((value) => setSetup(parseStoredSetup(value)))
      .catch((error) => console.error("Failed to load setup data:", error))
      .finally(() => setLoading(false));
  }, []);

  const saveSetup = useCallback((data: Partial<SetupData>) => {
    setSetup((prev) => {
      const updated = { ...prev, ...data };
      void writeJsonValue("setup", updated).catch((error) => console.error("Failed to persist setup data:", error, updated));
      return updated;
    });
  }, []);

  const completeSetup = useCallback((data: Omit<SetupData, "completed">) => {
    const updated = { ...data, completed: true };
    setSetup(updated);
    void writeJsonValue("setup", updated).catch((error) => console.error("Failed to persist setup data:", error, updated));
  }, []);

  return { setup, loading, saveSetup, completeSetup };
}

import { useState, useCallback, useEffect } from "react";
import { Lang, detectLanguage } from "@/lib/i18n";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { DEFAULT_ACTIVITY_END_HOUR, DEFAULT_ACTIVITY_START_HOUR, normalizeActivityHours } from "@/lib/activityHours";
import { CategoryConfig, DEFAULT_CATEGORY_CONFIGS, normalizeCategoryConfigs } from "@/lib/categories";
import { isRecord } from "@/lib/utils";

export interface SetupData {
  name?: string;
  city: { name: string; lat: number; lng: number } | null;
  precursorHours: number | null;
  travelTimeEnabled: boolean;
  travelTimeMinutes: number;
  activityStartHour: number;
  activityEndHour: number;
  hasBibleStudies: boolean;
  categorySettings: CategoryConfig[];
  /** Categoría preseleccionada al abrir el cronómetro. */
  defaultCategory: string;
  completed: boolean;
  language?: Lang;
  notifTimerOverrun: boolean;
  notifTimer3h: boolean;
  notifMonthlyGoal: boolean;
  /** Aviso cuando pasa una actividad del calendario sin haberla fichado. */
  notifUnlogged: boolean;
  /** Recordatorio de fin/principio de mes para enviar el informe. */
  notifReport: boolean;
  /** Aumenta el tamaño de texto base para mejor legibilidad. */
  largeText: boolean;
  autoDarkMode: boolean;
  autoBackupEnabled: boolean;
  autoBackupFreq: 'daily' | 'weekly' | 'monthly';
  /** Qué hacer con los minutos sobrantes del informe mensual: arrastrarlos al mes siguiente o redondear sin arrastre. */
  monthlyReportRounding: 'carryover' | 'round';
}

const DEFAULT: SetupData = {
  city: null,
  precursorHours: null,
  travelTimeEnabled: false,
  travelTimeMinutes: 0,
  activityStartHour: DEFAULT_ACTIVITY_START_HOUR,
  activityEndHour: DEFAULT_ACTIVITY_END_HOUR,
  hasBibleStudies: false,
  categorySettings: DEFAULT_CATEGORY_CONFIGS,
  defaultCategory: "Predi",
  completed: false,
  language: detectLanguage(),
  notifTimerOverrun: true,
  notifTimer3h: true,
  notifMonthlyGoal: true,
  notifUnlogged: true,
  notifReport: true,
  largeText: false,
  autoDarkMode: false,
  autoBackupEnabled: false,
  autoBackupFreq: 'daily',
  monthlyReportRounding: 'carryover',
};

function isLanguage(value: unknown): value is Lang {
  return value === "es" || value === "en" || value === "pt" || value === "fr" || value === "it" || value === "de";
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
  const activityHours = normalizeActivityHours(value.activityStartHour, value.activityEndHour);

  return {
    name: typeof value.name === "string" ? value.name : undefined,
    city: parseStoredCity(value.city),
    precursorHours: typeof value.precursorHours === "number"
      ? value.precursorHours
      : (value.isPrecursor === true ? 30 : DEFAULT.precursorHours),
    travelTimeEnabled: typeof value.travelTimeEnabled === "boolean" ? value.travelTimeEnabled : DEFAULT.travelTimeEnabled,
    travelTimeMinutes,
    activityStartHour: activityHours.startHour,
    activityEndHour: activityHours.endHour,
    hasBibleStudies: typeof value.hasBibleStudies === "boolean" ? value.hasBibleStudies : DEFAULT.hasBibleStudies,
    categorySettings: normalizeCategoryConfigs(value.categorySettings),
    defaultCategory: typeof value.defaultCategory === "string" ? value.defaultCategory : DEFAULT.defaultCategory,
    completed: typeof value.completed === "boolean" ? value.completed : DEFAULT.completed,
    language: isLanguage(value.language) ? value.language : DEFAULT.language,
    notifTimerOverrun: typeof value.notifTimerOverrun === "boolean" ? value.notifTimerOverrun : DEFAULT.notifTimerOverrun,
    notifTimer3h: typeof value.notifTimer3h === "boolean" ? value.notifTimer3h : DEFAULT.notifTimer3h,
    notifMonthlyGoal: typeof value.notifMonthlyGoal === "boolean" ? value.notifMonthlyGoal : DEFAULT.notifMonthlyGoal,
    notifUnlogged: typeof value.notifUnlogged === "boolean" ? value.notifUnlogged : DEFAULT.notifUnlogged,
    notifReport: typeof value.notifReport === "boolean" ? value.notifReport : DEFAULT.notifReport,
    largeText: typeof value.largeText === "boolean" ? value.largeText : DEFAULT.largeText,
    autoDarkMode: typeof value.autoDarkMode === "boolean" ? value.autoDarkMode : DEFAULT.autoDarkMode,
    autoBackupEnabled: typeof value.autoBackupEnabled === "boolean" ? value.autoBackupEnabled : DEFAULT.autoBackupEnabled,
    autoBackupFreq: (value.autoBackupFreq === 'daily' || value.autoBackupFreq === 'weekly' || value.autoBackupFreq === 'monthly') ? value.autoBackupFreq : DEFAULT.autoBackupFreq,
    monthlyReportRounding: value.monthlyReportRounding === 'round' ? 'round' : DEFAULT.monthlyReportRounding,
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

  const completeSetup = useCallback((data: Partial<Omit<SetupData, "completed">>) => {
    // Fusiona con los valores por defecto para que el objeto quede completo
    // aunque la pantalla de configuración sólo aporte un subconjunto de campos.
    const updated: SetupData = { ...DEFAULT, ...data, completed: true };
    setSetup(updated);
    void writeJsonValue("setup", updated).catch((error) => console.error("Failed to persist setup data:", error, updated));
  }, []);

  return { setup, loading, saveSetup, completeSetup };
}

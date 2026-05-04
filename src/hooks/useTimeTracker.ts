import { useState, useEffect, useCallback } from "react";
import { generateId } from "@/lib/uuid";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export type WorkCategory = "Predi" | "Carrito" | "LDC" | "Visitas" | "Estudio";

export interface TimeEntry {
  id: string;
  startTime: Date;
  endTime: Date | null;
  description: string;
  category: WorkCategory;
  startLocation: GeoLocation | null;
  endLocation: GeoLocation | null;
  linkedEventId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkCategory(value: unknown): value is WorkCategory {
  return value === "Predi" || value === "Carrito" || value === "LDC" || value === "Visitas" || value === "Estudio";
}

function parseGeoLocation(value: unknown): GeoLocation | null {
  if (!isRecord(value) || typeof value.lat !== "number" || typeof value.lng !== "number") return null;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  return { lat: value.lat, lng: value.lng };
}

function parseStoredEntry(value: unknown): TimeEntry | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;

  const startTime = new Date(String(value.startTime));
  if (Number.isNaN(startTime.getTime())) return null;

  const parsedEndTime = value.endTime ? new Date(String(value.endTime)) : null;

  return {
    id: value.id,
    startTime,
    endTime: parsedEndTime && !Number.isNaN(parsedEndTime.getTime()) ? parsedEndTime : null,
    description: typeof value.description === "string" ? value.description : "",
    category: isWorkCategory(value.category) ? value.category : "Predi",
    startLocation: parseGeoLocation(value.startLocation),
    endLocation: parseGeoLocation(value.endLocation),
    linkedEventId: typeof value.linkedEventId === "string" ? value.linkedEventId : undefined,
  };
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    try {
      const saved = localStorage.getItem("time-entries");
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (!Array.isArray(parsed)) throw new Error("bad format");
        return parsed.map(parseStoredEntry).filter((entry): entry is TimeEntry => entry !== null);
      }
    } catch {
      localStorage.removeItem("time-entries");
    }
    return [];
  });

  const activeEntry = entries.find((e) => e.endTime === null);
  const [isRunning, setIsRunning] = useState(() => entries.some((e) => e.endTime === null));
  const [elapsed, setElapsed] = useState(() => {
    const active = entries.find((e) => e.endTime === null);
    return active ? Math.floor((Date.now() - active.startTime.getTime()) / 1000) : 0;
  });

  useEffect(() => {
    try {
      localStorage.setItem("time-entries", JSON.stringify(entries));
    } catch (e) {
      console.error("Error guardando entradas:", e);
    }
  }, [entries]);

  useEffect(() => {
    if (!isRunning || !activeEntry) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeEntry.startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, activeEntry]);

  const clockIn = useCallback(
    async (
      category: WorkCategory = "Predi",
      onCreateEvent?: (params: { date: Date; category: WorkCategory; location?: GeoLocation }) => string,
      customTime?: Date
    ) => {
      const startTime = customTime ?? new Date();
      const linkedEventId = onCreateEvent?.({
        date: startTime,
        category,
      });
      const entry: TimeEntry = {
        id: generateId(),
        startTime,
        endTime: null,
        description: "",
        category,
        startLocation: null,
        endLocation: null,
        linkedEventId,
      };
      setEntries((prev) => [entry, ...prev]);
      setIsRunning(true);
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    },
    []
  );

  const clockOut = useCallback(
    async (onUpdateEvent?: (id: string, endTime: string) => void, customTime?: Date) => {
      const end = customTime ?? new Date();
      const endTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.endTime !== null) return e;
          if (e.linkedEventId) {
            onUpdateEvent?.(e.linkedEventId, endTimeStr);
          }
          return { ...e, endTime: end };
        })
      );
      setIsRunning(false);
      setElapsed(0);
    },
    []
  );

  const updateStartTime = useCallback((id: string, startTime: Date) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, startTime } : e))
    );
    setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, description } : e))
    );
  }, []);

  const updateCategory = useCallback((id: string, category: WorkCategory) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, category } : e))
    );
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const todayEntries = entries.filter((e) => {
    const today = new Date();
    return (
      e.startTime.getDate() === today.getDate() &&
      e.startTime.getMonth() === today.getMonth() &&
      e.startTime.getFullYear() === today.getFullYear()
    );
  });

  const todayTotal = todayEntries.reduce((acc, e) => {
    const end = e.endTime ? e.endTime.getTime() : Date.now();
    return acc + (end - e.startTime.getTime());
  }, 0);

  const monthEntries = entries.filter((e) => {
    const now = new Date();
    return (
      e.startTime.getMonth() === now.getMonth() &&
      e.startTime.getFullYear() === now.getFullYear()
    );
  });

  const monthTotal = monthEntries.reduce((acc, e) => {
    const end = e.endTime ? e.endTime.getTime() : Date.now();
    return acc + (end - e.startTime.getTime());
  }, 0);

  return {
    entries,
    todayEntries,
    monthEntries,
    isRunning,
    elapsed,
    clockIn,
    clockOut,
    updateStartTime,
    updateDescription,
    updateCategory,
    deleteEntry,
    todayTotal,
    monthTotal,
  };
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

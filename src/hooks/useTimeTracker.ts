import { useState, useEffect, useCallback, useMemo } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue } from "@/lib/jsonFileStorage";
import { useDebouncedJsonWriter } from "@/hooks/useDebouncedJsonWriter";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export type WorkCategory = string;

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
  return typeof value === "string" && value.trim().length > 0;
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

  let endTime: Date | null = null;
  if (value.endTime !== null && value.endTime !== undefined && value.endTime !== "") {
    const parsedEndTime = new Date(String(value.endTime));
    if (Number.isNaN(parsedEndTime.getTime())) return null;
    endTime = parsedEndTime;
  }

  return {
    id: value.id,
    startTime,
    endTime,
    description: typeof value.description === "string" ? value.description : "",
    category: isWorkCategory(value.category) ? value.category : "Predi",
    startLocation: parseGeoLocation(value.startLocation),
    endLocation: parseGeoLocation(value.endLocation),
    linkedEventId: typeof value.linkedEventId === "string" ? value.linkedEventId : undefined,
  };
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const persistEntries = useDebouncedJsonWriter("time-entries");

  const activeEntry = useMemo(() => entries.find((e) => e.endTime === null), [entries]);
  const [isRunning, setIsRunning] = useState(() => entries.some((e) => e.endTime === null));
  const [elapsed, setElapsed] = useState(() => {
    const active = entries.find((e) => e.endTime === null);
    return active ? Math.floor((Date.now() - active.startTime.getTime()) / 1000) : 0;
  });

  useEffect(() => {
    readJsonValue<unknown[]>("time-entries", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        const parsed = value.map(parseStoredEntry).filter((entry): entry is TimeEntry => entry !== null);
        setEntries(parsed);
        const active = parsed.find((e) => e.endTime === null);
        setIsRunning(Boolean(active));
        setElapsed(active ? Math.floor((Date.now() - active.startTime.getTime()) / 1000) : 0);
      })
      .catch((error) => console.error("Error loading entries:", error));
  }, []);

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
      setEntries((prev) => {
        const updated = [entry, ...prev];
        persistEntries(updated);
        return updated;
      });
      setIsRunning(true);
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    },
    [persistEntries]
  );

  const clockOut = useCallback(
    async (onUpdateEvent?: (id: string, endTime: string) => void, customTime?: Date) => {
      const end = customTime ?? new Date();
      const endTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      setEntries((prev) => {
        const updated = prev.map((e) => {
          if (e.endTime !== null) return e;
          if (e.linkedEventId) {
            onUpdateEvent?.(e.linkedEventId, endTimeStr);
          }
          return { ...e, endTime: end };
        });
        persistEntries(updated);
        return updated;
      });
      setIsRunning(false);
      setElapsed(0);
    },
    [persistEntries]
  );

  const updateStartTime = useCallback((id: string, startTime: Date) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, startTime } : e));
      persistEntries(updated);
      return updated;
    });
    setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
  }, [persistEntries]);

  const updateDescription = useCallback((id: string, description: string) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, description } : e));
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  const updateCategory = useCallback((id: string, category: WorkCategory) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, category } : e));
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const deletedEntry = prev.find((e) => e.id === id);
      const updated = prev.filter((e) => e.id !== id);
      persistEntries(updated);
      if (deletedEntry?.endTime === null) {
        setIsRunning(false);
        setElapsed(0);
      }
      return updated;
    });
  }, [persistEntries]);

  const todayEntries = useMemo(() => entries.filter((e) => {
    const today = new Date();
    return (
      e.startTime.getDate() === today.getDate() &&
      e.startTime.getMonth() === today.getMonth() &&
      e.startTime.getFullYear() === today.getFullYear()
    );
  }), [entries]);

  const todayTotal = useMemo(() => todayEntries.reduce((acc, e) => {
    const end = e.endTime ? e.endTime.getTime() : e.startTime.getTime() + elapsed * 1000;
    return acc + (end - e.startTime.getTime());
  }, 0), [todayEntries, elapsed]);

  const monthEntries = useMemo(() => entries.filter((e) => {
    const now = new Date();
    return (
      e.startTime.getMonth() === now.getMonth() &&
      e.startTime.getFullYear() === now.getFullYear()
    );
  }), [entries]);

  const monthTotal = useMemo(() => monthEntries.reduce((acc, e) => {
    const end = e.endTime ? e.endTime.getTime() : e.startTime.getTime() + elapsed * 1000;
    return acc + (end - e.startTime.getTime());
  }, 0), [monthEntries, elapsed]);

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
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

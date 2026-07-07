import { useState, useEffect, useCallback, useMemo } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue } from "@/lib/jsonFileStorage";
import { useDebouncedJsonWriter } from "@/hooks/useDebouncedJsonWriter";
import { isRecord } from "@/lib/utils";

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
  /** Si está en pausa, momento en que se pausó; null si corre o ya terminó. */
  pausedAt?: Date | null;
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

  let pausedAt: Date | null = null;
  if (value.pausedAt !== null && value.pausedAt !== undefined && value.pausedAt !== "") {
    const parsedPausedAt = new Date(String(value.pausedAt));
    if (!Number.isNaN(parsedPausedAt.getTime())) pausedAt = parsedPausedAt;
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
    pausedAt,
  };
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const persistEntries = useDebouncedJsonWriter("time-entries");

  const activeEntry = useMemo(() => entries.find((e) => e.endTime === null), [entries]);
  const isRunning = activeEntry !== undefined;
  const isPaused = activeEntry?.pausedAt != null;
  const [elapsed, setElapsed] = useState(0);

  // Segundos trabajados de una entrada: si está en pausa, congela en el momento
  // de la pausa; si corre, cuenta hasta ahora. El tiempo en pausa nunca cuenta
  // porque al reanudar se desplaza startTime hacia delante.
  const entryElapsedSeconds = (entry: TimeEntry) => {
    const ref = entry.pausedAt ? entry.pausedAt.getTime() : Date.now();
    return Math.max(0, Math.floor((ref - entry.startTime.getTime()) / 1000));
  };

  useEffect(() => {
    readJsonValue<unknown[]>("time-entries", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        const parsed = value.map(parseStoredEntry).filter((entry): entry is TimeEntry => entry !== null);
        setEntries(parsed);
        const active = parsed.find((e) => e.endTime === null);
        setElapsed(active ? entryElapsedSeconds(active) : 0);
      })
      .catch((error) => console.error("Error loading entries:", error));
  }, []);

  useEffect(() => {
    if (!activeEntry) return;
    // En pausa: congela el valor y no sigue contando.
    if (activeEntry.pausedAt) {
      setElapsed(entryElapsedSeconds(activeEntry));
      return;
    }
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - activeEntry.startTime.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

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
        pausedAt: null,
      };
      setEntries((prev) => {
        const updated = [entry, ...prev];
        persistEntries(updated);
        return updated;
      });
      setElapsed(Math.floor((Date.now() - startTime.getTime()) / 1000));
    },
    [persistEntries]
  );

  const clockOut = useCallback(
    async (onUpdateEvent?: (id: string, endTime: string) => void, customTime?: Date) => {
      setEntries((prev) => {
        const updated = prev.map((e) => {
          if (e.endTime !== null) return e;
          // Si se para estando en pausa, el fin del trabajo fue el momento de
          // la pausa (así la duración no incluye el hueco pausado).
          const end = customTime ?? e.pausedAt ?? new Date();
          const endTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
          if (e.linkedEventId) {
            onUpdateEvent?.(e.linkedEventId, endTimeStr);
          }
          return { ...e, endTime: end, pausedAt: null };
        });
        persistEntries(updated);
        return updated;
      });
      setElapsed(0);
    },
    [persistEntries]
  );

  // Pausa el cronómetro activo: marca el instante de la pausa.
  const pause = useCallback(() => {
    setEntries((prev) => {
      const updated = prev.map((e) =>
        e.endTime === null && e.pausedAt == null ? { ...e, pausedAt: new Date() } : e
      );
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  // Reanuda: desplaza startTime hacia delante el tiempo que estuvo en pausa,
  // de modo que (endTime - startTime) siga siendo el tiempo realmente trabajado.
  const resume = useCallback(() => {
    setEntries((prev) => {
      const updated = prev.map((e) => {
        if (e.endTime !== null || e.pausedAt == null) return e;
        const pausedMs = Date.now() - e.pausedAt.getTime();
        return { ...e, startTime: new Date(e.startTime.getTime() + pausedMs), pausedAt: null };
      });
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  const updateStartTime = useCallback((id: string, startTime: Date) => {
    // El inicio de una actividad en marcha nunca puede ser posterior a ahora
    // (produciría un elapsed/duración negativos que contaminan los totales).
    const clampedStart = startTime.getTime() > Date.now() ? new Date() : startTime;
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, startTime: clampedStart } : e));
      persistEntries(updated);
      return updated;
    });
    setElapsed(Math.max(0, Math.floor((Date.now() - clampedStart.getTime()) / 1000)));
  }, [persistEntries]);

  // Ajusta el inicio/fin de una entrada ya completada (p.ej. al editar sus
  // horas desde el calendario). A diferencia de updateStartTime, no toca
  // `elapsed` porque esa entrada no es la del cronómetro en marcha.
  const updateEntryTimes = useCallback((id: string, startTime: Date, endTime: Date) => {
    setEntries((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, startTime, endTime } : e));
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  // Desvincula (sin borrar) las entradas cuyo evento de calendario enlazado
  // acaba de eliminarse: las horas ya fichadas son reales y deben seguir
  // contando en las estadísticas aunque el evento de calendario desaparezca.
  const detachEntriesLinkedToEvents = useCallback((eventIds: string[]) => {
    if (eventIds.length === 0) return;
    setEntries((prev) => {
      let changed = false;
      const updated = prev.map((e) => {
        if (!e.linkedEventId || !eventIds.includes(e.linkedEventId)) return e;
        changed = true;
        const { linkedEventId: _linkedEventId, ...rest } = e;
        return rest;
      });
      if (!changed) return prev;
      persistEntries(updated);
      return updated;
    });
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

  const addManualEntry = useCallback((
    startTime: Date,
    endTime: Date,
    category: WorkCategory,
    description = "",
    location?: GeoLocation,
    linkedEventId?: string
  ) => {
    const entry: TimeEntry = {
      id: generateId(),
      startTime,
      endTime,
      description,
      category,
      startLocation: location ?? null,
      endLocation: null,
      linkedEventId,
    };
    setEntries((prev) => {
      const updated = [...prev, entry].sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
      persistEntries(updated);
      return updated;
    });
  }, [persistEntries]);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const deletedEntry = prev.find((e) => e.id === id);
      const updated = prev.filter((e) => e.id !== id);
      persistEntries(updated);
      if (deletedEntry?.endTime === null) setElapsed(0);
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
    isPaused,
    elapsed,
    clockIn,
    clockOut,
    pause,
    resume,
    updateStartTime,
    updateEntryTimes,
    updateDescription,
    updateCategory,
    addManualEntry,
    deleteEntry,
    detachEntriesLinkedToEvents,
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

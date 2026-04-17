import { useState, useEffect, useCallback } from "react";

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

function getCurrentPosition(): Promise<GeoLocation | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    const saved = localStorage.getItem("time-entries");
    if (saved) {
      return JSON.parse(saved).map((e: any) => ({
        ...e,
        startTime: new Date(e.startTime),
        endTime: e.endTime ? new Date(e.endTime) : null,
        startLocation: e.startLocation || null,
        endLocation: e.endLocation || null,
      }));
    }
    return [];
  });

  const [isRunning, setIsRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const activeEntry = entries.find((e) => e.endTime === null);

  useEffect(() => {
    localStorage.setItem("time-entries", JSON.stringify(entries));
  }, [entries]);

  useEffect(() => {
    if (activeEntry) {
      setIsRunning(true);
    }
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
      onCreateEvent?: (params: { date: Date; category: WorkCategory; location?: GeoLocation }) => string
    ) => {
      const location = await getCurrentPosition();
      const startTime = new Date();
      const linkedEventId = onCreateEvent?.({
        date: startTime,
        category,
        location: location || undefined,
      });
      const entry: TimeEntry = {
        id: crypto.randomUUID(),
        startTime,
        endTime: null,
        description: "",
        category,
        startLocation: location,
        endLocation: null,
        linkedEventId,
      };
      setEntries((prev) => [entry, ...prev]);
      setIsRunning(true);
      setElapsed(0);
    },
    []
  );

  const clockOut = useCallback(
    async (onUpdateEvent?: (id: string, endTime: string) => void) => {
      const location = await getCurrentPosition();
      const end = new Date();
      const endTimeStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
      setEntries((prev) =>
        prev.map((e) => {
          if (e.endTime !== null) return e;
          if (e.linkedEventId) {
            onUpdateEvent?.(e.linkedEventId, endTimeStr);
          }
          return { ...e, endTime: end, endLocation: location };
        })
      );
      setIsRunning(false);
      setElapsed(0);
    },
    []
  );

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

import { useState, useEffect, useCallback } from "react";

export interface TimeEntry {
  id: string;
  startTime: Date;
  endTime: Date | null;
  description: string;
}

export function useTimeTracker() {
  const [entries, setEntries] = useState<TimeEntry[]>(() => {
    const saved = localStorage.getItem("time-entries");
    if (saved) {
      return JSON.parse(saved).map((e: any) => ({
        ...e,
        startTime: new Date(e.startTime),
        endTime: e.endTime ? new Date(e.endTime) : null,
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

  const clockIn = useCallback(() => {
    const entry: TimeEntry = {
      id: crypto.randomUUID(),
      startTime: new Date(),
      endTime: null,
      description: "",
    };
    setEntries((prev) => [entry, ...prev]);
    setIsRunning(true);
    setElapsed(0);
  }, []);

  const clockOut = useCallback(() => {
    setEntries((prev) =>
      prev.map((e) => (e.endTime === null ? { ...e, endTime: new Date() } : e))
    );
    setIsRunning(false);
    setElapsed(0);
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, description } : e))
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

  const weekEntries = entries.filter((e) => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return e.startTime >= weekAgo;
  });

  const weekTotal = weekEntries.reduce((acc, e) => {
    const end = e.endTime ? e.endTime.getTime() : Date.now();
    return acc + (end - e.startTime.getTime());
  }, 0);

  return {
    entries,
    todayEntries,
    isRunning,
    elapsed,
    clockIn,
    clockOut,
    updateDescription,
    deleteEntry,
    todayTotal,
    weekTotal,
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

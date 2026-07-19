import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { isRecord } from "@/lib/utils";
import { resolveEndDate } from "@/lib/eventTime";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";

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

// La sesión activa (el cronómetro en marcha) es lo ÚNICO que este hook persiste
// aparte: apunta al evento de calendario en curso y guarda el instante de pausa.
// El inicio y la categoría se leen del propio evento, que es la fuente de verdad.
interface ActiveSession {
  linkedEventId: string;
  pausedAt: Date | null;
}

// Operaciones sobre el calendario (única fuente de verdad de las horas). El
// timer las usa para crear/cerrar/editar el evento asociado a cada actividad.
export interface TimeTrackerEventOps {
  addCompletedEventNow: (p: { date: Date; category: WorkCategory; location?: GeoLocation }) => string;
  updateEvent: (
    id: string,
    updates: { date?: Date; endTime?: string; category?: WorkCategory; completed?: boolean; notes?: string }
  ) => void;
  deleteEvent: (id: string, scope?: "single" | "all") => void;
}

function hhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseSession(value: unknown): ActiveSession | null {
  if (!isRecord(value) || typeof value.linkedEventId !== "string") return null;
  let pausedAt: Date | null = null;
  if (value.pausedAt !== null && value.pausedAt !== undefined && value.pausedAt !== "") {
    const d = new Date(String(value.pausedAt));
    if (!Number.isNaN(d.getTime())) pausedAt = d;
  }
  return { linkedEventId: value.linkedEventId, pausedAt };
}

// Parseo de las TimeEntries antiguas: solo se usa UNA vez para migrar los datos
// del formato viejo (dos almacenes) al nuevo (el calendario es la fuente).
function parseGeoLocation(value: unknown): GeoLocation | null {
  if (!isRecord(value) || typeof value.lat !== "number" || typeof value.lng !== "number") return null;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  return { lat: value.lat, lng: value.lng };
}

function parseLegacyEntry(value: unknown): TimeEntry | null {
  if (!isRecord(value) || typeof value.id !== "string") return null;
  const startTime = new Date(String(value.startTime));
  if (Number.isNaN(startTime.getTime())) return null;
  let endTime: Date | null = null;
  if (value.endTime !== null && value.endTime !== undefined && value.endTime !== "") {
    const parsed = new Date(String(value.endTime));
    if (Number.isNaN(parsed.getTime())) return null;
    endTime = parsed;
  }
  let pausedAt: Date | null = null;
  if (value.pausedAt !== null && value.pausedAt !== undefined && value.pausedAt !== "") {
    const parsed = new Date(String(value.pausedAt));
    if (!Number.isNaN(parsed.getTime())) pausedAt = parsed;
  }
  return {
    id: value.id,
    startTime,
    endTime,
    description: typeof value.description === "string" ? value.description : "",
    category: typeof value.category === "string" && value.category.trim() ? value.category : "Predi",
    startLocation: parseGeoLocation(value.startLocation),
    endLocation: parseGeoLocation(value.endLocation),
    linkedEventId: typeof value.linkedEventId === "string" ? value.linkedEventId : undefined,
    pausedAt,
  };
}

/**
 * Registro de tiempo. Fuente ÚNICA de verdad: los eventos del calendario. Las
 * actividades completadas (`entries`) se DERIVAN de los eventos completados; no
 * hay un segundo almacén que pueda desincronizarse. Lo único propio del timer es
 * la sesión activa (qué evento está en curso + la pausa), que sí se persiste.
 */
export function useTimeTracker(events: CalendarEvent[], ops: TimeTrackerEventOps, eventsLoaded: boolean) {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // ops cambia de identidad en cada render (callbacks del calendario); se guarda
  // en un ref para que los callbacks del timer no dependan de él y no se
  // recreen en cada render.
  const opsRef = useRef(ops);
  opsRef.current = ops;

  const persistSession = useCallback((s: ActiveSession | null) => {
    void writeJsonValue(
      "active-session",
      s ? { linkedEventId: s.linkedEventId, pausedAt: s.pausedAt ? s.pausedAt.toISOString() : null } : null
    ).catch((e) => console.error("Error saving active session:", e));
  }, []);

  // ── Actividades completadas: derivadas de los eventos completados ────────────
  const completedEntries = useMemo<TimeEntry[]>(() => {
    const out: TimeEntry[] = [];
    for (const ev of events) {
      if (!ev.completed) continue;
      const end = resolveEndDate(ev.date, ev.endTime);
      if (!end || end.getTime() <= ev.date.getTime()) continue; // sin duración (p.ej. el evento del timer en curso)
      out.push({
        id: ev.id,
        startTime: ev.date,
        endTime: end,
        description: ev.notes ?? "",
        category: ev.category,
        startLocation: ev.location ?? null,
        endLocation: null,
        linkedEventId: ev.id,
        pausedAt: null,
      });
    }
    return out.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }, [events]);

  // ── Sesión activa: derivada del evento en curso + la pausa ───────────────────
  const activeEvent = useMemo(
    () => (session ? events.find((e) => e.id === session.linkedEventId) ?? null : null),
    [session, events]
  );

  const activeEntry = useMemo<TimeEntry | undefined>(() => {
    if (!session || !activeEvent) return undefined;
    return {
      id: activeEvent.id,
      startTime: activeEvent.date,
      endTime: null,
      description: activeEvent.notes ?? "",
      category: activeEvent.category,
      startLocation: activeEvent.location ?? null,
      endLocation: null,
      linkedEventId: activeEvent.id,
      pausedAt: session.pausedAt,
    };
  }, [session, activeEvent]);

  const entries = useMemo(
    () => (activeEntry ? [activeEntry, ...completedEntries] : completedEntries),
    [activeEntry, completedEntries]
  );
  const isRunning = activeEntry !== undefined;
  const isPaused = session?.pausedAt != null;

  // ── Migración única + carga de la sesión ─────────────────────────────────────
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current || !eventsLoaded) return;
    migratedRef.current = true;
    (async () => {
      let sess = parseSession(await readJsonValue<unknown>("active-session", null).catch(() => null));

      // Migra el formato antiguo (almacén `time-entries` independiente) al nuevo:
      // por cada actividad completada que no tenga ya su evento, se crea; la
      // entrada abierta (timer en curso) se convierte en sesión activa.
      const legacy = await readJsonValue<unknown[]>("time-entries", []).catch(() => []);
      if (Array.isArray(legacy) && legacy.length > 0) {
        const parsed = legacy.map(parseLegacyEntry).filter((e): e is TimeEntry => e !== null);
        const eventIds = new Set(events.map((e) => e.id));
        for (const e of parsed) {
          if (e.endTime) {
            const hasEvent = e.linkedEventId ? eventIds.has(e.linkedEventId) : false;
            if (!hasEvent) {
              const id = opsRef.current.addCompletedEventNow({
                date: e.startTime,
                category: e.category,
                location: e.startLocation ?? undefined,
              });
              opsRef.current.updateEvent(id, {
                endTime: hhmm(e.endTime),
                completed: true,
                ...(e.description ? { notes: e.description } : {}),
              });
            }
          } else if (!sess && e.linkedEventId && eventIds.has(e.linkedEventId)) {
            sess = { linkedEventId: e.linkedEventId, pausedAt: e.pausedAt ?? null };
          }
        }
        await writeJsonValue("time-entries", []).catch(() => {});
      }

      if (sess) {
        setSession(sess);
        persistSession(sess);
      }
      setLoaded(true);
    })();
  }, [eventsLoaded, events, persistSession]);

  // ── Cronómetro (elapsed) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeEntry) {
      setElapsed(0);
      return;
    }
    if (activeEntry.pausedAt) {
      // En pausa: congela el tiempo trabajado hasta el instante de la pausa.
      setElapsed(Math.max(0, Math.floor((activeEntry.pausedAt.getTime() - activeEntry.startTime.getTime()) / 1000)));
      return;
    }
    setElapsed(Math.max(0, Math.floor((Date.now() - activeEntry.startTime.getTime()) / 1000)));
    const interval = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - activeEntry.startTime.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeEntry]);

  // ── Acciones del timer ───────────────────────────────────────────────────────
  const clockIn = useCallback(
    (category: WorkCategory = "Predi", customTime?: Date) => {
      const start = customTime ?? new Date();
      const id = opsRef.current.addCompletedEventNow({ date: start, category });
      const s: ActiveSession = { linkedEventId: id, pausedAt: null };
      setSession(s);
      persistSession(s);
      setElapsed(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    },
    [persistSession]
  );

  const clockOut = useCallback(
    (customTime?: Date) => {
      setSession((s) => {
        if (!s) return s;
        // Si se para en pausa, el fin del trabajo fue el momento de pausar (así la
        // duración no incluye el hueco pausado).
        const end = customTime ?? s.pausedAt ?? new Date();
        opsRef.current.updateEvent(s.linkedEventId, { endTime: hhmm(end), completed: true });
        persistSession(null);
        return null;
      });
      setElapsed(0);
    },
    [persistSession]
  );

  const pause = useCallback(() => {
    setSession((s) => {
      if (!s || s.pausedAt) return s;
      const ns = { ...s, pausedAt: new Date() };
      persistSession(ns);
      return ns;
    });
  }, [persistSession]);

  // Reanuda: desplaza el inicio del evento hacia delante el tiempo en pausa, de
  // modo que su duración siga siendo el tiempo realmente trabajado (y el evento
  // —la fuente— quede coherente, no solo la vista del timer).
  const resume = useCallback(() => {
    setSession((s) => {
      if (!s || !s.pausedAt) return s;
      const pausedMs = Date.now() - s.pausedAt.getTime();
      const ev = events.find((e) => e.id === s.linkedEventId);
      if (ev) opsRef.current.updateEvent(s.linkedEventId, { date: new Date(ev.date.getTime() + pausedMs) });
      const ns = { ...s, pausedAt: null };
      persistSession(ns);
      return ns;
    });
  }, [events, persistSession]);

  // El inicio de una actividad nunca puede ser posterior a ahora.
  const updateStartTime = useCallback((id: string, startTime: Date) => {
    const clamped = startTime.getTime() > Date.now() ? new Date() : startTime;
    opsRef.current.updateEvent(id, { date: clamped });
    setElapsed(Math.max(0, Math.floor((Date.now() - clamped.getTime()) / 1000)));
  }, []);

  const updateEntryTimes = useCallback((id: string, startTime: Date, endTime: Date) => {
    opsRef.current.updateEvent(id, { date: startTime, endTime: hhmm(endTime) });
  }, []);

  const updateDescription = useCallback((id: string, description: string) => {
    opsRef.current.updateEvent(id, { notes: description });
  }, []);

  const updateCategory = useCallback((id: string, category: WorkCategory) => {
    opsRef.current.updateEvent(id, { category });
  }, []);

  const addManualEntry = useCallback(
    (
      startTime: Date,
      endTime: Date,
      category: WorkCategory,
      description = "",
      location?: GeoLocation,
      linkedEventId?: string
    ) => {
      // Si ya viene un evento creado por el llamador, no se hace nada: la entrada
      // deriva de ese evento. Si no, se crea el evento completado.
      if (linkedEventId) return;
      const id = opsRef.current.addCompletedEventNow({ date: startTime, category, location });
      opsRef.current.updateEvent(id, {
        endTime: hhmm(endTime),
        completed: true,
        ...(description ? { notes: description } : {}),
      });
    },
    []
  );

  const deleteEntry = useCallback(
    (id: string) => {
      setSession((s) => {
        if (s && s.linkedEventId === id) {
          persistSession(null);
          setElapsed(0);
          opsRef.current.deleteEvent(id);
          return null;
        }
        opsRef.current.deleteEvent(id);
        return s;
      });
    },
    [persistSession]
  );

  const todayEntries = useMemo(
    () =>
      entries.filter((e) => {
        const today = new Date();
        return (
          e.startTime.getDate() === today.getDate() &&
          e.startTime.getMonth() === today.getMonth() &&
          e.startTime.getFullYear() === today.getFullYear()
        );
      }),
    [entries]
  );

  const todayTotal = useMemo(
    () =>
      todayEntries.reduce((acc, e) => {
        const end = e.endTime ? e.endTime.getTime() : e.startTime.getTime() + elapsed * 1000;
        return acc + (end - e.startTime.getTime());
      }, 0),
    [todayEntries, elapsed]
  );

  const monthEntries = useMemo(
    () =>
      entries.filter((e) => {
        const now = new Date();
        return e.startTime.getMonth() === now.getMonth() && e.startTime.getFullYear() === now.getFullYear();
      }),
    [entries]
  );

  const monthTotal = useMemo(
    () =>
      monthEntries.reduce((acc, e) => {
        const end = e.endTime ? e.endTime.getTime() : e.startTime.getTime() + elapsed * 1000;
        return acc + (end - e.startTime.getTime());
      }, 0),
    [monthEntries, elapsed]
  );

  return {
    entries,
    loaded,
    todayEntries,
    monthEntries,
    isRunning,
    isPaused,
    elapsed,
    activeEntry,
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

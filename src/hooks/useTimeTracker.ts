import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { isRecord } from "@/lib/utils";
import { clampActivityEnd, resolveEndDate } from "@/lib/eventTime";
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
  /**
   * Instante en que se fichó entrada. El inicio "oficial" es la fecha del
   * evento, pero se guarda también aquí porque al parar hay que conocerlo SÍ o
   * SÍ: cuando el widget reproduce CLOCK_IN y CLOCK_OUT seguidos, el evento se
   * acaba de crear en el mismo tick y aún no aparece en la lista de eventos de
   * este render, así que buscarlo ahí devolvería nada y se perdería el ajuste
   * de la hora de fin (era la causa de la actividad fantasma de ~24h).
   */
  startedAt: Date | null;
  /** Respaldo de la categoría para el mismo caso (el evento manda si está). */
  category: WorkCategory;
  /**
   * Si este fichaje CREÓ un evento nuevo (true) o se enganchó a uno programado
   * ya existente (false). Al descartar una actividad, el evento nuevo se borra,
   * pero el programado solo se revierte a pendiente para no perder la cita.
   */
  createdNew: boolean;
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
  let startedAt: Date | null = null;
  if (value.startedAt !== null && value.startedAt !== undefined && value.startedAt !== "") {
    const d = new Date(String(value.startedAt));
    if (!Number.isNaN(d.getTime())) startedAt = d;
  }
  const category =
    typeof value.category === "string" && value.category.trim() ? value.category : "Predi";
  // Una sesión restaurada sin este dato se trata como "no creada por nosotros"
  // (false): al descartar se revierte en vez de borrar, lo más conservador.
  const createdNew = value.createdNew === true;
  return { linkedEventId: value.linkedEventId, pausedAt, startedAt, category, createdNew };
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
  // Lista de eventos siempre al día, para consultas síncronas dentro de los
  // callbacks del timer sin capturar una versión vieja por closure.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  const persistSession = useCallback((s: ActiveSession | null) => {
    void writeJsonValue(
      "active-session",
      s
        ? {
            linkedEventId: s.linkedEventId,
            pausedAt: s.pausedAt ? s.pausedAt.toISOString() : null,
            startedAt: s.startedAt ? s.startedAt.toISOString() : null,
            category: s.category,
            createdNew: s.createdNew,
          }
        : null
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

  // El evento manda (refleja ediciones), pero si todavía no está en esta lista
  // —el widget reproduce CLOCK_IN + CLOCK_OUT en el mismo tick y el evento se
  // acaba de crear— se usa lo que guarda la propia sesión. Si dependiera solo
  // del evento, el timer se vería "parado" con una sesión viva y ni siquiera se
  // podría detener.
  const activeEntry = useMemo<TimeEntry | undefined>(() => {
    if (!session) return undefined;
    const startTime = activeEvent?.date ?? session.startedAt;
    if (!startTime) return undefined;
    return {
      id: session.linkedEventId,
      startTime,
      endTime: null,
      description: activeEvent?.notes ?? "",
      category: activeEvent?.category ?? session.category,
      startLocation: activeEvent?.location ?? null,
      endLocation: null,
      linkedEventId: session.linkedEventId,
      pausedAt: session.pausedAt,
    };
  }, [session, activeEvent]);

  const entries = useMemo(
    () => (activeEntry ? [activeEntry, ...completedEntries] : completedEntries),
    [activeEntry, completedEntries]
  );
  // Depende solo de la sesión: así una sesión viva siempre se puede parar,
  // aunque su evento no se localice en este render.
  const isRunning = session !== null;
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
            sess = {
              linkedEventId: e.linkedEventId,
              pausedAt: e.pausedAt ?? null,
              startedAt: e.startTime,
              category: e.category,
            };
          }
        }
        await writeJsonValue("time-entries", []).catch(() => {});
      }

      if (sess) {
        // Una sesión guardada por una versión anterior puede no traer `startedAt`
        // ni categoría: se rellenan desde su evento para que el timer siga siendo
        // autosuficiente tras actualizar la app.
        if (!sess.startedAt) {
          const ev = events.find((e) => e.id === sess!.linkedEventId);
          if (ev) sess = { ...sess, startedAt: ev.date, category: ev.category };
        }
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
      const idsBefore = new Set(eventsRef.current.map((e) => e.id));
      const id = opsRef.current.addCompletedEventNow({ date: start, category });
      // Si el id devuelto ya existía, se enganchó a un evento programado; si no,
      // se creó uno nuevo. Distingue cómo descartar la actividad luego.
      const createdNew = !idsBefore.has(id);
      const s: ActiveSession = { linkedEventId: id, pausedAt: null, startedAt: start, category, createdNew };
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
        const rawEnd = customTime ?? s.pausedAt ?? new Date();
        // El inicio se toma del evento (fuente de verdad, refleja ediciones) y,
        // si aún no está en esta lista —el widget reproduce CLOCK_IN y CLOCK_OUT
        // en el mismo tick y el evento se acaba de crear—, del `startedAt` de la
        // sesión. Sin ese respaldo el ajuste no se aplicaba por la vía del widget
        // y reaparecía la actividad fantasma de ~24h (ver clampActivityEnd).
        const ev = events.find((e) => e.id === s.linkedEventId);
        const start = ev ? ev.date : s.startedAt;
        const end = start ? clampActivityEnd(start, rawEnd) : rawEnd;
        opsRef.current.updateEvent(s.linkedEventId, { endTime: hhmm(end), completed: true });
        persistSession(null);
        return null;
      });
      setElapsed(0);
    },
    [events, persistSession]
  );

  // Descarta la actividad en curso sin guardarla (p.ej. un play+stop accidental
  // de menos de 30 s desde el widget, donde no hay diálogo que preguntar). Si el
  // fichaje creó un evento nuevo, se borra; si se enganchó a uno programado, se
  // revierte a pendiente para no perder la cita.
  const discardActive = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      if (s.createdNew) {
        opsRef.current.deleteEvent(s.linkedEventId);
      } else {
        opsRef.current.updateEvent(s.linkedEventId, { completed: false, endTime: undefined });
      }
      persistSession(null);
      return null;
    });
    setElapsed(0);
  }, [persistSession]);

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
    discardActive,
    pause,
    resume,
    updateStartTime,
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

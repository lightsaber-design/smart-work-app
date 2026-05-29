import { useState, useCallback, useEffect } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { useDebouncedJsonWriter } from "@/hooks/useDebouncedJsonWriter";

export interface SessionFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface EstudioSession {
  id: string;
  date: string;
  time: string;
  lesson?: string;
  notes?: string;
  files: SessionFile[];
  pending?: boolean;
}

export type ScheduleFrequency = "weekly" | "fortnightly" | "monthly";

export interface ContactSchedule {
  frequency: ScheduleFrequency;
  dayOfWeek: number; // 0=Dom … 6=Sáb
  time: string;      // "HH:MM"
  lesson?: string;   // lección por defecto
}

export interface EstudioContact {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  favoritePlaceId?: string;
  schedule?: ContactSchedule;
  sessions: EstudioSession[];
  active: boolean;
  createdAt: string;
}

export type ContactFormData = Pick<EstudioContact, "name" | "address" | "notes" | "favoritePlaceId"> & {
  schedule?: ContactSchedule;
};

export type ScheduledSessionData = {
  date: string;
  time: string;
  lesson?: string;
  notes?: string;
  files: SessionFile[];
  forceNew?: boolean;
};

export function hasActiveStudyWork(contact: EstudioContact): boolean {
  return contact.active && (
    Boolean(contact.schedule) ||
    (contact.sessions ?? []).some((session) => session.pending)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isScheduleFrequency(value: unknown): value is ScheduleFrequency {
  return value === "weekly" || value === "fortnightly" || value === "monthly";
}

function parseStoredSchedule(value: unknown): ContactSchedule | undefined {
  if (!isRecord(value) || !isScheduleFrequency(value.frequency)) return undefined;
  if (typeof value.dayOfWeek !== "number" || value.dayOfWeek < 0 || value.dayOfWeek > 6) return undefined;
  if (typeof value.time !== "string") return undefined;

  return {
    frequency: value.frequency,
    dayOfWeek: value.dayOfWeek,
    time: value.time,
    lesson: typeof value.lesson === "string" ? value.lesson : undefined,
  };
}

function parseStoredFile(value: unknown): SessionFile | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string" || typeof value.name !== "string") return null;
  if (typeof value.type !== "string" || typeof value.size !== "number" || !Number.isFinite(value.size)) return null;
  return { id: value.id, name: value.name, type: value.type, size: value.size };
}

function parseStoredSession(value: unknown): EstudioSession | null {
  if (!isRecord(value)) return null;

  return {
    id: typeof value.id === "string" ? value.id : generateId(),
    date: typeof value.date === "string" ? value.date : new Date().toISOString(),
    time: typeof value.time === "string" ? value.time : now(),
    lesson: typeof value.lesson === "string" ? value.lesson : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
    files: Array.isArray(value.files)
      ? value.files.map(parseStoredFile).filter((file): file is SessionFile => file !== null)
      : [],
    pending: typeof value.pending === "boolean" ? value.pending : undefined,
  };
}

function parseStoredContact(value: unknown): EstudioContact | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;

  return {
    id: value.id,
    name: value.name,
    address: typeof value.address === "string" ? value.address : undefined,
    notes: typeof value.notes === "string" ? value.notes : undefined,
    favoritePlaceId: typeof value.favoritePlaceId === "string" ? value.favoritePlaceId : undefined,
    schedule: parseStoredSchedule(value.schedule),
    sessions: Array.isArray(value.sessions)
      ? value.sessions.map(parseStoredSession).filter((session): session is EstudioSession => session !== null)
      : [],
    active: typeof value.active === "boolean" ? value.active : true,
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
  };
}

function targetPendingCount(freq: ScheduleFrequency): number {
  return freq === "weekly" ? 4 : 2;
}

/* Rellena sesiones pendientes hasta el objetivo segun la frecuencia. Puro, no muta. */
function fillPendingSessions(contact: EstudioContact): EstudioContact {
  if (!contact.schedule) return contact;
  const schedule = contact.schedule;
  const target = targetPendingCount(schedule.frequency);
  const existing = contact.sessions.filter((s) => s.pending);
  const toGenerate = target - existing.length;
  if (toGenerate <= 0) return contact;

  const existingDates = new Set(existing.map((s) => new Date(s.date).toDateString()));
  const occurrences = getNextOccurrences(schedule, target * 2);
  const toAdd = occurrences.filter((d) => !existingDates.has(d.toDateString())).slice(0, toGenerate);
  if (!toAdd.length) return contact;

  const [h, m] = schedule.time.split(":").map(Number);
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const newSessions: EstudioSession[] = toAdd.map((d) => ({
    id: generateId(),
    date: d.toISOString(),
    time,
    lesson: schedule.lesson?.trim() || undefined,
    files: [],
    pending: true,
  }));

  return { ...contact, sessions: [...contact.sessions, ...newSessions] };
}

/* Calcula las proximas N ocurrencias desde hoy segun una programacion. */
export function getNextOccurrences(schedule: ContactSchedule, count: number): Date[] {
  const results: Date[] = [];
  const [h, m] = schedule.time.split(":").map(Number);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayDiff = (schedule.dayOfWeek - start.getDay() + 7) % 7;
  // Si hoy es el dia objetivo pero la hora ya paso, empieza la semana siguiente.
  const candidateToday = new Date(start);
  candidateToday.setHours(h, m, 0, 0);
  const skipToday = dayDiff === 0 && candidateToday <= new Date();
  const cursor = new Date(start);
  cursor.setDate(cursor.getDate() + (skipToday ? 7 : dayDiff));

  while (results.length < count) {
    const d = new Date(cursor);
    d.setHours(h, m, 0, 0);
    results.push(d);
    if (schedule.frequency === "weekly") cursor.setDate(cursor.getDate() + 7);
    else if (schedule.frequency === "fortnightly") cursor.setDate(cursor.getDate() + 14);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return results;
}

function now(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function sessionSlotKey(session: Pick<EstudioSession, "date" | "time">): string {
  return `${dateKey(new Date(session.date))}-${session.time}`;
}

function dedupePendingSessions(sessions: EstudioSession[]): EstudioSession[] {
  const seen = new Set<string>();
  return sessions.filter((session) => {
      if (!session.pending) return true;
      const key = sessionSlotKey(session);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function useEstudios() {
  const [contacts, setContacts] = useState<EstudioContact[]>([]);
  const writeEstudios = useDebouncedJsonWriter("estudios", 500);

  const persist = useCallback((updated: EstudioContact[]) => {
    writeEstudios(updated);
  }, [writeEstudios]);

  useEffect(() => {
    readJsonValue<unknown[]>("estudios", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        const parsed = value
          .map(parseStoredContact)
          .filter((contact): contact is EstudioContact => contact !== null)
          .map((contact) => ({ ...contact, sessions: dedupePendingSessions(contact.sessions) }));
        const filled = parsed.map(fillPendingSessions);
        setContacts(filled);
        if (filled.some((contact, index) => contact !== parsed[index])) {
          void writeJsonValue("estudios", filled).catch((error) => console.error("Error saving studies:", error));
        }
      })
      .catch((error) => console.error("Error loading studies:", error));
  }, [persist]);

  const addContact = useCallback((data: ContactFormData) => {
    setContacts((prev) => {
      const newContact: EstudioContact = {
        id: generateId(),
        name: data.name.trim(),
        address: data.address?.trim() || undefined,
        notes: data.notes?.trim() || undefined,
        favoritePlaceId: data.favoritePlaceId || undefined,
        schedule: data.schedule,
        sessions: [],
        active: true,
        createdAt: new Date().toISOString(),
      };
      const updated = [...prev, fillPendingSessions(newContact)];
      persist(updated);
      return updated;
    });
  }, [persist]);

  const updateContact = useCallback((id: string, data: ContactFormData) => {
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== id) return c;
        const merged = {
          ...c,
          name: data.name.trim(),
          address: data.address?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          favoritePlaceId: data.favoritePlaceId || undefined,
          schedule: data.schedule,
        };
        return fillPendingSessions(merged);
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      persist(updated);
      return updated;
    });
  }, [persist]);

  const archiveContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: false } : c
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  const unarchiveContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: true } : c
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  const addSession = useCallback((
    contactId: string,
    data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[]; forceNew?: boolean }
  ) => {
    setContacts((prev) => {
      const contact = prev.find((c) => c.id === contactId);
      if (!contact) return prev;

      // Busca la proxima sesion pendiente; si forceNew esta activo se crea una nueva.
      const nextPending = data?.forceNew
        ? null
        : contact.sessions
            .filter((s) => s.pending)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

      let newSessions: EstudioSession[];
      if (nextPending) {
        newSessions = contact.sessions.map((s) =>
          s.id === nextPending.id
            ? {
                ...s,
                date: new Date().toISOString(),
                time: data?.time ?? now(),
                lesson: data?.lesson?.trim() || s.lesson,
                notes: data?.notes?.trim() || undefined,
                files: data?.files ?? s.files,
                pending: false,
              }
            : s
        );
      } else {
        newSessions = [
          ...contact.sessions,
          {
            id: generateId(),
            date: new Date().toISOString(),
            time: data?.time ?? now(),
            lesson: data?.lesson?.trim() || undefined,
            notes: data?.notes?.trim() || undefined,
            files: data?.files ?? [],
          },
        ];
      }

      const updated = prev.map((c) =>
        c.id === contactId ? { ...c, sessions: newSessions } : c
      );
      persist(updated);
      return updated;
    });
  }, [persist]);



  const deleteSession = useCallback((contactId: string, sessionId: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? { ...c, sessions: c.sessions.filter((s) => s.id !== sessionId) }
          : c
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  const updateSession = useCallback((
    contactId: string,
    sessionId: string,
    data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }
  ) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? (() => {
              let targetDate: Date | null = null;
              const sessions = dedupePendingSessions(c.sessions
                .map((s) => {
                  if (s.id !== sessionId) return s;
                  const [year, month, day] = data.date.split("-").map(Number);
                  const [hours, minutes] = data.time.split(":").map(Number);
                  const d = new Date(year, month - 1, day, hours, minutes);
                  targetDate = d;
                  return {
                    ...s,
                    date: d.toISOString(),
                    time: data.time,
                    lesson: data.lesson?.trim() || undefined,
                    notes: data.notes?.trim() || undefined,
                    files: data.files,
                  };
                })
                .filter((s) => {
                  if (!targetDate || s.id === sessionId || !s.pending) return true;
                  return sessionSlotKey(s) !== `${dateKey(targetDate)}-${data.time}`;
                }));
              return { ...c, sessions };
            })()
          : c
      );
      persist(updated);
      return updated;
    });
  }, [persist]);

  const addScheduledSession = useCallback((contactId: string, data: ScheduledSessionData) => {
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== contactId) return c;
        const [year, month, day] = data.date.split("-").map(Number);
        const [hours, minutes] = data.time.split(":").map(Number);
        const d = new Date(year, month - 1, day, hours, minutes);
        const replacement = {
          date: d.toISOString(),
          time: data.time,
          lesson: data.lesson?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          files: data.files,
          pending: true,
        };
        const nextPending = data.forceNew
          ? null
          : c.sessions
              .filter((session) => session.pending)
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

        if (nextPending) {
          const sessions = dedupePendingSessions(c.sessions.map((session) =>
            session.id === nextPending.id ? { ...session, ...replacement } : session
          ));
          return {
            ...c,
            sessions,
          };
        }

        return {
          ...c,
          sessions: dedupePendingSessions([
            ...c.sessions,
            {
              id: generateId(),
              ...replacement,
            },
          ]),
        };
      });
      persist(updated);
      return updated;
    });
  }, [persist]);

  const completeSession = useCallback((contactId: string, sessionId: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) => {
        if (c.id !== contactId) return c;
        const withCompleted = {
          ...c,
          sessions: c.sessions.map((s) =>
            s.id === sessionId ? { ...s, pending: false } : s
          ),
        };
        return fillPendingSessions(withCompleted);
      });
      persist(updated);
      return updated;
    });
  }, [persist]);


  return {
    contacts,
    addContact,
    updateContact,
    deleteContact,
    archiveContact,
    unarchiveContact,
    addSession,
    addScheduledSession,
    deleteSession,
    updateSession,
    completeSession,
  };
}

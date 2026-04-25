import { useState, useCallback } from "react";

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

/* Computes next N occurrences from today based on a schedule */
export function getNextOccurrences(schedule: ContactSchedule, count: number): Date[] {
  const results: Date[] = [];
  const [h, m] = schedule.time.split(":").map(Number);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const dayDiff = (schedule.dayOfWeek - start.getDay() + 7) % 7;
  // If today is the target day but it's already past the session time, start next week
  const candidateToday = new Date(start);
  candidateToday.setHours(h, m, 0, 0);
  const skipToday = dayDiff === 0 && candidateToday <= new Date();
  let cursor = new Date(start);
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

function load(): EstudioContact[] {
  try {
    const saved = localStorage.getItem("estudios");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function persist(contacts: EstudioContact[]) {
  localStorage.setItem("estudios", JSON.stringify(contacts));
}

export function useEstudios() {
  const [contacts, setContacts] = useState<EstudioContact[]>(load);

  const addContact = useCallback((data: ContactFormData) => {
    setContacts((prev) => {
      const updated = [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: data.name.trim(),
          address: data.address?.trim() || undefined,
          notes: data.notes?.trim() || undefined,
          favoritePlaceId: data.favoritePlaceId || undefined,
          schedule: data.schedule,
          sessions: [],
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
      persist(updated);
      return updated;
    });
  }, []);

  const updateContact = useCallback((id: string, data: ContactFormData) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: data.name.trim(),
              address: data.address?.trim() || undefined,
              notes: data.notes?.trim() || undefined,
              favoritePlaceId: data.favoritePlaceId || undefined,
              schedule: data.schedule,
            }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const deleteContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.filter((c) => c.id !== id);
      persist(updated);
      return updated;
    });
  }, []);

  const archiveContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: false } : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const unarchiveContact = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: true } : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const addSession = useCallback((
    contactId: string,
    data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[]; forceNew?: boolean }
  ) => {
    setContacts((prev) => {
      const contact = prev.find((c) => c.id === contactId);
      if (!contact) return prev;

      // Find next pending session — skip if forceNew is set
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
            id: crypto.randomUUID(),
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
  }, []);

  const scheduleSession = useCallback((
    contactId: string,
    data: { date: string; time: string; lesson?: string; files?: SessionFile[] }
  ) => {
    const [year, month, day] = data.date.split("-").map(Number);
    const [hours, minutes] = data.time.split(":").map(Number);
    const d = new Date(year, month - 1, day, hours, minutes);
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              sessions: [
                ...c.sessions,
                {
                  id: crypto.randomUUID(),
                  date: d.toISOString(),
                  time: data.time,
                  lesson: data.lesson?.trim() || undefined,
                  files: data.files ?? [],
                  pending: true,
                },
              ],
            }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const generateScheduledSessions = useCallback((contactId: string) => {
    const MAX_PENDING = 4;
    setContacts((prev) => {
      const contact = prev.find((c) => c.id === contactId);
      if (!contact?.schedule) return prev;

      const existingPending = contact.sessions.filter((s) => s.pending);
      const toGenerate = MAX_PENDING - existingPending.length;
      if (toGenerate <= 0) return prev;

      const existing = new Set(existingPending.map((s) => new Date(s.date).toDateString()));

      const occurrences = getNextOccurrences(contact.schedule, MAX_PENDING * 2);
      const toAdd = occurrences
        .filter((d) => !existing.has(d.toDateString()))
        .slice(0, toGenerate);

      if (!toAdd.length) return prev;

      const newSessions: EstudioSession[] = toAdd.map((d) => {
        const [h, m] = contact.schedule!.time.split(":").map(Number);
        const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        return {
          id: crypto.randomUUID(),
          date: d.toISOString(),
          time,
          lesson: contact.schedule!.lesson?.trim() || undefined,
          files: [],
          pending: true,
        };
      });

      const updated = prev.map((c) =>
        c.id === contactId
          ? { ...c, sessions: [...c.sessions, ...newSessions] }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

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
  }, []);

  const updateSession = useCallback((
    contactId: string,
    sessionId: string,
    data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }
  ) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              sessions: c.sessions.map((s) => {
                if (s.id !== sessionId) return s;
                const [year, month, day] = data.date.split("-").map(Number);
                const [hours, minutes] = data.time.split(":").map(Number);
                const d = new Date(year, month - 1, day, hours, minutes);
                return {
                  ...s,
                  date: d.toISOString(),
                  time: data.time,
                  lesson: data.lesson?.trim() || undefined,
                  notes: data.notes?.trim() || undefined,
                  files: data.files,
                };
              }),
            }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const completeSession = useCallback((contactId: string, sessionId: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              sessions: c.sessions.map((s) =>
                s.id === sessionId ? { ...s, pending: false } : s
              ),
            }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  // kept for ClockButton compatibility
  const toggleActive = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: !c.active } : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  return {
    contacts,
    addContact,
    updateContact,
    deleteContact,
    archiveContact,
    unarchiveContact,
    addSession,
    scheduleSession,
    generateScheduledSessions,
    deleteSession,
    updateSession,
    completeSession,
    toggleActive,
  };
}

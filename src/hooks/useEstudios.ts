import { useState, useCallback } from "react";

export interface EstudioSession {
  id: string;
  date: string;
  notes?: string;
}

export interface EstudioContact {
  id: string;
  name: string;
  address?: string;
  notes?: string;
  favoritePlaceId?: string;
  sessions: EstudioSession[];
  active: boolean;
  createdAt: string;
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

  const addContact = useCallback((name: string, address?: string, notes?: string, favoritePlaceId?: string) => {
    setContacts((prev) => {
      const updated = [
        ...prev,
        {
          id: crypto.randomUUID(),
          name: name.trim(),
          address: address?.trim() || undefined,
          notes: notes?.trim() || undefined,
          favoritePlaceId: favoritePlaceId || undefined,
          sessions: [],
          active: true,
          createdAt: new Date().toISOString(),
        },
      ];
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

  const addSession = useCallback((contactId: string, notes?: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === contactId
          ? {
              ...c,
              sessions: [
                ...c.sessions,
                { id: crypto.randomUUID(), date: new Date().toISOString(), notes },
              ],
            }
          : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  const toggleActive = useCallback((id: string) => {
    setContacts((prev) => {
      const updated = prev.map((c) =>
        c.id === id ? { ...c, active: !c.active } : c
      );
      persist(updated);
      return updated;
    });
  }, []);

  return { contacts, addContact, deleteContact, addSession, toggleActive };
}

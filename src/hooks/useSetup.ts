import { useState, useCallback } from "react";
import { Lang, detectLanguage } from "@/lib/i18n";

export interface SetupData {
  name?: string;
  city: { name: string; lat: number; lng: number } | null;
  isPrecursor: boolean;
  hasBibleStudies: boolean;
  completed: boolean;
  language?: Lang;
}

const DEFAULT: SetupData = {
  city: null,
  isPrecursor: false,
  hasBibleStudies: false,
  completed: false,
  language: detectLanguage(),
};

function load(): SetupData {
  try {
    const saved = localStorage.getItem("setup");
    return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useSetup() {
  const [setup, setSetup] = useState<SetupData>(load);

  const saveSetup = useCallback((data: Partial<SetupData>) => {
    setSetup((prev) => {
      const updated = { ...prev, ...data };
      localStorage.setItem("setup", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const completeSetup = useCallback((data: Omit<SetupData, "completed">) => {
    const updated = { ...data, completed: true };
    localStorage.setItem("setup", JSON.stringify(updated));
    setSetup(updated);
  }, []);

  return { setup, saveSetup, completeSetup };
}

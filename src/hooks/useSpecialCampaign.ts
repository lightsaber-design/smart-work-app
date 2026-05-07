import { useState, useCallback } from "react";

export type CampaignGoal = 15 | 30;

function load(): Record<string, CampaignGoal> {
  try {
    const raw = localStorage.getItem("specialCampaign");
    return raw ? (JSON.parse(raw) as Record<string, CampaignGoal>) : {};
  } catch {
    return {};
  }
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function useSpecialCampaign() {
  const [goals, setGoals] = useState<Record<string, CampaignGoal>>(load);

  const setGoal = useCallback((key: string, goal: CampaignGoal | null) => {
    setGoals((prev) => {
      const next = { ...prev };
      if (goal === null) delete next[key];
      else next[key] = goal;
      try { localStorage.setItem("specialCampaign", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return { goals, setGoal };
}

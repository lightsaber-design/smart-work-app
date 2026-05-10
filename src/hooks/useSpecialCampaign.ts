import { useState, useCallback, useEffect } from "react";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export type CampaignGoal = 15 | 30;

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function useSpecialCampaign() {
  const [goals, setGoals] = useState<Record<string, CampaignGoal>>({});

  useEffect(() => {
    readJsonValue<Record<string, CampaignGoal>>("specialCampaign", {})
      .then(setGoals)
      .catch((error) => console.error("Error loading special campaign:", error));
  }, []);

  const setGoal = useCallback((key: string, goal: CampaignGoal | null) => {
    setGoals((prev) => {
      const next = { ...prev };
      if (goal === null) delete next[key];
      else next[key] = goal;
      void writeJsonValue("specialCampaign", next).catch((error) => console.error("Error saving special campaign:", error));
      return next;
    });
  }, []);

  return { goals, setGoal };
}

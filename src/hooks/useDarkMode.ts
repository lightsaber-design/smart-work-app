import { useState, useEffect } from "react";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

export function useDarkMode() {
  const [loaded, setLoaded] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    readJsonValue<boolean | null>("darkMode", null)
      .then((stored) => {
        if (typeof stored === "boolean") setIsDark(stored);
      })
      .catch((error) => console.error("Error loading dark mode:", error))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    if (!loaded) return;
    void writeJsonValue("darkMode", isDark).catch((error) => console.error("Error saving dark mode:", error));
  }, [isDark, loaded]);

  const toggle = () => setIsDark((v) => !v);

  return { isDark, toggle };
}

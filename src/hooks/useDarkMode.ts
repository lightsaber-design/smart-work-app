import { useState, useEffect } from "react";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";
import { isNightTime } from "@/lib/solar";

interface DarkModeOptions {
  autoDark?: boolean;
  city?: { lat: number; lng: number } | null;
}

export function useDarkMode(options: DarkModeOptions = {}) {
  const { autoDark = false, city = null } = options;
  const [loaded, setLoaded] = useState(false);
  const [manualDark, setManualDark] = useState<boolean>(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  // Load persisted manual preference
  useEffect(() => {
    readJsonValue<boolean | null>("darkMode", null)
      .then((stored) => {
        if (typeof stored === "boolean") setManualDark(stored);
      })
      .catch((error) => console.error("Error loading dark mode:", error))
      .finally(() => setLoaded(true));
  }, []);

  // Solar auto-check (every 60 seconds when enabled)
  const [solarDark, setSolarDark] = useState<boolean | null>(null);
  useEffect(() => {
    if (!autoDark || !city) {
      setSolarDark(null);
      return;
    }
    const check = () => setSolarDark(isNightTime(city.lat, city.lng));
    check();
    const iv = setInterval(check, 60_000);
    return () => clearInterval(iv);
  }, [autoDark, city?.lat, city?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDark = autoDark && solarDark !== null ? solarDark : manualDark;

  // Apply CSS class + persist manual preference
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    if (!loaded || autoDark) return; // don't persist in auto mode
    void writeJsonValue("darkMode", isDark).catch((error) =>
      console.error("Error saving dark mode:", error),
    );
  }, [isDark, loaded, autoDark]);

  const toggle = () => setManualDark((v) => !v);

  return { isDark, toggle };
}

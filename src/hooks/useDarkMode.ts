import { useState, useEffect } from "react";

export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("darkMode");
      if (stored !== null) return stored === "true";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
    try { localStorage.setItem("darkMode", String(isDark)); } catch { /* ignorar */ }
  }, [isDark]);

  const toggle = () => setIsDark((v) => !v);

  return { isDark, toggle };
}

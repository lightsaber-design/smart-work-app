import { useCallback, useEffect, useRef } from "react";
import { writeJsonValue, type StorageKey } from "@/lib/jsonFileStorage";

export function useDebouncedJsonWriter(key: StorageKey, delayMs = 250) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValueRef = useRef<unknown>(undefined);
  const hasPendingValueRef = useRef(false);

  const flush = useCallback(() => {
    if (!hasPendingValueRef.current) return;
    const value = latestValueRef.current;
    hasPendingValueRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    void writeJsonValue(key, value).catch((error) => console.error(`Error saving ${key}:`, error));
  }, [key]);

  useEffect(() => {
    const flushOnPageHide = () => flush();
    const flushOnHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flushOnPageHide);
    document.addEventListener("visibilitychange", flushOnHidden);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      document.removeEventListener("visibilitychange", flushOnHidden);
      flush();
    };
  }, [flush]);

  return useCallback((value: unknown) => {
    latestValueRef.current = value;
    hasPendingValueRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(flush, delayMs);
  }, [delayMs, flush]);
}

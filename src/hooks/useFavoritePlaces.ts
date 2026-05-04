import { useState, useCallback, useEffect } from "react";
import { generateId } from "@/lib/uuid";

export interface FavoritePlace {
  id: string;
  name: string;
  location: { lat: number; lng: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseStoredPlace(value: unknown): FavoritePlace | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  const location = value.location;
  if (!isRecord(location) || typeof location.lat !== "number" || typeof location.lng !== "number") return null;
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return null;

  return {
    id: value.id,
    name: value.name,
    location: { lat: location.lat, lng: location.lng },
  };
}

export function useFavoritePlaces() {
  const [places, setPlaces] = useState<FavoritePlace[]>(() => {
    try {
      const saved = localStorage.getItem("favorite-places");
      if (!saved) return [];
      const parsed = JSON.parse(saved) as unknown;
      if (!Array.isArray(parsed)) throw new Error("bad format");
      return parsed.map(parseStoredPlace).filter((place): place is FavoritePlace => place !== null);
    } catch {
      localStorage.removeItem("favorite-places");
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("favorite-places", JSON.stringify(places));
    } catch (e) {
      console.error("Error guardando lugares:", e);
    }
  }, [places]);

  const addPlace = useCallback((name: string, location: { lat: number; lng: number }) => {
    const trimmedName = name.trim();
    if (!trimmedName || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return;
    setPlaces((prev) => [...prev, { id: generateId(), name: trimmedName, location }]);
  }, []);

  const deletePlace = useCallback((id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { places, addPlace, deletePlace };
}

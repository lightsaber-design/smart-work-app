import { useState, useCallback, useEffect } from "react";
import { generateId } from "@/lib/uuid";
import { readJsonValue, writeJsonValue } from "@/lib/jsonFileStorage";

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
  const [places, setPlaces] = useState<FavoritePlace[]>([]);

  useEffect(() => {
    readJsonValue<unknown[]>("favorite-places", [])
      .then((value) => {
        if (!Array.isArray(value)) throw new Error("bad format");
        setPlaces(value.map(parseStoredPlace).filter((place): place is FavoritePlace => place !== null));
      })
      .catch((error) => console.error("Error loading favorite places:", error));
  }, []);

  const addPlace = useCallback((name: string, location: { lat: number; lng: number }) => {
    const trimmedName = name.trim();
    if (!trimmedName || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) return;
    setPlaces((prev) => {
      const updated = [...prev, { id: generateId(), name: trimmedName, location }];
      void writeJsonValue("favorite-places", updated).catch((error) => console.error("Error saving favorite places:", error));
      return updated;
    });
  }, []);

  const deletePlace = useCallback((id: string) => {
    setPlaces((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      void writeJsonValue("favorite-places", updated).catch((error) => console.error("Error saving favorite places:", error));
      return updated;
    });
  }, []);

  return { places, addPlace, deletePlace };
}

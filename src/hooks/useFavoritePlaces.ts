import { useState, useCallback, useEffect } from "react";

export interface FavoritePlace {
  id: string;
  name: string;
  location: { lat: number; lng: number };
}

export function useFavoritePlaces() {
  const [places, setPlaces] = useState<FavoritePlace[]>(() => {
    const saved = localStorage.getItem("favorite-places");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("favorite-places", JSON.stringify(places));
  }, [places]);

  const addPlace = useCallback((name: string, location: { lat: number; lng: number }) => {
    setPlaces((prev) => [...prev, { id: crypto.randomUUID(), name, location }]);
  }, []);

  const deletePlace = useCallback((id: string) => {
    setPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { places, addPlace, deletePlace };
}

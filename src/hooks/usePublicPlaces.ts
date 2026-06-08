import { useState, useEffect, useRef } from "react";

export type PlaceType = "library" | "toilet" | "cafe" | "mall" | "community_centre" | "fast_food" | "other";
export type PlaceAmenity = "bathroom" | "quiet" | "free" | "climate";

export interface PublicPlace {
  id: string;
  name: string;
  type: PlaceType;
  lat: number;
  lng: number;
  distance: number;
  amenities: PlaceAmenity[];
}

// Amenities inferred from OSM type
const AMENITIES_BY_TYPE: Record<PlaceType, PlaceAmenity[]> = {
  library:          ["bathroom", "quiet", "free", "climate"],
  toilet:           ["bathroom", "free"],
  cafe:             ["bathroom", "quiet"],
  mall:             ["bathroom", "climate"],
  community_centre: ["bathroom", "quiet", "free", "climate"],
  fast_food:        ["bathroom"],
  other:            [],
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tagToType(tags: Record<string, string>): PlaceType {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const building = tags.building;
  if (amenity === "library") return "library";
  if (amenity === "toilets") return "toilet";
  if (amenity === "cafe") return "cafe";
  if (amenity === "community_centre") return "community_centre";
  if (amenity === "fast_food" || amenity === "restaurant") return "fast_food";
  if (shop === "mall" || building === "mall" || shop === "supermarket") return "mall";
  return "other";
}

function parseName(tags: Record<string, string>, type: PlaceType): string | null {
  if (tags.name) return tags.name;
  if (type === "toilet") return null; // unnamed toilets are ok, we'll give them a generic label
  return null; // skip unnamed non-toilet places
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

// ── Caché en memoria (10 min) ─────────────────────────────────────────────────
const memCache = new Map<string, { ts: number; data: PublicPlace[] }>();
const MEM_TTL_MS = 10 * 60 * 1000; // 10 min

// ── Caché en localStorage (24 h) — sobrevive cierres de app y sin conexión ───
const LS_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

function lsKey(cacheKey: string): string {
  return `_places_${cacheKey}`;
}

function readLsCache(cacheKey: string): PublicPlace[] | null {
  try {
    const raw = localStorage.getItem(lsKey(cacheKey));
    if (!raw) return null;
    const parsed: { ts: number; data: PublicPlace[] } = JSON.parse(raw);
    if (Date.now() - parsed.ts > LS_TTL_MS) {
      localStorage.removeItem(lsKey(cacheKey));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function writeLsCache(cacheKey: string, data: PublicPlace[]): void {
  try {
    localStorage.setItem(lsKey(cacheKey), JSON.stringify({ ts: Date.now(), data }));
  } catch { /* cuota llena — ignorar */ }
}

export function usePublicPlaces(center: { lat: number; lng: number } | undefined) {
  const [places, setPlaces] = useState<PublicPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!center) return;

    const cacheKey = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;

    // 1. Memoria (caliente, misma sesión)
    const mem = memCache.get(cacheKey);
    if (mem && Date.now() - mem.ts < MEM_TTL_MS) {
      setPlaces(mem.data);
      return;
    }

    // 2. localStorage (sobrevive cierres — modo offline)
    const ls = readLsCache(cacheKey);
    if (ls) {
      setPlaces(ls);
      memCache.set(cacheKey, { ts: Date.now(), data: ls });
      return;
    }

    // 3. Red — Overpass API
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);

    const radius = 1500; // 1.5 km
    const query = `[out:json][timeout:20];
(
  node["amenity"~"library|toilets|cafe|community_centre|fast_food|restaurant"](around:${radius},${center.lat},${center.lng});
  node["shop"="mall"](around:${radius},${center.lat},${center.lng});
  way["amenity"~"library|toilets|community_centre"](around:${radius},${center.lat},${center.lng});
  way["shop"="mall"](around:${radius},${center.lat},${center.lng});
  relation["shop"="mall"](around:${radius},${center.lat},${center.lng});
);
out center tags;`;

    fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query,
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((json: { elements: OverpassElement[] }) => {
        const result: PublicPlace[] = [];
        const seen = new Set<string>();

        for (const el of json.elements ?? []) {
          const tags = el.tags ?? {};
          const type = tagToType(tags);
          if (type === "other") continue;

          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (lat == null || lon == null) continue;

          const rawName = parseName(tags, type);
          if (!rawName && type !== "toilet") continue;

          const name = rawName ?? "";
          const key = `${type}:${lat.toFixed(5)},${lon.toFixed(5)}`;
          if (seen.has(key)) continue;
          seen.add(key);

          result.push({
            id: String(el.id),
            name,
            type,
            lat,
            lng: lon,
            distance: Math.round(haversineM(center.lat, center.lng, lat, lon)),
            amenities: AMENITIES_BY_TYPE[type],
          });
        }

        result.sort((a, b) => a.distance - b.distance);
        memCache.set(cacheKey, { ts: Date.now(), data: result });
        writeLsCache(cacheKey, result);
        setPlaces(result);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === "AbortError") return;
        // Sin red: intentar servir el caché aunque haya expirado
        const stale = readStaleCache(cacheKey);
        if (stale) {
          setPlaces(stale);
        } else {
          setError("error");
        }
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });

    return () => ctrl.abort();
  }, [center?.lat, center?.lng]);

  return { places, loading, error };
}

/** Versión sin restricción de TTL — usada como fallback offline. */
function readStaleCache(cacheKey: string): PublicPlace[] | null {
  try {
    const raw = localStorage.getItem(lsKey(cacheKey));
    if (!raw) return null;
    const parsed: { ts: number; data: PublicPlace[] } = JSON.parse(raw);
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

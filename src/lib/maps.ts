export interface GeoPoint {
  lat: number;
  lng: number;
}

export function isValidGeoPoint(value: GeoPoint | undefined | null): value is GeoPoint {
  return Boolean(
    value &&
      Number.isFinite(value.lat) &&
      Number.isFinite(value.lng) &&
      Math.abs(value.lat) <= 90 &&
      Math.abs(value.lng) <= 180
  );
}

export function buildGoogleMapsUrl(target: GeoPoint | string): string {
  const query =
    typeof target === "string"
      ? target.trim()
      : isValidGeoPoint(target)
        ? `${target.lat},${target.lng}`
        : "";

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function openGoogleMaps(target: GeoPoint | string): void {
  window.open(buildGoogleMapsUrl(target), "_blank", "noopener,noreferrer");
}

/** Distancia entre dos puntos (fórmula de Haversine), en metros. */
export function haversineDistanceM(a: GeoPoint, b: GeoPoint): number {
  const earthRadiusM = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

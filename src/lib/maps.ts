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

import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl, haversineDistanceM, isValidGeoPoint } from "@/lib/maps";

describe("maps helpers", () => {
  it("builds a Google Maps URL from coordinates", () => {
    expect(buildGoogleMapsUrl({ lat: 28.1234, lng: -16.4321 })).toBe(
      "https://www.google.com/maps/search/?api=1&query=28.1234%2C-16.4321"
    );
  });

  it("builds a Google Maps URL from an address", () => {
    expect(buildGoogleMapsUrl("Calle Mayor 12, Madrid")).toBe(
      "https://www.google.com/maps/search/?api=1&query=Calle%20Mayor%2012%2C%20Madrid"
    );
  });

  it("validates coordinate bounds", () => {
    expect(isValidGeoPoint({ lat: 28, lng: -16 })).toBe(true);
    expect(isValidGeoPoint({ lat: 91, lng: -16 })).toBe(false);
    expect(isValidGeoPoint({ lat: 28, lng: -181 })).toBe(false);
  });

  it("returns 0 for the same point", () => {
    expect(haversineDistanceM({ lat: 40.4168, lng: -3.7038 }, { lat: 40.4168, lng: -3.7038 })).toBe(0);
  });

  it("computes the great-circle distance between two known cities (~ Madrid-Barcelona)", () => {
    const madrid = { lat: 40.4168, lng: -3.7038 };
    const barcelona = { lat: 41.3874, lng: 2.1686 };
    const distanceKm = haversineDistanceM(madrid, barcelona) / 1000;
    // Distancia real ~505 km; con margen para la aproximación esférica.
    expect(distanceKm).toBeGreaterThan(490);
    expect(distanceKm).toBeLessThan(520);
  });
});

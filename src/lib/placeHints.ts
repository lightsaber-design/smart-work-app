import type { PublicPlace } from "@/hooks/usePublicPlaces";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface PlaceHint {
  icon: string;
  text: string;
}

/**
 * Genera pistas legibles y útiles sobre un lugar a partir de su tipo y las
 * etiquetas de OSM. Pensado para que el usuario sepa de un vistazo qué esperar
 * (ej.: "baño para clientes · quizás debas consumir" vs "baño público gratuito").
 * Localizado: recibe `t`.
 */
export function getPlaceHints(place: PublicPlace, t: TranslateFn): PlaceHint[] {
  const hints: PlaceHint[] = [];

  // ── Baño: el matiz importante (gratis vs consumir vs de pago) ──
  if (place.amenities.includes("bathroom")) {
    if (place.type === "toilet") {
      hints.push({ icon: "🚽", text: place.fee ? t("places_hint_toilet_paid") : t("places_hint_toilet_free") });
    } else if (place.type === "cafe" || place.type === "fast_food") {
      hints.push({ icon: "🚽", text: t("places_hint_consume") });
    } else {
      // library, mall, community_centre → baño interno de acceso libre
      hints.push({ icon: "🚽", text: t("places_hint_bathroom_inside") });
    }
  }

  if (place.amenities.includes("quiet")) hints.push({ icon: "🤫", text: t("places_hint_quiet") });
  if (place.amenities.includes("climate")) hints.push({ icon: "🌡️", text: t("places_hint_climate") });
  if (place.customersOnly && place.type !== "cafe" && place.type !== "fast_food") {
    hints.push({ icon: "🛎️", text: t("places_hint_customers_only") });
  }
  if (place.wheelchair) hints.push({ icon: "♿", text: t("places_hint_accessible") });
  if (place.openingHours) hints.push({ icon: "🕒", text: place.openingHours });

  return hints;
}

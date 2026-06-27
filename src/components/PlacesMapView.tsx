import { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { PublicPlace, PlaceType } from "@/hooks/usePublicPlaces";
import { openGoogleMaps } from "@/lib/maps";
import { useT } from "@/lib/LanguageContext";
import { getPlaceHints } from "@/lib/placeHints";

// Fix Leaflet default icon paths (Vite bundling)
interface LeafletDefaultIconPrototype extends L.Icon.Default {
  _getIconUrl?: () => string;
}
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TYPE_EMOJI: Record<PlaceType, string> = {
  library:          "📚",
  toilet:           "🚽",
  cafe:             "☕",
  mall:             "🏬",
  community_centre: "🏛️",
  fast_food:        "🍔",
  other:            "📍",
};

// Marcador de resultado: un único color de acento (no arcoíris) para que sobre el
// mapa neutro SOLO resalten los resultados de la búsqueda. Forma de gota (pin).
function makePlaceIcon(type: PlaceType) {
  const emoji = TYPE_EMOJI[type];
  return L.divIcon({
    className: "",
    html: `<div style="
        width:32px;height:32px;
        background:hsl(var(--primary));
        border:2.5px solid #fff;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 3px 8px rgba(0,0,0,0.28);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);font-size:15px;line-height:1">${emoji}</span>
      </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 30],
    popupAnchor: [0, -28],
  });
}

// Centro de búsqueda: punto neutro y discreto, no compite con los resultados.
const centerIcon = L.divIcon({
  className: "",
  html: `<div style="width:14px;height:14px;background:#64748b;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 4px rgba(100,116,139,0.18)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
  popupAnchor: [0, -10],
});

function distLabel(m: number) {
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}

interface PlacesMapViewProps {
  center: { lat: number; lng: number };
  places: PublicPlace[];
  toiletLabel: string;
  openLabel: string;
  centerLabel: string;
  favLabel?: string;
  favSavedLabel?: string;
  onAddFavorite?: (name: string, location: { lat: number; lng: number }) => void;
  heightStyle?: string;
}

function PopupFavButton({
  name,
  lat,
  lng,
  favLabel,
  favSavedLabel,
  onAddFavorite,
}: {
  name: string;
  lat: number;
  lng: number;
  favLabel: string;
  favSavedLabel: string;
  onAddFavorite: (name: string, location: { lat: number; lng: number }) => void;
}) {
  const [saved, setSaved] = useState(false);
  return (
    <button
      onClick={() => {
        if (saved) return;
        onAddFavorite(name, { lat, lng });
        setSaved(true);
      }}
      style={{
        color: saved ? "#16a34a" : "#d97706",
        fontWeight: 600,
        background: "none",
        border: "none",
        cursor: saved ? "default" : "pointer",
        padding: 0,
        fontSize: 12,
        display: "block",
        marginBottom: 4,
      }}
    >
      {saved ? `✓ ${favSavedLabel}` : `★ ${favLabel}`}
    </button>
  );
}

export function PlacesMapView({ center, places, toiletLabel, openLabel, centerLabel, favLabel, favSavedLabel, onAddFavorite, heightStyle = "370px" }: PlacesMapViewProps) {
  const t = useT();
  return (
    <div className="isolate rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: heightStyle, minHeight: 360 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        {/* Base neutra y clara (CARTO Positron) para que resalten los resultados */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />

        {/* Search-center pin */}
        <Marker position={[center.lat, center.lng]} icon={centerIcon}>
          <Popup>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{centerLabel}</span>
          </Popup>
        </Marker>

        {/* Place markers */}
        {places.map((place) => {
          const hints = getPlaceHints(place, t);
          return (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={makePlaceIcon(place.type)}
            >
              <Popup>
                <div style={{ minWidth: 170, maxWidth: 220, fontSize: 12 }}>
                  <p style={{ fontWeight: 700, marginBottom: 1 }}>{place.name || toiletLabel}</p>
                  <p style={{ color: "#6b7280", marginBottom: hints.length ? 6 : 8 }}>{distLabel(place.distance)}</p>
                  {hints.length > 0 && (
                    <ul style={{ listStyle: "none", margin: "0 0 8px", padding: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                      {hints.map((h, i) => (
                        <li key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", color: "#334155", lineHeight: 1.3 }}>
                          <span style={{ flexShrink: 0 }}>{h.icon}</span>
                          <span>{h.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {onAddFavorite && (
                    <PopupFavButton
                      name={place.name || toiletLabel}
                      lat={place.lat}
                      lng={place.lng}
                      favLabel={favLabel ?? "★"}
                      favSavedLabel={favSavedLabel ?? "✓"}
                      onAddFavorite={onAddFavorite}
                    />
                  )}
                  <button
                    onClick={() => openGoogleMaps({ lat: place.lat, lng: place.lng })}
                    style={{ color: "hsl(var(--primary))", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}
                  >
                    {openLabel} ↗
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

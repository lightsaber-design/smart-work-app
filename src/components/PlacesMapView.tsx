import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { PublicPlace, PlaceType } from "@/hooks/usePublicPlaces";
import { openGoogleMaps } from "@/lib/maps";

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

const TYPE_COLOR: Record<PlaceType, string> = {
  library:          "#22c55e",
  toilet:           "#3b82f6",
  cafe:             "#f97316",
  mall:             "#a855f7",
  community_centre: "#14b8a6",
  fast_food:        "#ef4444",
  other:            "#6b7280",
};

const TYPE_EMOJI: Record<PlaceType, string> = {
  library:          "📚",
  toilet:           "🚽",
  cafe:             "☕",
  mall:             "🏬",
  community_centre: "🏛️",
  fast_food:        "🍔",
  other:            "📍",
};

function makePlaceIcon(type: PlaceType) {
  const color = TYPE_COLOR[type];
  const emoji = TYPE_EMOJI[type];
  return L.divIcon({
    className: "",
    html: `<div style="width:34px;height:34px;background:${color};border-radius:50%;border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;line-height:1">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

const centerIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;background:#3b82f6;border-radius:50%;border:3px solid white;box-shadow:0 0 0 5px rgba(59,130,246,0.25)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -14],
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
}

export function PlacesMapView({ center, places, toiletLabel, openLabel, centerLabel }: PlacesMapViewProps) {
  return (
    <div className="rounded-2xl overflow-hidden border border-border shadow-sm" style={{ height: 370 }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={15}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Search-center pin */}
        <Marker position={[center.lat, center.lng]} icon={centerIcon}>
          <Popup>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{centerLabel}</span>
          </Popup>
        </Marker>

        {/* Place markers */}
        {places.map((place) => (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={makePlaceIcon(place.type)}
          >
            <Popup>
              <div style={{ minWidth: 140, fontSize: 12 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>{place.name || toiletLabel}</p>
                <p style={{ color: "#6b7280", marginBottom: 6 }}>{distLabel(place.distance)}</p>
                <button
                  onClick={() => openGoogleMaps({ lat: place.lat, lng: place.lng })}
                  style={{ color: "#3b82f6", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0, fontSize: 12 }}
                >
                  {openLabel}
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

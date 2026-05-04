import { useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useT } from "@/lib/LanguageContext";

interface LeafletDefaultIconPrototype extends L.Icon.Default {
  _getIconUrl?: () => string;
}

interface NominatimResult {
  lat: string;
  lon: string;
}

// Corrige el icono por defecto de Leaflet cuando se empaqueta con Vite.
delete (L.Icon.Default.prototype as LeafletDefaultIconPrototype)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerProps {
  value?: { lat: number; lng: number };
  onChange: (location: { lat: number; lng: number } | undefined) => void;
  defaultCenter?: { lat: number; lng: number };
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({ value, onChange, defaultCenter }: LocationPickerProps) {
  const t = useT();
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`
      );
      if (!res.ok) return;
      const data = (await res.json()) as NominatimResult[];
      const firstResult = data[0];
      if (firstResult) {
        const loc = { lat: parseFloat(firstResult.lat), lng: parseFloat(firstResult.lon) };
        if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
        onChange(loc);
        mapRef.current?.setView([loc.lat, loc.lng], 15);
      }
    } catch {
      // La busqueda depende de red externa; si falla mantenemos la seleccion actual.
    } finally {
      setSearching(false);
    }
  };

  const handleClick = (lat: number, lng: number) => {
    onChange({ lat, lng });
  };

  const center = value || defaultCenter || { lat: 53.3498, lng: -6.2603 };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t('picker_search_placeholder')}
          className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={searching}
          className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          {searching ? "..." : t('picker_search_btn')}
        </button>
      </div>
      <div className="rounded-lg overflow-hidden border border-border h-[200px]">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onClick={handleClick} />
          {value && <Marker position={[value.lat, value.lng]} />}
        </MapContainer>
      </div>
      {value && (
        <p className="text-xs text-muted-foreground">
          📍 {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="ml-2 text-destructive hover:underline"
          >
            {t('picker_remove')}
          </button>
        </p>
      )}
    </div>
  );
}

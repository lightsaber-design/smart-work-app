import { useEffect, useRef, useState } from "react";
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
  display_name: string;
}

function distanceFromCenter(result: NominatimResult, center: { lat: number; lng: number }): number {
  const lat = parseFloat(result.lat);
  const lng = parseFloat(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat - center.lat);
  const dLng = toRadians(lng - center.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(center.lat)) * Math.cos(toRadians(lat)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sortByNearestCity(results: NominatimResult[], center?: { lat: number; lng: number }): NominatimResult[] {
  if (!center) return results;
  return results.slice().sort((a, b) => distanceFromCenter(a, center) - distanceFromCenter(b, center));
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
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const applyResult = (result: NominatimResult) => {
    const loc = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return;
    setSearch(result.display_name);
    setSuggestionsOpen(false);
    onChange(loc);
    mapRef.current?.setView([loc.lat, loc.lng], 15);
  };

  useEffect(() => {
    const query = search.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setSuggestionsOpen(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`,
          { referrerPolicy: "no-referrer", signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as NominatimResult[];
        const sorted = sortByNearestCity(data, defaultCenter);
        setSuggestions(sorted);
        setSuggestionsOpen(sorted.length > 0);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // La busqueda depende de red externa; si falla dejamos el campo tal como esta.
        setSuggestions([]);
        setSuggestionsOpen(false);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const handleSearch = async () => {
    if (!search.trim()) return;
    if (suggestions[0]) {
      applyResult(suggestions[0]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(search)}&limit=1`,
        { referrerPolicy: "no-referrer" }
      );
      if (!res.ok) return;
      const data = sortByNearestCity((await res.json()) as NominatimResult[], defaultCenter);
      const firstResult = data[0];
      if (firstResult) {
        applyResult(firstResult);
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
      <div className="relative flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSuggestionsOpen(suggestions.length > 0)}
            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t('picker_search_placeholder')}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {suggestionsOpen && (
            <div className="absolute left-0 right-0 top-10 z-[1001] max-h-56 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-xl">
              {suggestions.map((item) => (
                <button
                  key={`${item.lat}-${item.lon}-${item.display_name}`}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyResult(item)}
                  className="block w-full px-3 py-2 text-left text-xs leading-snug hover:bg-muted"
                >
                  {item.display_name}
                </button>
              ))}
            </div>
          )}
        </div>
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

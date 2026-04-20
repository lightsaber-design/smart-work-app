import React, { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TimeEntry, formatTime } from "@/hooks/useTimeTracker";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Trash2, Plus, X } from "lucide-react";
import { useT } from "@/lib/LanguageContext";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const startIcon = new L.Icon({
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-[120deg]",
});

const favoriteIcon = L.divIcon({
  className: "",
  html: `<div style="width:22px;height:22px;background:#f59e0b;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -24],
});

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
    fitted.current = true;
  }, [points, map]);
  return null;
}

interface LocationMapProps {
  entries: TimeEntry[];
  favoritePlaces: FavoritePlace[];
  onAddFavorite: (name: string, location: { lat: number; lng: number }) => void;
  onDeleteFavorite: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
}

export function LocationMap({ entries, favoritePlaces, onAddFavorite, onDeleteFavorite, defaultCenter }: LocationMapProps) {
  const t = useT();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | undefined>();

  const entriesWithLocation = entries.filter((e) => e.startLocation || e.endLocation);

  const allPoints: [number, number][] = [
    ...entriesWithLocation.flatMap((e) => {
      const pts: [number, number][] = [];
      if (e.startLocation) pts.push([e.startLocation.lat, e.startLocation.lng]);
      if (e.endLocation) pts.push([e.endLocation.lat, e.endLocation.lng]);
      return pts;
    }),
    ...favoritePlaces.map((p): [number, number] => [p.location.lat, p.location.lng]),
  ];

  const center: [number, number] =
    allPoints.length > 0
      ? allPoints[0]
      : defaultCenter
      ? [defaultCenter.lat, defaultCenter.lng]
      : [53.3498, -6.2603];

  const handleSaveFavorite = () => {
    if (!newName.trim() || !newLocation) return;
    onAddFavorite(newName.trim(), newLocation);
    setNewName("");
    setNewLocation(undefined);
    setAddOpen(false);
  };

  return (
    <div className="px-4 space-y-4">
      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        <MapContainer
          center={center}
          zoom={allPoints.length > 0 ? 14 : 6}
          style={{ height: "350px", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {allPoints.length > 0 && <FitBounds points={allPoints} />}

          {entriesWithLocation.map((entry) => (
            <React.Fragment key={entry.id}>
              {entry.startLocation && (
                <Marker position={[entry.startLocation.lat, entry.startLocation.lng]} icon={startIcon}>
                  <Popup>
                    <strong>🟢 Entrada</strong><br />
                    {formatTime(entry.startTime)}
                    {entry.description && <><br />{entry.description}</>}
                  </Popup>
                </Marker>
              )}
              {entry.endLocation && (
                <Marker position={[entry.endLocation.lat, entry.endLocation.lng]}>
                  <Popup>
                    <strong>🔴 Salida</strong><br />
                    {entry.endTime ? formatTime(entry.endTime) : "En curso"}
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}

          {favoritePlaces.map((place) => (
            <Marker
              key={place.id}
              position={[place.location.lat, place.location.lng]}
              icon={favoriteIcon}
            >
              <Popup>
                <strong>⭐ {place.name}</strong>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>

      {/* Favorite places section */}
      <div className="rounded-xl bg-card border border-border shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-foreground">{t('map_favorites')}</span>
          </div>
          <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3" />
            {t('map_add')}
          </Button>
        </div>

        {favoritePlaces.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            {t('map_no_favorites')}
          </p>
        ) : (
          <div className="space-y-2">
            {favoritePlaces.map((place) => (
              <div
                key={place.id}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="text-sm text-foreground">{place.name}</span>
                </div>
                <button
                  onClick={() => onDeleteFavorite(place.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline add favorite form */}
      {addOpen && (
        <div className="rounded-xl bg-card border border-border shadow-sm p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">{t('map_new_favorite')}</span>
            <button onClick={() => setAddOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2">
            <Label>{t('map_place_name')}</Label>
            <Input
              placeholder={t('map_place_placeholder')}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('map_location_label')}</Label>
            <LocationPicker value={newLocation} onChange={setNewLocation} defaultCenter={defaultCenter} />
          </div>
          <Button
            onClick={handleSaveFavorite}
            disabled={!newName.trim() || !newLocation}
            className="w-full"
          >
            {t('map_save_place')}
          </Button>
        </div>
      )}
    </div>
  );
}

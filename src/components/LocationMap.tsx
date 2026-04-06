import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TimeEntry, formatTime } from "@/hooks/useTimeTracker";

// Fix default marker icons
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

function FitBounds({ entries }: { entries: TimeEntry[] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current) return;
    const points: L.LatLngExpression[] = [];
    entries.forEach((e) => {
      if (e.startLocation) points.push([e.startLocation.lat, e.startLocation.lng]);
      if (e.endLocation) points.push([e.endLocation.lat, e.endLocation.lng]);
    });
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
      fitted.current = true;
    }
  }, [entries, map]);

  return null;
}

interface LocationMapProps {
  entries: TimeEntry[];
}

export function LocationMap({ entries }: LocationMapProps) {
  const entriesWithLocation = entries.filter(
    (e) => e.startLocation || e.endLocation
  );

  if (entriesWithLocation.length === 0) {
    return (
      <div className="px-4">
        <div className="rounded-xl bg-card p-8 shadow-sm border border-border text-center">
          <p className="text-muted-foreground text-sm">
            No hay ubicaciones registradas aún. Ficha para guardar tu ubicación.
          </p>
        </div>
      </div>
    );
  }

  const firstLoc =
    entriesWithLocation[0].startLocation || entriesWithLocation[0].endLocation;
  const center: [number, number] = firstLoc
    ? [firstLoc.lat, firstLoc.lng]
    : [40.4168, -3.7038];

  return (
    <div className="px-4">
      <div className="rounded-xl overflow-hidden border border-border shadow-sm">
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: "350px", width: "100%" }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds entries={entriesWithLocation} />
          {entriesWithLocation.map((entry) => (
            <React.Fragment key={entry.id}>
              {entry.startLocation && (
                <Marker position={[entry.startLocation.lat, entry.startLocation.lng]} icon={startIcon}>
                  <Popup>
                    <strong>🟢 Entrada</strong>
                    <br />
                    {formatTime(entry.startTime)}
                    {entry.description && (
                      <>
                        <br />
                        {entry.description}
                      </>
                    )}
                  </Popup>
                </Marker>
              )}
              {entry.endLocation && (
                <Marker position={[entry.endLocation.lat, entry.endLocation.lng]}>
                  <Popup>
                    <strong>🔴 Salida</strong>
                    <br />
                    {entry.endTime ? formatTime(entry.endTime) : "En curso"}
                  </Popup>
                </Marker>
              )}
            </React.Fragment>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

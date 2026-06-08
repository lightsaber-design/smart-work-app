import { lazy, Suspense, useState, useMemo } from "react";
import { MapPin, Loader2, WifiOff, RefreshCw, LocateFixed, X, List, Map } from "lucide-react";
import { usePublicPlaces, PlaceType, PlaceAmenity, PublicPlace } from "@/hooks/usePublicPlaces";
import { useT } from "@/lib/LanguageContext";
import { openGoogleMaps } from "@/lib/maps";

const PlacesMapView = lazy(() =>
  import("@/components/PlacesMapView").then((m) => ({ default: m.PlacesMapView }))
);

interface PublicPlacesViewProps {
  center: { lat: number; lng: number } | undefined;
  cityName?: string;
}

const TYPE_ICON: Record<PlaceType, string> = {
  library:          "📚",
  toilet:           "🚽",
  cafe:             "☕",
  mall:             "🏬",
  community_centre: "🏛️",
  fast_food:        "🍔",
  other:            "📍",
};

const AMENITY_ICON: Record<PlaceAmenity, string> = {
  bathroom: "🚽",
  quiet:    "🤫",
  free:     "🆓",
  climate:  "🌡️",
};

type ActiveFilter = PlaceAmenity | "all";
type ViewMode = "list" | "map";

function distanceLabel(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

interface PlaceCardProps {
  place: PublicPlace;
  toiletLabel: string;
  openLabel: string;
}

function PlaceCard({ place, toiletLabel, openLabel }: PlaceCardProps) {
  const name = place.name || toiletLabel;
  return (
    <div className="flex items-start gap-3 py-3 px-3 rounded-2xl bg-secondary/40 hover:bg-secondary/70 transition-colors">
      <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{TYPE_ICON[place.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{distanceLabel(place.distance)}</p>
        {place.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {place.amenities.map((a) => (
              <span
                key={a}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold rounded-full px-1.5 py-0.5 bg-background border border-border text-muted-foreground"
              >
                {AMENITY_ICON[a]}
              </span>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => openGoogleMaps({ lat: place.lat, lng: place.lng })}
        aria-label={openLabel}
        title={openLabel}
        className="flex-shrink-0 mt-0.5 p-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all"
      >
        <MapPin className="w-4 h-4" />
      </button>
    </div>
  );
}

export function PublicPlacesView({ center: cityCenter, cityName }: PublicPlacesViewProps) {
  const t = useT();
  const [filter, setFilter] = useState<ActiveFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [gpsCenter, setGpsCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  const effectiveCenter = gpsCenter ?? cityCenter;

  const { places, loading, error } = usePublicPlaces(effectiveCenter);

  const locationLabel = gpsCenter
    ? t("places_location_gps")
    : cityName || t("places_location_city");

  const handleGps = () => {
    if (gpsCenter) {
      // Toggle off GPS → back to city
      setGpsCenter(null);
      setGpsError(false);
      return;
    }
    if (!navigator.geolocation) { setGpsError(true); return; }
    setGpsLoading(true);
    setGpsError(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => {
        setGpsError(true);
        setGpsLoading(false);
      },
      { timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const filters: { key: ActiveFilter; label: string; icon: string }[] = [
    { key: "all",      label: t("places_filter_all"),     icon: "🗺️" },
    { key: "bathroom", label: t("places_filter_bathroom"), icon: "🚽" },
    { key: "quiet",    label: t("places_filter_quiet"),    icon: "🤫" },
    { key: "free",     label: t("places_filter_free"),     icon: "🆓" },
    { key: "climate",  label: t("places_filter_climate"),  icon: "🌡️" },
  ];

  const filtered = useMemo(() => {
    if (filter === "all") return places;
    return places.filter((p) => p.amenities.includes(filter));
  }, [places, filter]);

  if (!effectiveCenter) {
    return (
      <div className="rounded-xl bg-card border border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("places_no_location")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">

      {/* Location bar + view toggle */}
      <div className="rounded-xl bg-card border border-border px-3 py-2.5">
        {/* Row 1: location + GPS button + view toggle */}
        <div className="flex items-center gap-2">
          {/* Location label */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <span className={`text-base ${gpsCenter ? "text-primary" : "text-muted-foreground"}`}>
              {gpsCenter ? "🎯" : "📍"}
            </span>
            <span className="text-sm font-semibold text-foreground truncate">{locationLabel}</span>
            {gpsError && (
              <span className="text-[10px] text-destructive font-semibold">{t("places_gps_error")}</span>
            )}
          </div>

          {/* GPS button (pencil / crosshair) */}
          <button
            type="button"
            onClick={handleGps}
            disabled={gpsLoading}
            title={gpsCenter ? t("places_gps_off") : t("places_gps_on")}
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-90 ${
              gpsCenter
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
          >
            {gpsLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : gpsCenter ? (
              <X className="w-4 h-4" />
            ) : (
              <LocateFixed className="w-4 h-4" />
            )}
          </button>

          {/* View mode toggle */}
          <div className="flex-shrink-0 flex items-center rounded-xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center justify-center w-8 h-8 transition-colors ${
                viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              title={t("places_view_list")}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`flex items-center justify-center w-8 h-8 transition-colors ${
                viewMode === "map" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
              title={t("places_view_map")}
            >
              <Map className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: legend */}
        <div className="mt-2 pt-2 border-t border-border/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
            {t("places_legend")}
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
            {(["bathroom", "quiet", "free", "climate"] as PlaceAmenity[]).map((a) => (
              <span key={a} className="text-[11px] text-muted-foreground">
                {AMENITY_ICON[a]} {t(`places_amenity_${a}`)}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
              filter === f.key
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border hover:border-primary/40"
            }`}
          >
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-10">
          <Loader2 className="w-7 h-7 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t("places_loading")}</p>
        </div>
      ) : error ? (
        <div className="rounded-xl bg-card border border-destructive/30 p-5 text-center space-y-2">
          <WifiOff className="w-6 h-6 text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">{t("places_error")}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t("places_retry")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-muted/30 border border-border p-6 text-center">
          <p className="text-sm font-semibold text-foreground">{t("places_empty_title")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("places_empty_hint")}</p>
        </div>
      ) : viewMode === "map" ? (
        <Suspense fallback={
          <div className="rounded-2xl border border-border bg-muted/40 flex items-center justify-center" style={{ height: 370 }}>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        }>
          <PlacesMapView
            center={effectiveCenter}
            places={filtered}
            toiletLabel={t("places_type_toilet")}
            openLabel={t("map_open_google")}
            centerLabel={locationLabel}
          />
        </Suspense>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              toiletLabel={t("places_type_toilet")}
              openLabel={t("map_open_google")}
            />
          ))}
        </div>
      )}
    </div>
  );
}

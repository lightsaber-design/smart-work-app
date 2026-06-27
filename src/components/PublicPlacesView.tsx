import { lazy, Suspense, useState, useMemo } from "react";
import { MapPin, Loader2, WifiOff, RefreshCw, LocateFixed, X, List, Map, ChevronRight, Clock, Star, Check } from "lucide-react";
import { usePublicPlaces, PlaceType, PlaceAmenity, PublicPlace } from "@/hooks/usePublicPlaces";
import { useT } from "@/lib/LanguageContext";
import { openGoogleMaps } from "@/lib/maps";
import { getPlaceHints } from "@/lib/placeHints";
import { isOpenNow } from "@/lib/openingHours";

const PlacesMapView = lazy(() =>
  import("@/components/PlacesMapView").then((m) => ({ default: m.PlacesMapView }))
);

interface PublicPlacesViewProps {
  center: { lat: number; lng: number } | undefined;
  cityName?: string;
  onAddFavorite?: (name: string, location: { lat: number; lng: number }) => void;
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

type ActiveFilter = PlaceAmenity | "all";
type ViewMode = "list" | "map";

// El mapa ocupa el espacio restante hasta el final de la pantalla (restando la
// cabecera, el selector de pestañas, la barra de ubicación, los filtros y la
// barra de navegación inferior).
const MAP_FILL_HEIGHT = "calc(100dvh - 410px)";

function distanceLabel(m: number): string {
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

interface PlaceCardProps {
  place: PublicPlace;
  toiletLabel: string;
  hintText?: string;
  openLabel: string;
  closedLabel: string;
  accessibleLabel: string;
  onSelect: () => void;
}

function AccessibleBadge({ label }: { label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400"
      title={label}
    >
      <span aria-hidden>♿</span>
      {label}
    </span>
  );
}

function OpenBadge({ open, openLabel, closedLabel }: { open: boolean | null; openLabel: string; closedLabel: string }) {
  if (open === null) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        open
          ? "bg-green-500/15 text-green-600 dark:text-green-400"
          : "bg-muted text-muted-foreground"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${open ? "bg-green-500" : "bg-muted-foreground/60"}`} />
      {open ? openLabel : closedLabel}
    </span>
  );
}

function PlaceCard({ place, toiletLabel, hintText, openLabel, closedLabel, accessibleLabel, onSelect }: PlaceCardProps) {
  const name = place.name || toiletLabel;
  const open = isOpenNow(place.openingHours);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left flex items-start gap-3 py-3 px-3 rounded-2xl bg-card border border-border hover:border-primary/40 active:scale-[0.99] transition-all"
    >
      <span className="text-2xl leading-none mt-0.5 flex-shrink-0">{TYPE_ICON[place.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground leading-tight truncate">{name}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
          {distanceLabel(place.distance)}
          <OpenBadge open={open} openLabel={openLabel} closedLabel={closedLabel} />
          {place.wheelchair && <AccessibleBadge label={accessibleLabel} />}
        </p>
        {hintText && (
          <p className="text-[11px] text-foreground/70 mt-1 leading-snug line-clamp-2">{hintText}</p>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1.5" />
    </button>
  );
}

export function PublicPlacesView({ center: cityCenter, cityName, onAddFavorite }: PublicPlacesViewProps) {
  const t = useT();
  // Filtros de servicios multi-selección. Conjunto vacío = "Todos".
  const [activeAmenities, setActiveAmenities] = useState<Set<PlaceAmenity>>(() => new Set());
  const [openNow, setOpenNow] = useState(false);

  const toggleAmenity = (key: ActiveFilter) => {
    if (key === "all") { setActiveAmenities(new Set()); return; }
    setActiveAmenities((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<PublicPlace | null>(null);
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
    // AND entre servicios seleccionados: el lugar debe cumplir todos.
    let list = activeAmenities.size === 0
      ? places
      : places.filter((p) => [...activeAmenities].every((a) => p.amenities.includes(a)));
    // "Abierto ahora": ocultar los que sabemos cerrados; mantener abiertos y desconocidos.
    if (openNow) list = list.filter((p) => isOpenNow(p.openingHours) !== false);
    return list;
  }, [places, activeAmenities, openNow]);

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
      </div>

      {/* Filter chips — se ajustan en varias filas (sin barra de scroll) */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpenNow((v) => !v)}
          aria-pressed={openNow}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
            openNow
              ? "bg-green-500 text-white border-green-500 shadow-sm"
              : "bg-card text-muted-foreground border-border hover:border-green-500/40"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t("places_open_now")}</span>
        </button>
        {filters.map((f) => {
          const isActive = f.key === "all"
            ? activeAmenities.size === 0
            : activeAmenities.has(f.key as PlaceAmenity);
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => toggleAmenity(f.key)}
              aria-pressed={isActive}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                isActive
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-card text-muted-foreground border-border hover:border-primary/40"
              }`}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          );
        })}
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
          <div className="rounded-2xl border border-border bg-muted/40 flex items-center justify-center" style={{ height: MAP_FILL_HEIGHT, minHeight: 360 }}>
            <Loader2 className="w-6 h-6 text-primary animate-spin" />
          </div>
        }>
          <PlacesMapView
            center={effectiveCenter}
            places={filtered}
            toiletLabel={t("places_type_toilet")}
            openLabel={t("map_open_google")}
            centerLabel={locationLabel}
            favLabel={t("places_add_favorite")}
            favSavedLabel={t("places_added_favorite")}
            onAddFavorite={onAddFavorite}
            heightStyle={MAP_FILL_HEIGHT}
          />
        </Suspense>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((place) => {
            const hints = getPlaceHints(place, t);
            return (
              <PlaceCard
                key={place.id}
                place={place}
                toiletLabel={t("places_type_toilet")}
                hintText={hints.map((h) => h.text).join(" · ")}
                openLabel={t("places_open")}
                closedLabel={t("places_closed")}
                accessibleLabel={t("places_accessible_badge")}
                onSelect={() => setSelected(place)}
              />
            );
          })}
        </div>
      )}

      {/* Detail sheet — info útil al pulsar un resultado */}
      {selected && (
        <PlaceDetailSheet
          place={selected}
          toiletLabel={t("places_type_toilet")}
          onClose={() => setSelected(null)}
          onAddFavorite={onAddFavorite}
          t={t}
        />
      )}
    </div>
  );
}

interface PlaceDetailSheetProps {
  place: PublicPlace;
  toiletLabel: string;
  onClose: () => void;
  onAddFavorite?: (name: string, location: { lat: number; lng: number }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

function PlaceDetailSheet({ place, toiletLabel, onClose, onAddFavorite, t }: PlaceDetailSheetProps) {
  const hints = getPlaceHints(place, t);
  const name = place.name || toiletLabel;
  const open = isOpenNow(place.openingHours);
  const [saved, setSaved] = useState(false);

  const handleAddFavorite = () => {
    if (!onAddFavorite || saved) return;
    onAddFavorite(name, { lat: place.lat, lng: place.lng });
    setSaved(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md mx-auto bg-card rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300">
        <button onClick={onClose} className="w-full flex flex-col items-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </button>
        <div className="px-5 pb-24 pt-2 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none flex-shrink-0">{TYPE_ICON[place.type]}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-bold text-foreground leading-tight">{name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                {distanceLabel(place.distance)}
                <OpenBadge open={open} openLabel={t("places_open")} closedLabel={t("places_closed")} />
                {place.wheelchair && <AccessibleBadge label={t("places_accessible_badge")} />}
              </p>
              {place.openingHours && (
                <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1.5">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
                  <span className="leading-snug">{place.openingHours}</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Info útil */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("places_detail_info")}
            </p>
            {hints.length > 0 ? (
              <ul className="space-y-1.5">
                {hints.map((h, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <span className="flex-shrink-0 leading-tight">{h.icon}</span>
                    <span className="leading-snug">{h.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t("places_detail_no_info")}</p>
            )}
          </div>

          {/* Acciones */}
          <div className="space-y-2">
            {onAddFavorite && (
              <button
                onClick={handleAddFavorite}
                disabled={saved}
                className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold border transition-transform active:scale-[0.98] ${
                  saved
                    ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                }`}
              >
                {saved ? <Check className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                {saved ? t("places_added_favorite") : t("places_add_favorite")}
              </button>
            )}
            <button
              onClick={() => openGoogleMaps({ lat: place.lat, lng: place.lng })}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 active:scale-[0.98] transition-transform"
            >
              <MapPin className="w-4 h-4" />
              {t("map_open_google")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

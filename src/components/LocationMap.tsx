import { lazy, Suspense, useState } from "react";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, Star, Trash2, Plus } from "lucide-react";
import { useT } from "@/lib/LanguageContext";
import { openGoogleMaps } from "@/lib/maps";
import { PublicPlacesView } from "@/components/PublicPlacesView";

const LocationPicker = lazy(() => import("@/components/LocationPicker").then((module) => ({ default: module.LocationPicker })));

interface LocationMapProps {
  favoritePlaces: FavoritePlace[];
  onAddFavorite: (name: string, location: { lat: number; lng: number }) => void;
  onDeleteFavorite: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
  cityName?: string;
}

type MapView = "favorites" | "public";

export function LocationMap({ favoritePlaces, onAddFavorite, onDeleteFavorite, defaultCenter, cityName }: LocationMapProps) {
  const t = useT();
  const [view, setView] = useState<MapView>("public");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<{ lat: number; lng: number } | undefined>();

  const handleSaveFavorite = () => {
    if (!newName.trim() || !newLocation) return;
    onAddFavorite(newName.trim(), newLocation);
    setNewName("");
    setNewLocation(undefined);
    setAddOpen(false);
  };

  const handleClose = () => {
    setAddOpen(false);
    setNewName("");
    setNewLocation(undefined);
  };

  return (
    <div className="px-4 space-y-4">
      {/* Tab switcher */}
      <div className="flex rounded-2xl border border-border bg-muted/40 p-1 gap-1">
        <button
          type="button"
          onClick={() => setView("public")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
            view === "public"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("places_tab_public")}
        </button>
        <button
          type="button"
          onClick={() => setView("favorites")}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:scale-[0.97] ${
            view === "favorites"
              ? "bg-card shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("places_tab_favorites")}
        </button>
      </div>

      {/* Public places */}
      {view === "public" && <PublicPlacesView center={defaultCenter} cityName={cityName} onAddFavorite={onAddFavorite} />}

      {/* Favorites */}
      {view === "favorites" && (
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
            <p className="text-xs text-muted-foreground">{t('map_no_favorites')}</p>
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
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openGoogleMaps(place.location)}
                      aria-label={t('map_open_google')}
                      title={t('map_open_google')}
                      className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFavorite(place.id)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overlay */}
      {addOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleClose}
        />
      )}

      {/* Bottom sheet for adding favorite */}
      <div
        className={`fixed left-0 right-0 bottom-16 max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          addOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-card rounded-t-3xl border-t border-x shadow-2xl max-h-[calc(90vh-4rem)] overflow-y-auto">
          <button
            className="sticky top-0 w-full flex flex-col items-center pt-3 pb-2 bg-card rounded-t-3xl"
            onClick={handleClose}
          >
            <div className="w-10 h-1 rounded-full bg-border" />
          </button>

          <div className="px-4 pb-4 space-y-4">
            <span className="text-base font-semibold text-foreground">{t('map_new_favorite')}</span>

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
              <Suspense fallback={<div className="h-[200px] rounded-lg border border-border bg-muted/40" />}>
                <LocationPicker value={newLocation} onChange={setNewLocation} defaultCenter={defaultCenter} />
              </Suspense>
            </div>

            <Button
              onClick={handleSaveFavorite}
              disabled={!newName.trim() || !newLocation}
              className="w-full"
            >
              {t('map_save_place')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

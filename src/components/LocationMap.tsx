import { useState } from "react";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { LocationPicker } from "@/components/LocationPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Star, Trash2, Plus } from "lucide-react";
import { useT } from "@/lib/LanguageContext";

interface LocationMapProps {
  entries?: unknown[];
  favoritePlaces: FavoritePlace[];
  onAddFavorite: (name: string, location: { lat: number; lng: number }) => void;
  onDeleteFavorite: (id: string) => void;
  defaultCenter?: { lat: number; lng: number };
}

export function LocationMap({ favoritePlaces, onAddFavorite, onDeleteFavorite, defaultCenter }: LocationMapProps) {
  const t = useT();
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
      {/* Favorites list */}
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

      {/* Overlay */}
      {addOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={handleClose}
        />
      )}

      {/* Bottom sheet */}
      <div
        className={`fixed left-0 right-0 bottom-0 max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          addOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-card rounded-t-3xl border-t border-x shadow-2xl max-h-[90vh] overflow-y-auto">
          {/* Drag handle */}
          <button
            className="sticky top-0 w-full flex flex-col items-center pt-3 pb-2 bg-card rounded-t-3xl"
            onClick={handleClose}
          >
            <div className="w-10 h-1 rounded-full bg-border" />
          </button>

          <div className="px-4 pb-8 space-y-4">
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
        </div>
      </div>
    </div>
  );
}

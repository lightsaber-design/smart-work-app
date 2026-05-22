import { useState } from "react";
import { Trash2, MapPin, User, Globe, Moon, FileJson, FolderOpen, Plus, Check, ChevronRight, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { CitySearch } from "@/components/CitySearch";
import { PrecursorHoursConfig } from "@/components/PrecursorHoursConfig";
import { TravelTimeConfig } from "@/components/TravelTimeConfig";
import { ActivityHoursConfig } from "@/components/ActivityHoursConfig";
import { SetupData } from "@/hooks/useSetup";
import { useT } from "@/lib/LanguageContext";
import { LANGUAGES, Lang } from "@/lib/i18n";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { CategoryConfig, isDefaultCategoryName } from "@/lib/categories";

interface SettingsViewProps {
  onClearAll: () => void;
  entryCount: number;
  setup: SetupData;
  onSaveSetup: (data: Partial<SetupData>) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
  hasActiveStudies?: boolean;
}

const CATEGORY_COLORS = ["#34B1AF", "#7CC67E", "#9668A2", "#F4CFA4", "#D07D7D", "#5B8DEF", "#E17A47", "#607D8B"];

export function SettingsView({ onClearAll, entryCount, setup, onSaveSetup, isDark, onToggleDark, hasActiveStudies = false }: SettingsViewProps) {
  const t = useT();
  const storage = useJsonStorageStatus();
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState(setup.city ?? undefined);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [newCategorySupport, setNewCategorySupport] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState("");

  const handleSaveCity = () => {
    if (cityDraft) onSaveSetup({ city: cityDraft });
    setEditingCity(false);
  };

  const currentLang = (setup.language ?? "es") as Lang;
  const categories = setup.categorySettings;
  const visibleCategories = categories.filter((category) => category.name !== "Estudio" || hasActiveStudies);
  const activeCategoryCount = visibleCategories.filter((category) => category.active).length;

  const saveCategories = (categorySettings: CategoryConfig[]) => onSaveSetup({ categorySettings });

  const updateCategory = (name: string, updates: Partial<CategoryConfig>) => {
    const categoryIsDefault = isDefaultCategoryName(name);
    const protectedUpdates = categoryIsDefault && ("name" in updates || "color" in updates || "support" in updates);
    if (protectedUpdates) return;
    if (name === "Estudio" && updates.active === true && !hasActiveStudies) {
      window.alert("Create at least one active study before enabling Study.");
      return;
    }
    if (updates.active === false && categories.filter((category) => category.active).length <= 1) {
      window.alert("Keep at least one category active.");
      return;
    }
    saveCategories(categories.map((category) => (category.name === name ? { ...category, ...updates } : category)));
  };

  const renameCategory = (currentName: string) => {
    if (isDefaultCategoryName(currentName)) return;
    const nextName = categoryNameDraft.trim();
    if (!nextName || nextName === currentName) {
      setEditingCategoryName(null);
      return;
    }
    if (isDefaultCategoryName(nextName) || categories.some((category) => category.name.toLowerCase() === nextName.toLowerCase())) {
      window.alert("A category with this name already exists.");
      return;
    }
    saveCategories(categories.map((category) => (category.name === currentName ? { ...category, name: nextName } : category)));
    setEditingCategoryName(null);
    setCategoryNameDraft("");
  };

  const deleteCategory = (name: string) => {
    if (isDefaultCategoryName(name)) return;
    if (categories.find((category) => category.name === name)?.active && categories.filter((category) => category.active).length <= 1) {
      window.alert("Keep at least one category active.");
      return;
    }
    if (!window.confirm("Delete this category? Existing activities keep their label.")) return;
    saveCategories(categories.filter((category) => category.name !== name));
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      window.alert("A category with this name already exists.");
      return;
    }
    saveCategories([...categories, { name, color: newCategoryColor, active: true, support: newCategorySupport }]);
    setNewCategoryName("");
    setNewCategoryColor(CATEGORY_COLORS[0]);
    setNewCategorySupport(true);
  };

  return (
    <div className="px-4 space-y-4 pb-24">
      {/* Profile */}
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('set_profile')}</h3>
        </div>

        {/* City */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5 text-sm">
              <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
              {t('set_city')}
            </Label>
            {!editingCity && (
              <button
                onClick={() => { setCityDraft(setup.city ?? undefined); setEditingCity(true); }}
                className="text-xs text-primary hover:underline"
              >
                {t('set_edit')}
              </button>
            )}
          </div>
          {editingCity ? (
            <div className="space-y-2">
              <CitySearch value={cityDraft} onChange={setCityDraft} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveCity} className="flex-1">{t('set_save')}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingCity(false)} className="flex-1">{t('set_cancel')}</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {setup.city ? setup.city.name : t('set_no_city')}
            </p>
          )}
        </div>

        {/* Precursor hours */}
        <div className="space-y-2 pt-1">
          <Label className="text-sm text-foreground">{t('set_precursor')}</Label>
          <PrecursorHoursConfig
            value={setup.precursorHours}
            onChange={(v) => onSaveSetup({ precursorHours: v })}
          />
        </div>

        {/* Tiempo de trayecto */}
        <div className="space-y-2 pt-1">
          <TravelTimeConfig
            enabled={setup.travelTimeEnabled}
            minutes={setup.travelTimeMinutes}
            onChange={(value) => onSaveSetup({ travelTimeEnabled: value.enabled, travelTimeMinutes: value.minutes })}
          />
        </div>

        <div className="space-y-2 pt-1">
          <ActivityHoursConfig
            startHour={setup.activityStartHour}
            endHour={setup.activityEndHour}
            onChange={(value) => onSaveSetup({ activityStartHour: value.startHour, activityEndHour: value.endHour })}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm border border-border">
        <button
          type="button"
          onClick={() => setCategoriesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
          aria-expanded={categoriesOpen}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Categories</h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeCategoryCount} active · Timer, Calendar, Summary, and Stats
            </p>
            <div className="mt-2 flex gap-1.5">
              {visibleCategories.slice(0, 8).map((category) => (
                <span
                  key={category.name}
                  className={`h-2.5 w-2.5 rounded-full border border-border ${category.active ? "" : "opacity-35"}`}
                  style={{ backgroundColor: category.color }}
                  title={category.name}
                />
              ))}
            </div>
          </div>
          <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${categoriesOpen ? "rotate-90" : ""}`} />
        </button>

        {categoriesOpen && (
          <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
            <div className="space-y-2">
              {visibleCategories.map((category) => (
                <div key={category.name} className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-4 w-4 rounded-full border border-border" style={{ backgroundColor: category.color }} />
                      {editingCategoryName === category.name ? (
                        <Input
                          value={categoryNameDraft}
                          onChange={(event) => setCategoryNameDraft(event.target.value)}
                          onBlur={() => renameCategory(category.name)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") renameCategory(category.name);
                            if (event.key === "Escape") setEditingCategoryName(null);
                          }}
                          className="h-8"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate text-sm font-semibold text-foreground">{category.name}</span>
                      )}
                    </div>
                    <Switch
                      checked={category.active}
                      onCheckedChange={(active) => updateCategory(category.name, { active })}
                    />
                  </div>
                  {isDefaultCategoryName(category.name) ? (
                    <p className="text-xs text-muted-foreground">Base category. You can only include or hide it.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs text-muted-foreground">Color</Label>
                        <div className="flex gap-1.5">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => updateCategory(category.name, { color })}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                              style={{ backgroundColor: color }}
                              aria-label={`Use ${color}`}
                            >
                              {category.color === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs text-muted-foreground">Support category, capped at 55h/month</Label>
                        <Switch
                          checked={category.support}
                          onCheckedChange={(support) => updateCategory(category.name, { support })}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setEditingCategoryName(category.name);
                            setCategoryNameDraft(category.name);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => deleteCategory(category.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground">Add category</Label>
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder="Name"
              />
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex gap-1.5">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                      style={{ backgroundColor: color }}
                      aria-label={`Use ${color}`}
                    >
                      {newCategoryColor === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs text-muted-foreground">Support category by default</Label>
                <Switch checked={newCategorySupport} onCheckedChange={setNewCategorySupport} />
              </div>
              <Button size="sm" onClick={addCategory} className="w-full">
                <Plus className="h-4 w-4" />
                Add category
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Language */}
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('set_language')}</h3>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map(({ code, name, flag }) => (
            <button
              key={code}
              onClick={() => onSaveSetup({ language: code as Lang })}
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors border ${
                currentLang === code
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-foreground border-transparent hover:border-border'
              }`}
            >
              <span className="text-xl">{flag}</span>
              <span className="text-xs">{name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Dark mode */}
      {onToggleDark !== undefined && (
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm text-foreground cursor-pointer" htmlFor="dark-mode-toggle">
              <Moon className="w-4 h-4 text-primary" />
              Modo nocturno
            </Label>
            <Switch id="dark-mode-toggle" checked={!!isDark} onCheckedChange={onToggleDark} />
          </div>
        </div>
      )}

      {/* Data */}
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('set_data')}
        </h3>
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {storage.connected ? "JSON data file" : "Local browser storage"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {storage.fileName ?? "Data is saved on this device"}
              </p>
            </div>
          </div>
          {storage.supported && (
            <button
              onClick={storage.connected ? storage.openFile : storage.createFile}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FolderOpen className="w-4 h-4" />
              {storage.connected ? "Open another JSON file" : "Save data to a JSON file"}
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('set_records', { count: entryCount })}
        </p>
        <button
          onClick={() => { if (confirm(t('set_confirm_delete'))) onClearAll(); }}
          className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
        >
          <Trash2 className="w-4 h-4" />
          {t('set_delete_all')}
        </button>
      </div>

      {/* About */}
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t('set_about')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('set_version')}</p>
      </div>
    </div>
  );
}

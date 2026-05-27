import { useState, type ReactNode } from "react";
import { MinistryMark, MinistryWordmark } from "@/components/MinistryMark";
import { Trash2, MapPin, User, Moon, FileJson, FolderOpen, Plus, Check, ChevronRight, Pencil } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { CitySearch } from "@/components/CitySearch";
import { PrecursorHoursConfig } from "@/components/PrecursorHoursConfig";
import { TravelTimeConfig } from "@/components/TravelTimeConfig";
import { ActivityHoursConfig } from "@/components/ActivityHoursConfig";
import { LanguageFlag } from "@/components/LanguageFlag";
import { SetupData } from "@/hooks/useSetup";
import { useT } from "@/lib/LanguageContext";
import { LANGUAGES, Lang } from "@/lib/i18n";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { CategoryConfig, getCategoryLabel, isDefaultCategoryName } from "@/lib/categories";
import { formatPlaceName } from "@/lib/placeNames";

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

function SettingsSection({
  icon,
  title,
  summary,
  open,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  summary?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-card shadow-sm border border-border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {summary && <div className="mt-1 flex min-h-4 items-center gap-1.5 text-sm text-muted-foreground">{summary}</div>}
          </div>
        </div>
        <ChevronRight className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">{children}</div>}
    </div>
  );
}

export function SettingsView({ onClearAll, entryCount, setup, onSaveSetup, isDark, onToggleDark, hasActiveStudies = false }: SettingsViewProps) {
  const t = useT();
  const storage = useJsonStorageStatus();
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState(setup.city ?? undefined);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [newCategorySupport, setNewCategorySupport] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
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
      window.alert(t("settings_category_study_required"));
      return;
    }
    if (updates.active === false && categories.filter((category) => category.active).length <= 1) {
      window.alert(t("settings_category_keep_one"));
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
      window.alert(t("settings_category_duplicate"));
      return;
    }
    saveCategories(categories.map((category) => (category.name === currentName ? { ...category, name: nextName } : category)));
    setEditingCategoryName(null);
    setCategoryNameDraft("");
  };

  const deleteCategory = (name: string) => {
    if (isDefaultCategoryName(name)) return;
    if (categories.find((category) => category.name === name)?.active && categories.filter((category) => category.active).length <= 1) {
      window.alert(t("settings_category_keep_one"));
      return;
    }
    if (!window.confirm(`${getCategoryLabel(name, t)}\n${t("settings_category_delete_confirm")}`)) return;
    saveCategories(categories.filter((category) => category.name !== name));
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
      window.alert(t("settings_category_duplicate"));
      return;
    }
    saveCategories([...categories, { name, color: newCategoryColor, active: true, support: newCategorySupport }]);
    setNewCategoryName("");
    setNewCategoryColor(CATEGORY_COLORS[0]);
    setNewCategorySupport(true);
  };

  return (
    <div className="px-4 space-y-4 pb-24">
      <SettingsSection
        icon={<User className="w-4 h-4" />}
        title={t("set_profile")}
        summary={
          <>
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{setup.city ? formatPlaceName(setup.city.name, t) : t("set_no_city")}</span>
          </>
        }
        open={profileOpen}
        onToggle={() => setProfileOpen((open) => !open)}
      >
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
              {setup.city ? formatPlaceName(setup.city.name, t) : t('set_no_city')}
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <Label className="text-sm text-foreground">{t('set_precursor')}</Label>
          <PrecursorHoursConfig
            value={setup.precursorHours}
            onChange={(v) => onSaveSetup({ precursorHours: v })}
          />
        </div>

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
      </SettingsSection>

      <div className="overflow-hidden rounded-xl bg-card shadow-sm border border-border">
        <button
          type="button"
          onClick={() => setCategoriesOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 p-5 text-left transition-colors hover:bg-muted/30"
          aria-expanded={categoriesOpen}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Plus className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">{t("settings_categories")}</h3>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs font-bold text-muted-foreground">
                  {activeCategoryCount}
                </span>
                {visibleCategories.slice(0, 8).map((category) => (
                  <span
                    key={category.name}
                    className={`h-2.5 w-2.5 rounded-full border border-border ${category.active ? "" : "opacity-35"}`}
                    style={{ backgroundColor: category.color }}
                    title={getCategoryLabel(category.name, t)}
                  />
                ))}
              </div>
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
                        <span className="truncate text-sm font-semibold text-foreground">{getCategoryLabel(category.name, t)}</span>
                      )}
                    </div>
                    <Switch
                      checked={category.active}
                      onCheckedChange={(active) => updateCategory(category.name, { active })}
                    />
                  </div>
                  {isDefaultCategoryName(category.name) ? (
                    <p className="text-sm text-muted-foreground">{t("settings_category_base_hint")}</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm text-muted-foreground">{t("settings_category_color")}</Label>
                        <div className="flex gap-1.5">
                          {CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => updateCategory(category.name, { color })}
                              className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                              style={{ backgroundColor: color }}
                              aria-label={t("settings_category_use_color", { color })}
                            >
                              {category.color === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm text-muted-foreground">{t("settings_category_support_cap")}</Label>
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
                          {t("settings_category_rename")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="flex-1 text-destructive hover:text-destructive"
                          onClick={() => deleteCategory(category.name)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t("settings_category_delete")}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-dashed border-border p-3 space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground">{t("settings_category_add")}</Label>
              <Input
                value={newCategoryName}
                onChange={(event) => setNewCategoryName(event.target.value)}
                placeholder={t("settings_category_name")}
              />
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm text-muted-foreground">{t("settings_category_color")}</Label>
                <div className="flex gap-1.5">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewCategoryColor(color)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-border"
                      style={{ backgroundColor: color }}
                      aria-label={t("settings_category_use_color", { color })}
                    >
                      {newCategoryColor === color && <Check className="h-3.5 w-3.5 text-white drop-shadow" />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm text-muted-foreground">{t("settings_category_support_default")}</Label>
                <Switch checked={newCategorySupport} onCheckedChange={setNewCategorySupport} />
              </div>
              <Button size="sm" onClick={addCategory} className="w-full">
                <Plus className="h-4 w-4" />
                {t("settings_category_add")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <SettingsSection
        icon={<LanguageFlag lang={currentLang} className="h-4 w-6" />}
        title={t("set_language")}
        summary={
          <>
            {LANGUAGES.map(({ code, name }) => (
              <span
                key={code}
                className={currentLang === code ? "" : "opacity-35"}
                title={name}
              >
                <LanguageFlag lang={code} className="h-3.5 w-5" />
              </span>
            ))}
          </>
        }
        open={languageOpen}
        onToggle={() => setLanguageOpen((open) => !open)}
      >
        <div className="grid grid-cols-3 gap-2">
          {LANGUAGES.map(({ code, name }) => (
            <button
              key={code}
              onClick={() => onSaveSetup({ language: code as Lang })}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 transition-colors border ${
                currentLang === code
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-secondary text-foreground border-transparent hover:border-border'
              }`}
              aria-label={name}
              title={name}
            >
              <LanguageFlag lang={code} className="h-6 w-9" />
              <span className="max-w-full truncate text-xs font-semibold">{name}</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {onToggleDark !== undefined && (
        <SettingsSection
          icon={<Moon className="w-4 h-4" />}
          title={t("settings_dark_mode")}
          summary={
            <span className={`h-2.5 w-2.5 rounded-full ${isDark ? "bg-primary" : "bg-muted-foreground/40"}`} />
          }
          open={displayOpen}
          onToggle={() => setDisplayOpen((open) => !open)}
        >
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm text-foreground cursor-pointer" htmlFor="dark-mode-toggle">
              <Moon className="w-4 h-4 text-primary" />
              {t("settings_dark_mode")}
            </Label>
            <Switch id="dark-mode-toggle" checked={!!isDark} onCheckedChange={onToggleDark} />
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        icon={<FileJson className="w-4 h-4" />}
        title={t("set_data")}
        summary={
          <>
            <FileJson className="h-3.5 w-3.5" />
            <span className="tabular-nums">{entryCount}</span>
          </>
        }
        open={dataOpen}
        onToggle={() => setDataOpen((open) => !open)}
      >
        <div className="rounded-lg border border-border bg-muted/40 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {storage.connected ? t("settings_json_file") : t("settings_local_storage")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {storage.fileName ?? t("settings_data_saved_device")}
              </p>
            </div>
          </div>
          {storage.supported && (
            <button
              onClick={storage.connected ? storage.openFile : storage.createFile}
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            >
              <FolderOpen className="w-4 h-4" />
              {storage.connected ? t("settings_open_json_file") : t("settings_save_json_file")}
            </button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {t('set_records', { count: entryCount })}
        </p>
        <button
          onClick={() => { if (confirm(`${t('set_confirm_delete')}\n${t("set_records", { count: entryCount })}`)) onClearAll(); }}
          className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
        >
          <Trash2 className="w-4 h-4" />
          {t('set_delete_all')}
        </button>

        <div className="mt-5 pt-4 border-t border-border flex flex-col items-center gap-3">
          <MinistryMark size={64} />
          <MinistryWordmark size={18} showUnderline />
          <p className="text-xs text-muted-foreground font-mono tracking-widest">{t('set_version')}</p>
        </div>
      </SettingsSection>
    </div>
  );
}

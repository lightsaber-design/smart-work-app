import { useState, useEffect, type ReactNode } from "react";
import { MinistryMark, MinistryWordmark } from "@/components/MinistryMark";
import { Trash2, MapPin, User, Moon, Sunrise, FileJson, FolderOpen, Plus, Check, ChevronRight, Pencil, Upload, Download, Bell, Cloud, LogIn, LogOut, RefreshCw, RotateCcw, Type } from "lucide-react";
import { useGoogleDriveSync } from "@/hooks/useGoogleDriveSync";
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
import { hasNotificationPermission, requestNotificationPermission } from "@/lib/notifications";
import { localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { LANGUAGES, Lang } from "@/lib/i18n";
import { useJsonStorageStatus } from "@/hooks/useJsonStorage";
import { CategoryConfig, getCategoryLabel, isDefaultCategoryName } from "@/lib/categories";
import { formatPlaceName } from "@/lib/placeNames";

interface SettingsViewProps {
  onClearAll: () => void;
  entryCount: number;
  firstEntryDate?: Date | null;
  setup: SetupData;
  onSaveSetup: (data: Partial<SetupData>) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
  autoDarkMode?: boolean;
  onToggleAutoDark?: () => void;
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

export function SettingsView({ onClearAll, entryCount, firstEntryDate, setup, onSaveSetup, isDark, onToggleDark, autoDarkMode, onToggleAutoDark, hasActiveStudies = false }: SettingsViewProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  const sinceDateLabel = firstEntryDate
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "long", year: "numeric" }).format(firstEntryDate)
    : null;
  const storage = useJsonStorageStatus();
  const gdrive = useGoogleDriveSync();

  // Antigüedad de la última copia en la nube, para mostrar un aviso si lleva
  // demasiado tiempo sin respaldarse.
  const backupAgeMs = gdrive.lastSync ? Date.now() - gdrive.lastSync.getTime() : null;
  const backupStale = backupAgeMs != null && backupAgeMs > 7 * 24 * 3_600_000;
  const backupAgeLabel = (() => {
    if (backupAgeMs == null) return null;
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    const mins = Math.round(backupAgeMs / 60_000);
    if (mins < 60) return rtf.format(-mins, "minute");
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return rtf.format(-hrs, "hour");
    return rtf.format(-Math.round(hrs / 24), "day");
  })();
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState(setup.city ?? undefined);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [newCategorySupport, setNewCategorySupport] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [displayOpen, setDisplayOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(true);
  const [notifPermission, setNotifPermission] = useState<boolean | null>(null);

  useEffect(() => {
    hasNotificationPermission().then(setNotifPermission).catch(() => setNotifPermission(false));
  }, []);
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
    // Solo protege nombre y tipo-soporte en categorías base; el color es siempre editable
    const protectedUpdates = categoryIsDefault && ("name" in updates || "support" in updates);
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

        <div className="space-y-2 pt-1 border-t border-border">
          <Label className="text-sm text-foreground">{t("settings_report_calc_title")}</Label>
          <p className="text-xs text-muted-foreground">{t("settings_report_calc_hint")}</p>
          <div className="grid grid-cols-2 gap-2">
            {(["carryover", "round"] as const).map((mode) => {
              const selected = (setup.monthlyReportRounding ?? "carryover") === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSaveSetup({ monthlyReportRounding: mode })}
                  aria-pressed={selected}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    selected ? "border-primary bg-primary/10" : "border-border hover:border-primary/40"
                  }`}
                >
                  <p className="text-xs font-semibold text-foreground">
                    {t(mode === "carryover" ? "settings_report_calc_carryover" : "settings_report_calc_round")}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">
                    {t(mode === "carryover" ? "settings_report_calc_carryover_hint" : "settings_report_calc_round_hint")}
                  </p>
                </button>
              );
            })}
          </div>
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
            {/* Categoría preseleccionada al abrir el cronómetro */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">{t("settings_default_category")}</Label>
              <div className="flex flex-wrap gap-2">
                {visibleCategories.filter((category) => category.active).map((category) => {
                  const selected = setup.defaultCategory === category.name;
                  return (
                    <button
                      key={category.name}
                      type="button"
                      onClick={() => onSaveSetup({ defaultCategory: category.name })}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                        selected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card text-muted-foreground border-border hover:border-primary/40"
                      }`}
                    >
                      <span className="h-2.5 w-2.5 rounded-full border border-border/50" style={{ backgroundColor: category.color }} />
                      {getCategoryLabel(category.name, t)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 border-t border-border pt-4">
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
                  <>
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-sm text-muted-foreground">{t("settings_category_color")}</Label>
                        <div className="flex gap-1.5 flex-wrap justify-end">
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
                      {!isDefaultCategoryName(category.name) && (
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
                      )}
                  </>
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
            <Switch id="dark-mode-toggle" checked={!!isDark} onCheckedChange={onToggleDark} disabled={!!autoDarkMode} />
          </div>

          <div className="flex items-center justify-between border-t border-border pt-3">
            <Label className="flex items-center gap-2 text-sm text-foreground cursor-pointer" htmlFor="large-text-toggle">
              <Type className="w-4 h-4 text-primary" />
              {t("settings_large_text")}
            </Label>
            <Switch
              id="large-text-toggle"
              checked={!!setup.largeText}
              onCheckedChange={(v) => onSaveSetup({ largeText: v })}
            />
          </div>
          {setup.city && onToggleAutoDark !== undefined && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2 text-sm text-foreground cursor-pointer" htmlFor="auto-dark-toggle">
                  <Sunrise className="w-4 h-4 text-amber-500" />
                  {t("settings_dark_auto")}
                </Label>
                <Switch id="auto-dark-toggle" checked={!!autoDarkMode} onCheckedChange={onToggleAutoDark} />
              </div>
              {autoDarkMode && (
                <p className="mt-1.5 text-[11px] text-muted-foreground leading-snug">
                  {t("settings_dark_auto_hint")}
                </p>
              )}
            </div>
          )}
        </SettingsSection>
      )}

      <SettingsSection
        icon={<Bell className="w-4 h-4" />}
        title={t("settings_notifications")}
        summary={
          notifPermission === null ? undefined : (
            <span className={`text-xs font-semibold ${notifPermission ? "text-green-500" : "text-destructive"}`}>
              {notifPermission ? t("settings_notif_status_granted") : t("settings_notif_status_denied")}
            </span>
          )
        }
        open={notificationsOpen}
        onToggle={() => setNotificationsOpen((o) => !o)}
      >
        {/* Permission row */}
        <div className="flex items-center justify-between gap-3 pb-1">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              {notifPermission
                ? t("settings_notif_status_granted")
                : t("settings_notif_request")}
            </p>
            {!notifPermission && (
              <p className="text-xs text-muted-foreground">{t("settings_notif_status_denied")}</p>
            )}
          </div>
          {!notifPermission && (
            <Button
              size="sm"
              onClick={() =>
                requestNotificationPermission().then((granted) => setNotifPermission(granted))
              }
            >
              {t("settings_notif_request")}
            </Button>
          )}
        </div>

        {/* Toggle: timer overrun */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-foreground">{t("settings_notif_timer_overrun")}</Label>
            <Switch
              checked={setup.notifTimerOverrun}
              onCheckedChange={(v) => onSaveSetup({ notifTimerOverrun: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("settings_notif_timer_overrun_hint")}</p>
        </div>

        {/* Toggle: timer 3h */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-foreground">{t("settings_notif_timer_3h")}</Label>
            <Switch
              checked={setup.notifTimer3h}
              onCheckedChange={(v) => onSaveSetup({ notifTimer3h: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("settings_notif_timer_3h_hint")}</p>
        </div>

        {/* Toggle: monthly goal */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-foreground">{t("settings_notif_monthly_goal")}</Label>
            <Switch
              checked={setup.notifMonthlyGoal}
              onCheckedChange={(v) => onSaveSetup({ notifMonthlyGoal: v })}
              disabled={!setup.precursorHours}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("settings_notif_monthly_goal_hint")}</p>
        </div>

        {/* Toggle: actividad sin fichar */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-foreground">{t("settings_notif_unlogged")}</Label>
            <Switch
              checked={setup.notifUnlogged}
              onCheckedChange={(v) => onSaveSetup({ notifUnlogged: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("settings_notif_unlogged_hint")}</p>
        </div>

        {/* Toggle: recordatorio de informe */}
        <div className="space-y-0.5 pt-1">
          <div className="flex items-center justify-between gap-3">
            <Label className="text-sm text-foreground">{t("settings_notif_report")}</Label>
            <Switch
              checked={setup.notifReport}
              onCheckedChange={(v) => onSaveSetup({ notifReport: v })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t("settings_notif_report_hint")}</p>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={<FileJson className="w-4 h-4" />}
        title={t("set_data")}
        summary={
          sinceDateLabel ? (
            <>
              <FileJson className="h-3.5 w-3.5" />
              <span className="truncate">{t("set_data_since", { date: sinceDateLabel })}</span>
            </>
          ) : (
            <>
              <FileJson className="h-3.5 w-3.5" />
              <span className="tabular-nums">{entryCount}</span>
            </>
          )
        }
        open={dataOpen}
        onToggle={() => setDataOpen((open) => !open)}
      >
        {/* Estado de copia de seguridad — visible de un vistazo */}
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${
            gdrive.isSignedIn
              ? backupStale
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          <Cloud className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {gdrive.isSignedIn
              ? gdrive.lastSync
                ? t("backup_saved_at", { date: backupAgeLabel ?? "" })
                : t("backup_never")
              : t("backup_local_auto")}
          </span>
        </div>

        {/* LOCAL: almacenamiento en este dispositivo */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <FileJson className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("settings_data_local_title")}</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center gap-2">
              <FileJson className="h-4 w-4 text-primary flex-shrink-0" />
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
            {sinceDateLabel && (
              <p className="text-xs text-muted-foreground">{t('set_data_since', { date: sinceDateLabel })}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("backup_local_hint")}</p>

            {/* Export / Import */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <button
                onClick={() => storage.exportData()}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <Download className="w-4 h-4" />
                {t('set_export_data')}
              </button>
              <label className="flex items-center gap-2 text-sm font-medium text-primary hover:underline cursor-pointer">
                <Upload className="w-4 h-4" />
                {t('set_import_data')}
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (confirm(t('set_import_confirm'))) {
                      await storage.importData(file);
                    }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* GOOGLE DRIVE: copia en la nube */}
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <Cloud className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">{t("gdrive_section_title")}</p>
            {gdrive.isSignedIn && (
              <span className="ml-auto text-xs font-semibold text-green-500 truncate max-w-[140px]">{gdrive.user?.email}</span>
            )}
          </div>
          <div className="space-y-3 p-4">
            {gdrive.errorMsg && (
              <p className="text-xs text-destructive rounded-lg bg-destructive/10 px-3 py-2">
                {t("gdrive_error", { msg: gdrive.errorMsg })}
              </p>
            )}

            {!gdrive.isSignedIn ? (
              <>
                <p className="text-xs text-muted-foreground">{t("backup_need_signin")}</p>
                <button
                  onClick={() => gdrive.signIn().catch(() => null)}
                  disabled={gdrive.status === "syncing"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm active:scale-[0.98] transition-transform disabled:opacity-60"
                >
                  {gdrive.status === "syncing" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {gdrive.status === "syncing" ? t("gdrive_syncing") : t("gdrive_sign_in")}
                </button>
              </>
            ) : (
              <>
                {/* Auto Drive backup toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{t("backup_auto_drive")}</p>
                    <p className="text-xs text-muted-foreground">{t("backup_auto_drive_hint")}</p>
                  </div>
                  <Switch
                    checked={setup.autoBackupEnabled}
                    onCheckedChange={(v) => onSaveSetup({ autoBackupEnabled: v })}
                  />
                </div>

                {setup.autoBackupEnabled && (
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-muted-foreground shrink-0">{t("backup_freq")}</p>
                    <div className="flex gap-2">
                      {(["daily", "weekly", "monthly"] as const).map((freq) => (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => onSaveSetup({ autoBackupFreq: freq })}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${setup.autoBackupFreq === freq ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                        >
                          {t(`backup_freq_${freq}` as const)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Última copia y archivo remoto */}
                {gdrive.lastSync ? (
                  <p className="text-xs text-muted-foreground">
                    {t("gdrive_last_sync", {
                      date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(gdrive.lastSync),
                    })}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("gdrive_no_backup")}</p>
                )}
                {gdrive.remoteFile && (
                  <p className="text-xs text-muted-foreground">
                    {t("gdrive_remote_file", {
                      date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(gdrive.remoteFile.modifiedTime)),
                    })}
                  </p>
                )}

                {/* Acciones manuales */}
                <div className="flex gap-2 border-t border-border pt-3">
                  <button
                    onClick={() => gdrive.backup().catch(() => null)}
                    disabled={gdrive.status === "syncing"}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-primary bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary active:scale-[0.98] transition-transform disabled:opacity-60"
                  >
                    {gdrive.status === "syncing" ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    {t("gdrive_backup")}
                  </button>
                  <button
                    onClick={() => { if (confirm(t("gdrive_restore_confirm"))) gdrive.restore().catch(() => null); }}
                    disabled={gdrive.status === "syncing" || !gdrive.remoteFile}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-40"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {t("gdrive_restore")}
                  </button>
                </div>
                <button
                  onClick={() => gdrive.signOut()}
                  className="flex items-center gap-2 text-sm font-medium text-destructive hover:underline"
                >
                  <LogOut className="w-4 h-4" />
                  {t("gdrive_sign_out")}
                </button>
              </>
            )}
          </div>
        </div>

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

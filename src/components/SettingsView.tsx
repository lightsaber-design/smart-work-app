import { useState } from "react";
import { Trash2, MapPin, BookOpen, User, Globe, Moon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CitySearch } from "@/components/CitySearch";
import { SetupData } from "@/hooks/useSetup";
import { useT } from "@/lib/LanguageContext";
import { LANGUAGES, Lang } from "@/lib/i18n";

interface SettingsViewProps {
  onClearAll: () => void;
  entryCount: number;
  setup: SetupData;
  onSaveSetup: (data: Partial<SetupData>) => void;
  isDark?: boolean;
  onToggleDark?: () => void;
}

export function SettingsView({ onClearAll, entryCount, setup, onSaveSetup, isDark, onToggleDark }: SettingsViewProps) {
  const t = useT();
  const [editingCity, setEditingCity] = useState(false);
  const [cityDraft, setCityDraft] = useState(setup.city ?? undefined);

  const handleSaveCity = () => {
    if (cityDraft) onSaveSetup({ city: cityDraft });
    setEditingCity(false);
  };

  const currentLang = setup.language ?? 'es';

  return (
    <div className="px-4 space-y-4 pb-24">
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">{t('set_profile')}</h3>
        </div>

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

        <div className="flex items-center justify-between pt-1">
          <Label className="text-sm text-foreground">{t('set_precursor')}</Label>
          <Switch
            checked={setup.isPrecursor}
            onCheckedChange={(v) => onSaveSetup({ isPrecursor: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-sm text-foreground">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            {t('set_bible')}
          </Label>
          <Switch
            checked={setup.hasBibleStudies}
            onCheckedChange={(v) => onSaveSetup({ hasBibleStudies: v })}
          />
        </div>
      </div>

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

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          {t('set_data')}
        </h3>
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

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          {t('set_about')}
        </h3>
        <p className="text-sm text-muted-foreground">{t('set_version')}</p>
      </div>
    </div>
  );
}

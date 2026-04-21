import { useState } from "react";
import { SetupData } from "@/hooks/useSetup";
import { CitySearch } from "@/components/CitySearch";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MapPin, BookOpen, Clock, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LANGUAGES, Lang, detectLanguage } from "@/lib/i18n";
import { useT } from "@/lib/LanguageContext";

interface SetupScreenProps {
  onComplete: (data: Omit<SetupData, "completed">) => void;
  onLangChange: (lang: Lang) => void;
}

export function SetupScreen({ onComplete, onLangChange }: SetupScreenProps) {
  const t = useT();
  const [name, setName] = useState("");
  const [city, setCity] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [isPrecursor, setIsPrecursor] = useState(false);
  const [hasBibleStudies, setHasBibleStudies] = useState(false);
  const [selectedLang, setSelectedLang] = useState<Lang>(detectLanguage());

  const handleLangSelect = (lang: Lang) => {
    setSelectedLang(lang);
    onLangChange(lang);
  };

  const handleSubmit = () => {
    onComplete({ name: name.trim() || undefined, city, isPrecursor, hasBibleStudies, language: selectedLang });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('setup_welcome')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('setup_subtitle')}
          </p>
        </div>

        {/* Language selector */}
        <div className="rounded-xl bg-card border border-border p-5 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">{t('setup_language')}</h2>
          <div className="grid grid-cols-3 gap-2">
            {LANGUAGES.map(({ code, name, flag }) => (
              <button
                key={code}
                onClick={() => handleLangSelect(code)}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors border ${
                  selectedLang === code
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

        {/* Name */}
        <div className="rounded-xl bg-card border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Tu nombre</h2>
          </div>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Marco, Ana..."
          />
        </div>

        {/* City */}
        <div className="rounded-xl bg-card border border-border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">{t('setup_where')}</h2>
          </div>
          <CitySearch
            value={city ?? undefined}
            onChange={setCity}
            placeholder={t('setup_city_placeholder')}
          />
          {city && (
            <p className="text-xs text-muted-foreground">
              📍 {city.name}
            </p>
          )}
        </div>

        {/* Precursor */}
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label className="text-sm font-semibold text-foreground">{t('setup_precursor')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('setup_precursor_hint')}
              </p>
            </div>
            <Switch checked={isPrecursor} onCheckedChange={setIsPrecursor} />
          </div>
        </div>

        {/* Bible Studies */}
        <div className="rounded-xl bg-card border border-border p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-primary flex-shrink-0" />
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">{t('setup_bible')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('setup_bible_hint')}
                </p>
              </div>
            </div>
            <Switch checked={hasBibleStudies} onCheckedChange={setHasBibleStudies} />
          </div>
        </div>

        <Button onClick={handleSubmit} className="w-full" size="lg">
          {t('setup_start')}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          {t('setup_change_later')}
        </p>
      </div>
    </div>
  );
}

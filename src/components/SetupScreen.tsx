import { useState } from "react";
import { SetupData } from "@/hooks/useSetup";
import { CitySearch } from "@/components/CitySearch";
import { PrecursorHoursConfig } from "@/components/PrecursorHoursConfig";
import { TravelTimeConfig } from "@/components/TravelTimeConfig";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Clock, MapPin, User } from "lucide-react";
import { LANGUAGES, Lang, detectLanguage } from "@/lib/i18n";
import { useT } from "@/lib/LanguageContext";
import { DEFAULT_ACTIVITY_END_HOUR, DEFAULT_ACTIVITY_START_HOUR } from "@/lib/activityHours";
import { DEFAULT_CATEGORY_CONFIGS } from "@/lib/categories";

interface SetupScreenProps {
  onComplete: (data: Omit<SetupData, "completed">) => void;
  onLangChange: (lang: Lang) => void;
}

const TOTAL_STEPS = 5;

export function SetupScreen({ onComplete, onLangChange }: SetupScreenProps) {
  const t = useT();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [city, setCity] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [precursorHours, setPrecursorHours] = useState<number | null>(null);
  const [travelTimeEnabled, setTravelTimeEnabled] = useState(false);
  const [travelTimeMinutes, setTravelTimeMinutes] = useState(30);
  const [selectedLang, setSelectedLang] = useState<Lang>(detectLanguage());

  const handleLangSelect = (lang: Lang) => {
    setSelectedLang(lang);
    onLangChange(lang);
  };

  const handleSubmit = () => {
    onComplete({
      name: name.trim() || undefined,
      city,
      precursorHours,
      travelTimeEnabled,
      travelTimeMinutes,
      activityStartHour: DEFAULT_ACTIVITY_START_HOUR,
      activityEndHour: DEFAULT_ACTIVITY_END_HOUR,
      hasBibleStudies: false,
      categorySettings: DEFAULT_CATEGORY_CONFIGS,
      language: selectedLang,
    });
  };

  const goBack = () => setStep((current) => Math.max(0, current - 1));

  const goNext = () => {
    if (step === TOTAL_STEPS - 1) {
      handleSubmit();
      return;
    }
    setStep((current) => Math.min(TOTAL_STEPS - 1, current + 1));
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        {/* Encabezado del asistente de configuracion inicial. */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t("setup_welcome")}</h1>
          <p className="text-sm text-muted-foreground">{t("setup_subtitle")}</p>
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <span
              key={index}
              className={`h-1.5 rounded-full transition-all ${index === step ? "w-7 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>

        <div className="rounded-xl bg-card border border-border p-5 min-h-[292px] flex flex-col justify-center">
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">{t("setup_language")}</h2>
              <div className="grid grid-cols-3 gap-2">
                {LANGUAGES.map(({ code, name: languageName, flag }) => (
                  <button
                    key={code}
                    onClick={() => handleLangSelect(code)}
                    className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors border ${
                      selectedLang === code
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-transparent hover:border-border"
                    }`}
                  >
                    <span className="text-xl">{flag}</span>
                    <span className="text-xs">{languageName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t("setup_name")}</h2>
              </div>
              <input
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("setup_name_placeholder")}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t("setup_where")}</h2>
              </div>
              <CitySearch value={city ?? undefined} onChange={setCity} placeholder={t("setup_city_placeholder")} />
              {city && <p className="text-xs text-muted-foreground">{city.name}</p>}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">{t("setup_precursor")}</Label>
                <p className="text-xs text-muted-foreground">{t("setup_precursor_hint")}</p>
              </div>
              <PrecursorHoursConfig value={precursorHours} onChange={setPrecursorHours} />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <TravelTimeConfig
                enabled={travelTimeEnabled}
                minutes={travelTimeMinutes}
                onChange={(value) => {
                  setTravelTimeEnabled(value.enabled);
                  setTravelTimeMinutes(value.minutes);
                }}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={goBack} disabled={step === 0} className="flex-1" size="lg">
            <ChevronLeft className="h-4 w-4" />
            {t("setup_back")}
          </Button>
          <Button onClick={goNext} className="flex-1" size="lg">
            {step === TOTAL_STEPS - 1 ? t("setup_start") : t("setup_next")}
            {step !== TOTAL_STEPS - 1 && <ChevronRight className="h-4 w-4" />}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">{t("setup_change_later")}</p>
      </div>
    </div>
  );
}

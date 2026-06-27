import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import { TimerWidget } from "@/components/TimerWidget";
import type { SetupData } from "@/hooks/useSetup";
import {
  CurrentWeather,
  HourlyWeather,
  getWeatherHeroTheme,
  weatherCodeToEmoji,
} from "@/lib/weatherUtils";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface HomeTabProps {
  greeting: string;
  userName: string;
  displayCityName: string;
  weather: CurrentWeather | null;
  hourlyWeather: HourlyWeather[];
  heroTheme: ReturnType<typeof getWeatherHeroTheme>;
  setup: SetupData;
  timerIsRunning: boolean;
  timerElapsed: number;
  timerCategory?: string;
  onNavigateToTimer: () => void;
  t: TranslateFn;
  /** "Mis horas" stats, rendered inside Inicio. */
  statsSlot?: ReactNode;
}

export function HomeTab({
  greeting,
  userName,
  displayCityName,
  weather,
  heroTheme,
  setup,
  timerIsRunning,
  timerElapsed,
  timerCategory,
  onNavigateToTimer,
  t,
  statsSlot,
}: HomeTabProps) {
  const WeatherHeroIcon = heroTheme.Icon;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Gradient hero */}
      <div className="relative overflow-hidden px-5 pt-14 pb-20" style={{ background: heroTheme.background }}>
        <div
          className="absolute inset-0 opacity-70 pointer-events-none"
          style={{ backgroundImage: heroTheme.overlay }}
        />
        <div className="absolute right-4 top-24 pointer-events-none">
          <WeatherHeroIcon className="h-20 w-20 text-white/18" strokeWidth={1.4} />
        </div>
        <div className="relative z-10">
          <p className="text-white/80 text-sm font-medium">{greeting}</p>
          <h1 className="text-3xl font-black text-white leading-tight mt-0.5">{userName},</h1>
          {setup.city && (
            <p className="text-white/75 text-[13px] mt-2 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {displayCityName}
              {weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
            </p>
          )}
          {weather && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/16 px-2.5 py-1 text-[11px] font-semibold text-white/85 backdrop-blur">
              <WeatherHeroIcon className="h-3.5 w-3.5" />
              {t(heroTheme.label)}
            </p>
          )}
        </div>
      </div>

      {/* Content card: running timer + "Mis horas" stats */}
      <div className="bg-background rounded-t-[32px] -mt-10 relative z-10 px-5 pt-5">
        <TimerWidget
          isRunning={timerIsRunning}
          elapsed={timerElapsed}
          category={timerCategory}
          onNavigate={onNavigateToTimer}
          t={t}
        />
        {statsSlot && <div className="-mx-5">{statsSlot}</div>}
      </div>
    </div>
  );
}

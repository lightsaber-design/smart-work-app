import { CloudFog, CloudRain, CloudSun, Snowflake, Zap, Moon, Sun } from "lucide-react";

export type HourlyWeather = {
  date: Date;
  temp: number;
  code: number;
  precipitationProbability: number | null;
};

export type CurrentWeather = {
  temp: number;
  code: number;
  isDay: boolean | null;
};

export const WEATHER_CACHE_KEY = "_ml_weather";
export const WEATHER_TTL = 30 * 60 * 1000;

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function weatherCodeToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 3) return "🌤️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

export function weatherCodeToLabel(code: number, t: TranslateFn): string {
  if (code === 0) return t("weather_clear");
  if (code <= 3) return t("weather_cloudy");
  if (code <= 48) return t("weather_fog");
  if (code <= 67) return t("weather_rain");
  if (code <= 77) return t("weather_snow");
  if (code <= 82) return t("weather_showers");
  return t("weather_storm");
}

export function hourLabel(date: Date, t: TranslateFn): string {
  const hour = date.getHours();
  if (hour === 0) return t("time_midnight");
  if (hour === 12) return t("time_noon");
  return t(hour < 12 ? "time_hour_morning" : "time_hour_afternoon", { hour: hour % 12 || 12 });
}

export function isRainyWeather(code: number, probability: number | null): boolean {
  return (code >= 51 && code <= 99) || (probability ?? 0) >= 45;
}

export function getWeatherForDate(hourlyWeather: HourlyWeather[], date: Date): HourlyWeather | null {
  if (hourlyWeather.length === 0) return null;
  const targetMs = date.getTime();
  let bestForecast: HourlyWeather | null = null;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const item of hourlyWeather) {
    const diff = Math.abs(item.date.getTime() - targetMs);
    if (diff > 90 * 60_000 || diff >= bestDiff) continue;
    bestForecast = item;
    bestDiff = diff;
  }
  return bestForecast;
}

export function formatActivityWeather(hourlyWeather: HourlyWeather[], date: Date, t: TranslateFn): string | null {
  const forecast = getWeatherForDate(hourlyWeather, date);
  if (!forecast) return null;
  const rain = isRainyWeather(forecast.code, forecast.precipitationProbability);
  const probability =
    forecast.precipitationProbability != null
      ? ` · ${t("weather_rain_probability", { probability: forecast.precipitationProbability })}`
      : "";
  return `${weatherCodeToEmoji(forecast.code)} ${forecast.temp}° · ${rain ? t("weather_possible_rain") : weatherCodeToLabel(forecast.code, t)}${probability}`;
}

export function formatDayWeatherSummary(
  hourlyWeather: HourlyWeather[],
  events: { date: Date }[],
  t: TranslateFn,
): string | null {
  const anchorDate = events[0]?.date ?? new Date();
  const eventForecasts = events
    .map((event) => ({ event, forecast: getWeatherForDate(hourlyWeather, event.date) }))
    .filter((item): item is { event: { date: Date }; forecast: HourlyWeather } => item.forecast !== null);

  const rainy = eventForecasts.find((item) =>
    isRainyWeather(item.forecast.code, item.forecast.precipitationProbability),
  );
  if (rainy) {
    return `${weatherCodeToEmoji(rainy.forecast.code)} ${t("weather_later_rain", { time: hourLabel(rainy.event.date, t) })}`;
  }

  const dayForecasts = hourlyWeather.filter(
    (item) =>
      item.date.toDateString() === anchorDate.toDateString() &&
      item.date.getHours() >= 7 &&
      item.date.getHours() <= 22,
  );
  const usableForecasts = eventForecasts.map((item) => item.forecast);
  const forecasts = usableForecasts.length > 0 ? usableForecasts : dayForecasts;
  if (forecasts.length === 0) return null;

  const dayRain = dayForecasts.find((item) => isRainyWeather(item.code, item.precipitationProbability));
  if (dayRain)
    return `${weatherCodeToEmoji(dayRain.code)} ${t("weather_later_rain", { time: hourLabel(dayRain.date, t) })}`;

  const warmest = forecasts.slice().sort((a, b) => b.temp - a.temp)[0];
  return `${weatherCodeToEmoji(warmest.code)} ${t("weather_day_summary", { condition: weatherCodeToLabel(warmest.code, t), temp: warmest.temp })}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getWeatherHeroTheme(weather: CurrentWeather | null) {
  const hour = new Date().getHours();
  const weatherIsDay = weather?.isDay;
  const isNight = weatherIsDay === false || (weatherIsDay !== true && (hour < 7 || hour >= 20));
  const code = weather?.code ?? (isNight ? 1 : 0);
  const rainy = isRainyWeather(code, null);
  const stormy = code >= 95;
  const snowy = code >= 71 && code <= 77;
  const foggy = code >= 45 && code <= 48;
  const cloudy = code >= 1 && code <= 3;

  if (stormy) {
    return {
      background: "linear-gradient(160deg, #283142 0%, #516070 54%, #64748b 100%)",
      overlay: "repeating-linear-gradient(105deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 16px)",
      Icon: Zap,
      label: "weather_storm",
    };
  }
  if (rainy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #152238 0%, #24445b 58%, #2f6f73 100%)"
        : "linear-gradient(160deg, #236b80 0%, #47a7ad 58%, #7bbfba 100%)",
      overlay: "repeating-linear-gradient(102deg, rgba(255,255,255,0.28) 0 1px, transparent 1px 13px)",
      Icon: CloudRain,
      label: "weather_rain",
    };
  }
  if (snowy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #1e293b 0%, #475569 58%, #94a3b8 100%)"
        : "linear-gradient(160deg, #7aa8bc 0%, #c2dce5 100%)",
      overlay:
        "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.42) 0 1px, transparent 2px), radial-gradient(circle at 75% 38%, rgba(255,255,255,0.34) 0 1px, transparent 2px)",
      Icon: Snowflake,
      label: "weather_snow",
    };
  }
  if (foggy) {
    return {
      background: isNight
        ? "linear-gradient(160deg, #1f2937 0%, #4b5563 100%)"
        : "linear-gradient(160deg, #6aa5ab 0%, #b7cbc9 100%)",
      overlay: "repeating-linear-gradient(0deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 24px)",
      Icon: CloudFog,
      label: "weather_fog",
    };
  }
  if (isNight) {
    return {
      background: "linear-gradient(160deg, #0f172a 0%, #164e63 58%, #0f766e 100%)",
      overlay: "linear-gradient(180deg, rgba(255,255,255,0.08), transparent 42%)",
      Icon: Moon,
      label: cloudy ? "weather_cloudy_night" : "weather_night",
    };
  }
  if (cloudy) {
    return {
      background: "linear-gradient(160deg, #189ca7 0%, #6bc7c3 100%)",
      overlay: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 45%)",
      Icon: CloudSun,
      label: "weather_cloudy",
    };
  }
  return {
    background: "linear-gradient(160deg, #18a6b6 0%, #64c8bf 58%, #f0c15b 100%)",
    overlay: "linear-gradient(135deg, rgba(255,255,255,0.24), transparent 48%)",
    Icon: Sun,
    label: "weather_sunny",
  };
}

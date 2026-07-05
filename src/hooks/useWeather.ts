import { useState, useEffect } from "react";
import { CurrentWeather, HourlyWeather, WEATHER_CACHE_KEY, WEATHER_TTL } from "@/lib/weatherUtils";
import type { SetupData } from "@/hooks/useSetup";

export function useWeather(city: SetupData["city"]) {
  const [weather, setWeather] = useState<CurrentWeather | null>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && Date.now() - c.ts < WEATHER_TTL) return c.weather as CurrentWeather;
    } catch {
      // ignore corrupt cache
    }
    return null;
  });

  const [hourlyWeather, setHourlyWeather] = useState<HourlyWeather[]>(() => {
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && Date.now() - c.ts < WEATHER_TTL && Array.isArray(c.hourly)) {
        return (c.hourly as HourlyWeather[]).map((h) => ({ ...h, date: new Date(h.date) }));
      }
    } catch {
      // ignore corrupt cache
    }
    return [];
  });

  // Depende de lat/lng (no del objeto `city` entero) para no volver a pedir
  // el tiempo si el padre pasa un objeto nuevo con las mismas coordenadas.
  const lat = city?.lat;
  const lng = city?.lng;

  useEffect(() => {
    if (lat === undefined || lng === undefined) {
      setWeather(null);
      setHourlyWeather([]);
      return;
    }
    try {
      const c = JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY) ?? "null");
      if (c && c.cityKey === `${lat},${lng}` && Date.now() - c.ts < WEATHER_TTL) return;
    } catch {
      // ignore corrupt cache
    }

    let cancelled = false;
    const controller = new AbortController();

    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&hourly=temperature_2m,weather_code,precipitation_probability&forecast_days=7&timezone=auto`,
      { signal: controller.signal },
    )
      .then((r) => r.json())
      .then((data) => {
        // Una respuesta lenta de una ciudad ya no seleccionada no debe pisar
        // el tiempo de la ciudad actual.
        if (cancelled) return;
        const cw = data?.current_weather;
        let newWeather: CurrentWeather | null = null;
        if (cw) {
          newWeather = {
            temp: Math.round(cw.temperature),
            code: cw.weathercode,
            isDay: typeof cw.is_day === "number" ? cw.is_day === 1 : null,
          };
          setWeather(newWeather);
        }
        const hourly = data?.hourly;
        let newHourly: HourlyWeather[] = [];
        if (
          Array.isArray(hourly?.time) &&
          Array.isArray(hourly?.temperature_2m) &&
          Array.isArray(hourly?.weather_code)
        ) {
          newHourly = hourly.time
            .map((time: string, index: number) => ({
              date: new Date(time),
              temp: Math.round(Number(hourly.temperature_2m[index])),
              code: Number(hourly.weather_code[index]),
              precipitationProbability: Array.isArray(hourly.precipitation_probability)
                ? Number(hourly.precipitation_probability[index])
                : null,
            }))
            .filter(
              (item: HourlyWeather) =>
                !Number.isNaN(item.date.getTime()) && Number.isFinite(item.temp) && Number.isFinite(item.code),
            );
          setHourlyWeather(newHourly);
        }
        if (newWeather) {
          try {
            localStorage.setItem(
              WEATHER_CACHE_KEY,
              JSON.stringify({ cityKey: `${lat},${lng}`, ts: Date.now(), weather: newWeather, hourly: newHourly }),
            );
          } catch {
            // weather cache is optional
          }
        }
      })
      .catch((error) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) return;
        console.warn("Weather fetch failed:", error);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [lat, lng]);

  return { weather, hourlyWeather };
}

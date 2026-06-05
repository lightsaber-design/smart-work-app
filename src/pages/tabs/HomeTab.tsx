import { useMemo } from "react";
import { ChevronRight, MapPin, Plus, CheckCircle2 } from "lucide-react";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { AppTab } from "@/components/BottomNav";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { EstudioContact } from "@/hooks/useEstudios";
import type { SetupData } from "@/hooks/useSetup";
import { getCategoryLabel, getCategoryMeta, getCategoryStyle } from "@/lib/categories";
import { formatDateLong } from "@/lib/dateFormat";
import {
  CurrentWeather,
  HourlyWeather,
  formatActivityWeather,
  formatDayWeatherSummary,
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
  calendarEvents: CalendarEvent[];
  estudiosContacts: EstudioContact[];
  setup: SetupData;
  calMonthMs: number;
  navigate: (tab: AppTab) => void;
  navigateToStudySession: (contactId: string, sessionId: string) => void;
  onCompleteStudyNow: (contactId: string, sessionId: string) => void;
  openMonthlyCalendar: () => void;
  t: TranslateFn;
  locale: string;
  todayKey: string;
}

export function HomeTab({
  greeting,
  userName,
  displayCityName,
  weather,
  hourlyWeather,
  heroTheme,
  calendarEvents,
  estudiosContacts,
  setup,
  calMonthMs,
  navigate,
  navigateToStudySession,
  onCompleteStudyNow,
  openMonthlyCalendar,
  t,
  locale,
  todayKey,
}: HomeTabProps) {
  const WeatherHeroIcon = heroTheme.Icon;

  const monthTotalHrs = Math.floor(calMonthMs / 3_600_000);
  const monthTotalMins = Math.floor((calMonthMs % 3_600_000) / 60_000);
  const monthlyGoalPct = setup.precursorHours
    ? Math.min(100, Math.round((calMonthMs / (setup.precursorHours * 3_600_000)) * 100))
    : 0;

  const todayMidnight = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const calUpcoming = useMemo(
    () =>
      calendarEvents
        .filter((e) => !e.completed && e.date.getTime() >= todayMidnight.getTime())
        .map((e) => ({
          id: e.id,
          date: e.date,
          category: e.category,
          label: getCategoryLabel(e.category, t),
          contactName: undefined as string | undefined,
          contactId: undefined as string | undefined,
          sessionId: undefined as string | undefined,
        })),
    [calendarEvents, todayMidnight, t],
  );

  const estudiosUpcoming = useMemo(
    () =>
      estudiosContacts
        .filter((c) => c.active)
        .flatMap((c) =>
          (c.sessions ?? [])
            .filter((s) => {
              if (!s.pending) return false;
              return new Date(s.date).getTime() >= todayMidnight.getTime();
            })
            .map((s) => {
              const d = new Date(s.date);
              const [hh, mm] = s.time.split(":").map(Number);
              d.setHours(hh, mm, 0, 0);
              return {
                id: s.id,
                date: d,
                category: "Estudio",
                label: `${getCategoryLabel("Estudio", t)} – ${c.name}`,
                contactName: c.name,
                contactId: c.id,
                sessionId: s.id,
              };
            }),
        ),
    [estudiosContacts, todayMidnight, t],
  );

  const allUpcoming = useMemo(
    () => [...calUpcoming, ...estudiosUpcoming].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [calUpcoming, estudiosUpcoming],
  );

  const nextDayGroups = useMemo(
    () =>
      allUpcoming.reduce<Array<{ key: string; label: string; events: typeof allUpcoming }>>((groups, item) => {
        const key = item.date.toDateString();
        const existing = groups.find((g) => g.key === key);
        const label = key === todayKey ? t("day_today") : formatDateLong(item.date, locale);
        if (existing) {
          existing.events.push(item);
        } else if (groups.length < 2) {
          groups.push({ key, label, events: [item] });
        }
        return groups;
      }, []),
    [allUpcoming, todayKey, t, locale],
  );

  const totalUpcoming = allUpcoming.length;
  const displayedUpcomingCount = nextDayGroups.reduce((count, g) => count + g.events.length, 0);
  const hasMore = totalUpcoming > displayedUpcomingCount;

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

      {/* Content card */}
      <div className="bg-background rounded-t-[32px] -mt-10 relative z-10 px-5 pt-5 pb-4">
        {/* Monthly hours card */}
        <button
          type="button"
          onClick={openMonthlyCalendar}
          className="w-full rounded-3xl border border-border bg-card shadow-xl p-5 mb-6 text-left transition-transform active:scale-[0.98]"
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {t("stats_month_total")}
          </p>
          <div className="flex items-end gap-1.5 mt-1.5">
            <span className="text-4xl font-black text-foreground leading-none">{monthTotalHrs}</span>
            <span className="text-xl font-bold text-muted-foreground mb-0.5">h</span>
            <span className="text-2xl font-black text-foreground leading-none ml-1">{monthTotalMins}</span>
            <span className="text-base font-bold text-muted-foreground mb-0.5">m</span>
          </div>
          {setup.precursorHours && (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-widest text-primary">
                  {t("stats_pioneer_goal")}
                </p>
                <p className="text-3xl font-black leading-none text-primary tabular-nums">{monthlyGoalPct}%</p>
              </div>
              <div className="mt-3 h-4 rounded-full bg-background/70 overflow-hidden ring-1 ring-primary/15">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${monthlyGoalPct}%`,
                    background:
                      "linear-gradient(90deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, white) 100%)",
                  }}
                />
              </div>
              <p className="mt-2 text-xs font-semibold text-foreground">
                {monthTotalHrs}h {monthTotalMins}m / {setup.precursorHours}h
              </p>
            </div>
          )}
        </button>

        {/* Upcoming activities */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">{t("home_upcoming_activities")}</h2>
          <button
            onClick={() => navigate("calendar")}
            className="text-xs text-primary font-semibold flex items-center gap-0.5"
          >
            {t("home_see_all")} <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {totalUpcoming === 0 ? (
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm font-semibold text-foreground">{t("home_no_upcoming_activities")}</p>
            {formatDayWeatherSummary(hourlyWeather, [], t) && (
              <p className="mt-1 text-xs text-muted-foreground">{formatDayWeatherSummary(hourlyWeather, [], t)}</p>
            )}
            <button
              onClick={() => navigate("calendar")}
              className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" /> {t("home_add_activity")}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {nextDayGroups.map((group, groupIdx) => (
              <div key={group.key} className="space-y-2">
                {groupIdx > 0 && <div className="border-t border-border/50 pt-2" />}
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group.label}</p>
                {group.events.map((item) => {
                  const style = getCategoryStyle(setup.categorySettings, item.category);
                  const meta = getCategoryMeta(setup.categorySettings, item.category);
                  const timeStr = `${String(item.date.getHours()).padStart(2, "0")}:${String(item.date.getMinutes()).padStart(2, "0")}`;
                  const forecast = formatActivityWeather(hourlyWeather, item.date, t);
                  const isStudy = Boolean(item.contactId && item.sessionId);
                  return (
                    <div
                      key={item.id}
                      className={`w-full flex items-center gap-2 rounded-2xl border pr-2 ${style.card}`}
                      style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
                    >
                      <button
                        onClick={() =>
                          isStudy
                            ? navigateToStudySession(item.contactId!, item.sessionId!)
                            : navigate("calendar")
                        }
                        className="flex-1 min-w-0 flex items-center gap-3 px-3 py-3 text-left active:scale-[0.98] transition-transform"
                      >
                        <CategoryIcon icon={meta.icon} className="text-xl leading-none flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{item.label}</p>
                          <p className="text-[11px] text-muted-foreground">{timeStr}</p>
                          {forecast && <p className="text-[10px] text-muted-foreground truncate">{forecast}</p>}
                        </div>
                      </button>
                      {isStudy ? (
                        <button
                          onClick={() => onCompleteStudyNow(item.contactId!, item.sessionId!)}
                          aria-label={t("study_mark_completed")}
                          title={t("study_mark_completed")}
                          className="w-10 h-10 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
                        >
                          <CheckCircle2 className="w-5 h-5" />
                        </button>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {hasMore && (
              <button
                onClick={() => navigate("calendar")}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-primary"
              >
                {t("home_see_more_calendar", { count: allUpcoming.length - displayedUpcomingCount })}{" "}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

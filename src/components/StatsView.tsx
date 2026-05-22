import { useMemo, useState } from "react";
import { CalendarEvent, EventCategory } from "@/hooks/useCalendarEvents";
import { TimeEntry } from "@/hooks/useTimeTracker";
import { CampaignGoal, monthKey } from "@/hooks/useSpecialCampaign";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { useMonthlyReportCarryover } from "@/hooks/useMonthlyReportCarryover";
import { CategoryConfig, getActiveCategoryConfigs, getCategoryLabel, getCategoryMeta, SUPPORT_CAP_HOURS } from "@/lib/categories";
import { applyMonthlySupportCap } from "@/lib/ldcCap";
import { calculateMonthlyReport } from "@/lib/monthlyReport";
import { msToLabel } from "@/lib/time";
import { localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { Pencil, Check, Send } from "lucide-react";

interface StatsViewProps {
  entries: TimeEntry[];
  allEntries: TimeEntry[];
  monthTotal: number;
  calendarEvents: CalendarEvent[];
  precursorHours?: number | null;
  specialCampaignGoals?: Record<string, CampaignGoal>;
  onSetSpecialCampaign?: (key: string, goal: CampaignGoal | null) => void;
  categoryConfigs: CategoryConfig[];
}

export function StatsView({
  entries,
  allEntries,
  monthTotal,
  calendarEvents,
  precursorHours,
  specialCampaignGoals,
  onSetSpecialCampaign,
  categoryConfigs,
}: StatsViewProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  const [mode, setMode] = useState<"mensual" | "anual">("mensual");
  const [editing, setEditing] = useState(false);
  const activeCategoryConfigs = useMemo(() => getActiveCategoryConfigs(categoryConfigs), [categoryConfigs]);
  const activeCategoryNames = useMemo(() => activeCategoryConfigs.map((category) => category.name), [activeCategoryConfigs]);
  const { excluded, toggle, isIncluded } = useCategoryFilter(activeCategoryNames);
  const { carryover, saveMonthlyReport } = useMonthlyReportCarryover();
  const now = new Date();
  const formatMonthYear = (date: Date) => date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  const formatShortMonth = (date: Date) => date.toLocaleDateString(locale, { month: "short" });

  // ── MENSUAL ──────────────────────────────────────────────────────────────
  const monthCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()
  );

  const { completedMsByCategory, completedCountByCategory } =
    monthCompletedEvents.reduce(
      (acc, e) => {
        if (!e.endTime) return acc;
        const [h, m] = e.endTime.split(":").map(Number);
        const end = new Date(e.date);
        end.setHours(h, m, 0, 0);
        const ms = Math.max(0, end.getTime() - e.date.getTime());
        acc.completedMs += ms;
        acc.completedMsByCategory[e.category] = (acc.completedMsByCategory[e.category] ?? 0) + ms;
        acc.completedCountByCategory[e.category] = (acc.completedCountByCategory[e.category] ?? 0) + 1;
        return acc;
      },
      { completedMs: 0, completedMsByCategory: {} as Record<string, number>, completedCountByCategory: {} as Record<string, number> }
    );

  const maxCompletedMs = Math.max(...Object.values(completedMsByCategory), 1);
  const includedCategories = activeCategoryNames.filter((c) => isIncluded(c as EventCategory));
  const monthlyCategoryTotals = includedCategories.map((cat) => ({
    cat,
    ms: completedMsByCategory[cat] ?? 0,
  }));
  const monthlyCappedCategoryTotals = applyMonthlySupportCap(monthlyCategoryTotals, activeCategoryConfigs);
  const monthlyFilteredMs = monthlyCappedCategoryTotals.reduce((sum, item) => sum + item.ms, 0);
  const monthlyRawFilteredMs = monthlyCategoryTotals.reduce((sum, item) => sum + item.ms, 0);
  const monthlySupportRawMs = monthlyCategoryTotals
    .filter((item) => activeCategoryConfigs.find((category) => category.name === item.cat)?.support)
    .reduce((sum, item) => sum + item.ms, 0);
  const monthlySupportCountedMs = monthlyCappedCategoryTotals
    .filter((item) => activeCategoryConfigs.find((category) => category.name === item.cat)?.support)
    .reduce((sum, item) => sum + item.ms, 0);
  const isMonthlySupportCapped = monthlySupportRawMs > monthlySupportCountedMs;
  const monthlyReport = calculateMonthlyReport(monthlyFilteredMs, now, carryover);


  // ── ANUAL (año sep–ago) ───────────────────────────────────────────────────
  const serviceYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const serviceYearFrom = new Date(serviceYearStart, 8, 1);
  const serviceYearTo   = new Date(serviceYearStart + 1, 8, 1);
  const serviceYearLabel = `${formatShortMonth(new Date(serviceYearStart, 8, 1))} ${serviceYearStart} - ${formatShortMonth(new Date(serviceYearStart + 1, 7, 1))} ${serviceYearStart + 1}`;

  const serviceYearMonths = Array.from({ length: 12 }, (_, i) => {
    const calMonth = (8 + i) % 12;
    const calYear  = calMonth >= 8 ? serviceYearStart : serviceYearStart + 1;
    return { month: calMonth, year: calYear, isCurrentMonth: calMonth === now.getMonth() && calYear === now.getFullYear() };
  });

  const yearCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date >= serviceYearFrom && e.date < serviceYearTo
  );

  const yearlyCategoryTotals = includedCategories.map((cat) => ({ cat, ms: 0 }));
  const monthBars = serviceYearMonths.map(({ month, year, isCurrentMonth }) => {
    const monthEvents = yearCompletedEvents.filter(
      (event) => event.date.getMonth() === month && event.date.getFullYear() === year
    );
    const monthMsByCategory = monthEvents.reduce<Record<string, number>>((acc, event) => {
      if (!event.endTime) return acc;
      const [h, m] = event.endTime.split(":").map(Number);
      const end = new Date(event.date);
      end.setHours(h, m, 0, 0);
      acc[event.category] = (acc[event.category] ?? 0) + Math.max(0, end.getTime() - event.date.getTime());
      return acc;
    }, {});
    const monthTotals = includedCategories.map((cat) => ({
      cat,
      ms: monthMsByCategory[cat] ?? 0,
    }));
    const cappedMonthTotals = applyMonthlySupportCap(monthTotals, activeCategoryConfigs);
    cappedMonthTotals.forEach((item) => {
      const categoryTotal = yearlyCategoryTotals.find((total) => total.cat === item.cat);
      if (categoryTotal) categoryTotal.ms += item.ms;
    });
    return {
      month,
      year,
      isCurrentMonth,
      ms: cappedMonthTotals.reduce((sum, item) => sum + item.ms, 0),
    };
  });
  const maxMonthMs = Math.max(...monthBars.map((b) => b.ms), 1);
  const yearMsByCategory = yearlyCategoryTotals.reduce<Record<string, number>>((acc, item) => {
    acc[item.cat] = item.ms;
    return acc;
  }, {});
  const maxYearCatMs = Math.max(...activeCategoryNames.map((c) => yearMsByCategory[c] ?? 0), 1);
  const yearFilteredMs = yearlyCategoryTotals.reduce((sum, item) => sum + item.ms, 0);

  return (
    <div className="px-5 pt-4 space-y-4 pb-24">

      {/* Mode switcher */}
      <div className="flex rounded-2xl bg-muted p-1 gap-1 mt-2">
        {(["mensual", "anual"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {m === "mensual" ? t("stats_monthly") : t("stats_yearly")}
          </button>
        ))}
      </div>

      {/* ── MENSUAL ── */}
      {mode === "mensual" && (
        <>

          {/* Campaign special toggle (only when not a precursor) */}
          {precursorHours === null && (() => {
            const currentKey = monthKey(now);
            const campaignGoal = specialCampaignGoals?.[currentKey] ?? null;
            const goalMs = campaignGoal ? campaignGoal * 3_600_000 : 0;
            const pct = campaignGoal ? Math.min(100, Math.round((monthlyFilteredMs / goalMs) * 100)) : 0;
            return (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">⚡</span>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">{t("stats_special_campaign")}</p>
                </div>
                <div className="flex gap-2 mb-3">
                  {([null, 15, 30] as const).map((opt) => (
                    <button
                      key={String(opt)}
                      onClick={() => onSetSpecialCampaign?.(currentKey, opt as CampaignGoal | null)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        campaignGoal === opt
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-transparent hover:border-amber-400"
                      }`}
                    >
                      {opt === null ? t("common_no") : `${opt}h`}
                    </button>
                  ))}
                </div>
                {campaignGoal && (
                  <>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-amber-700/70 dark:text-amber-400/70">
                      {t("stats_of_goal", { value: msToLabel(monthlyFilteredMs), goal: `${campaignGoal}h` })}
                    </p>
                  </>
                )}
              </div>
            );
          })()}


          {/* Resumen total mes (filtered) */}
          {(() => {
            const hasExclusions = excluded.size > 0;
            const goalMs = precursorHours != null ? precursorHours * 3_600_000 : 0;
            const goalPct = goalMs > 0 ? Math.min(100, Math.round((monthlyFilteredMs / goalMs) * 100)) : 0;
            const goalRemaining = goalMs > 0 ? Math.max(0, goalMs - monthlyFilteredMs) : 0;
            const goalDone = goalMs > 0 && monthlyFilteredMs >= goalMs;
            return (
              <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                      {formatMonthYear(now)}
                      {hasExclusions && <span className="ml-1 text-primary/70">· {t("stats_filtered")}</span>}
                    </p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {monthlyFilteredMs > 0 ? msToLabel(monthlyFilteredMs) : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("stats_registered_hours")}</p>
                    {isMonthlySupportCapped && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("stats_support_cap_notice", {
                          counted: msToLabel(monthlySupportCountedMs),
                          real: msToLabel(monthlySupportRawMs),
                          cap: SUPPORT_CAP_HOURS,
                          total: msToLabel(monthlyRawFilteredMs),
                        })}
                      </p>
                    )}
                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                      <p>
                        {t("stats_report_to_send")}: <span className="font-semibold text-foreground tabular-nums">{monthlyReport.reportedHours}h</span>
                      </p>
                      {(monthlyReport.carriedInMinutes > 0 || monthlyReport.carriedOutMinutes > 0) && (
                        <p>
                          {t("stats_carryover", { in: monthlyReport.carriedInMinutes, out: monthlyReport.carriedOutMinutes })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl">📋</div>
                </div>
                {precursorHours != null && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-xs font-semibold ${goalDone ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                        {t("stats_pioneer_goal")} · {precursorHours}h/{t("stats_month_unit")}
                      </p>
                      <span className={`text-xs font-bold ${goalDone ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                        {goalDone ? t("stats_completed") : t("stats_remaining", { value: msToLabel(goalRemaining) })}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${goalDone ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${goalPct}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1.5 ${goalDone ? "text-green-600/70 dark:text-green-400/70" : "text-blue-600/70 dark:text-blue-400/70"}`}>
                      {t("stats_of_goal", { value: msToLabel(monthlyFilteredMs), goal: `${precursorHours}h` })}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Por categoría mensual con edición */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">{t("stats_by_activity")}</h3>
              <button
                onClick={() => setEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                  editing
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {editing ? t("stats_done") : t("set_edit")}
              </button>
            </div>
            <div className="space-y-3">
              {activeCategoryNames.map((cat) => {
                const rawMs = completedMsByCategory[cat] ?? 0;
                const cappedMs = monthlyCappedCategoryTotals.find((item) => item.cat === cat)?.ms ?? 0;
                const isSupport = activeCategoryConfigs.find((category) => category.name === cat)?.support ?? false;
                const ms = isSupport ? cappedMs : rawMs;
                const m = getCategoryMeta(categoryConfigs, cat);
                const included = isIncluded(cat as EventCategory);
                const pct = ms > 0 ? Math.round((ms / maxCompletedMs) * 100) : 0;
                return (
                  <div
                    key={cat}
                    className={`flex items-center gap-3 transition-opacity ${!included && !editing ? "opacity-40" : ""}`}
                  >
                    {editing && (
                      <button
                        onClick={() => toggle(cat as EventCategory)}
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          included
                            ? "bg-primary border-primary"
                            : "bg-transparent border-muted-foreground/40"
                        }`}
                      >
                        {included && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                    )}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}
                    >
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <p className="text-[13px] font-semibold text-foreground">{getCategoryLabel(cat, t)}</p>
                        {isSupport && rawMs > ms && (
                          <p className="text-[11px] text-muted-foreground">{t("stats_real_hours", { value: msToLabel(rawMs) })}</p>
                        )}
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        {ms > 0 && (
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-16 text-right">
                      {ms > 0 ? msToLabel(ms) : "–"}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-[13px] font-bold text-foreground">{t("stats_selected_total")}</span>
                <span className="text-[13px] font-bold text-foreground tabular-nums">
                  {monthlyFilteredMs > 0 ? msToLabel(monthlyFilteredMs) : "0m"}
                </span>
              </div>
            </div>
          </div>

          {/* Enviar Informe mensual */}
          {(() => {
            const estudiosCount = completedCountByCategory["Estudio"] ?? 0;
            const monthLabel = formatMonthYear(now);
            const msg = [
              `📊 ${t("stats_report")} ${monthLabel}`,
              `⏱️ ${t("stats_hours")}: ${monthlyReport.reportedHours}h`,
              `📖 ${t("stats_studies")}: ${estudiosCount}`,
            ].join("\n");
            return (
              <button
                onClick={() => {
                  saveMonthlyReport(monthlyReport);
                  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
                }}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                {t("stats_send_report")}
              </button>
            );
          })()}
        </>
      )}

      {/* ── ANUAL ── */}
      {mode === "anual" && (
        <>


          {/* Resumen total año (filtered) */}
          {(() => {
            const hasExclusions = excluded.size > 0;
            const annualGoalMs = precursorHours === 50 ? 600 * 3_600_000 : 0;
            const annualGoalPct = annualGoalMs > 0 ? Math.min(100, Math.round((yearFilteredMs / annualGoalMs) * 100)) : 0;
            const annualGoalRemaining = annualGoalMs > 0 ? Math.max(0, annualGoalMs - yearFilteredMs) : 0;
            const annualGoalDone = annualGoalMs > 0 && yearFilteredMs >= annualGoalMs;
            return (
              <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {t("stats_total")} {serviceYearLabel}
                      {hasExclusions && <span className="ml-1 text-primary/70">· {t("stats_filtered")}</span>}
                    </p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {yearFilteredMs > 0 ? msToLabel(yearFilteredMs) : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t("stats_registered_hours")}</p>
                  </div>
                  <div className="text-3xl">📅</div>
                </div>
                {precursorHours === 50 && (
                  <div className="mt-4 border-t border-border pt-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className={`text-xs font-semibold ${annualGoalDone ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                        {t("stats_annual_pioneer_goal")} · 600h
                      </p>
                      <span className={`text-xs font-bold ${annualGoalDone ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                        {annualGoalDone ? t("stats_completed") : t("stats_remaining", { value: msToLabel(annualGoalRemaining) })}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${annualGoalDone ? "bg-green-500" : "bg-blue-500"}`}
                        style={{ width: `${annualGoalPct}%` }}
                      />
                    </div>
                    <p className={`text-xs mt-1.5 ${annualGoalDone ? "text-green-600/70 dark:text-green-400/70" : "text-blue-600/70 dark:text-blue-400/70"}`}>
                      {t("stats_of_goal", { value: msToLabel(yearFilteredMs), goal: "600h" })} · {serviceYearLabel}
                    </p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Barras por mes */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4 overflow-hidden">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-foreground">{t("stats_by_month")}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{serviceYearLabel}</p>
              </div>
              <div className="rounded-xl bg-primary/10 px-3 py-1.5 text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{t("stats_total")}</p>
                <p className="text-sm font-black tabular-nums text-primary">{yearFilteredMs > 0 ? msToLabel(yearFilteredMs) : "0m"}</p>
              </div>
            </div>
            <div className="relative h-44">
              <div className="absolute inset-x-0 top-0 h-px bg-border/60" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-border/40" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-border/40" />
              <div className="absolute inset-x-0 bottom-8 h-px bg-border" />
              <div className="relative z-10 flex h-full items-end gap-1.5">
              {monthBars.map(({ month, year, ms, isCurrentMonth }) => {
                const barH = ms > 0 ? Math.max(10, (ms / maxMonthMs) * 118) : 5;
                const label = ms > 0 ? msToLabel(ms) : "";
                return (
                  <div key={month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    {ms > 0 && (
                      <span className={`max-w-full truncate text-[9px] font-bold tabular-nums ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                        {label}
                      </span>
                    )}
                    <div
                      className={`w-full max-w-5 rounded-t-lg transition-all ${isCurrentMonth ? "shadow-sm shadow-primary/20" : ""}`}
                      style={{
                        height: barH,
                        background: ms > 0
                          ? isCurrentMonth
                            ? "linear-gradient(180deg, #22c55e, #0ea5e9)"
                            : "linear-gradient(180deg, rgba(34,197,94,0.58), rgba(14,165,233,0.42))"
                          : undefined,
                        backgroundColor: ms === 0 ? "hsl(var(--muted))" : undefined,
                        opacity: ms === 0 ? 0.35 : 1,
                      }}
                      title={`${formatShortMonth(new Date(year, month, 1))}: ${msToLabel(ms)}`}
                    />
                    <span className={`text-[8px] font-semibold ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                      {formatShortMonth(new Date(year, month, 1))}
                    </span>
                  </div>
                );
              })}
              </div>
            </div>
          </div>

          {/* Por categoría anual con edición */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">{t("stats_by_activity")}</h3>
              <button
                onClick={() => setEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                  editing
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {editing ? t("stats_done") : t("set_edit")}
              </button>
            </div>
            <div className="space-y-3">
              {activeCategoryNames.map((cat) => {
                const ms = yearMsByCategory[cat] ?? 0;
                const m = getCategoryMeta(categoryConfigs, cat);
                const included = isIncluded(cat as EventCategory);
                const pct = ms > 0 ? Math.round((ms / maxYearCatMs) * 100) : 0;
                return (
                  <div
                    key={cat}
                    className={`flex items-center gap-3 transition-opacity ${!included && !editing ? "opacity-40" : ""}`}
                  >
                    {editing && (
                      <button
                        onClick={() => toggle(cat as EventCategory)}
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                          included
                            ? "bg-primary border-primary"
                            : "bg-transparent border-muted-foreground/40"
                        }`}
                      >
                        {included && <Check className="w-3 h-3 text-primary-foreground" />}
                      </button>
                    )}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}
                    >
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between mb-1.5">
                        <p className="text-[13px] font-semibold text-foreground">{getCategoryLabel(cat, t)}</p>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        {ms > 0 && (
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})` }}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-12 text-right">
                      {ms > 0 ? msToLabel(ms) : "–"}
                    </span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between border-t border-border pt-3">
                <span className="text-[13px] font-bold text-foreground">{t("stats_selected_total")}</span>
                <span className="text-[13px] font-bold text-foreground tabular-nums">
                  {yearFilteredMs > 0 ? msToLabel(yearFilteredMs) : "0m"}
                </span>
              </div>
            </div>
          </div>

        </>
      )}
    </div>
  );
}

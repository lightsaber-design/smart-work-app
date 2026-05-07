import { useState } from "react";
import { CalendarEvent, EventCategory } from "@/hooks/useCalendarEvents";
import { TimeEntry } from "@/hooks/useTimeTracker";
import { CampaignGoal, monthKey } from "@/hooks/useSpecialCampaign";
import { useCategoryFilter } from "@/hooks/useCategoryFilter";
import { CATEGORY_LIST, CATEGORY_META } from "@/lib/categories";
import { msToLabel } from "@/lib/time";
import { useT } from "@/lib/LanguageContext";
import { CheckCircle2, Pencil, Check, Send } from "lucide-react";

interface StatsViewProps {
  entries: TimeEntry[];
  allEntries: TimeEntry[];
  monthTotal: number;
  calendarEvents: CalendarEvent[];
  precursorHours?: number | null;
  specialCampaignGoals?: Record<string, CampaignGoal>;
  onSetSpecialCampaign?: (key: string, goal: CampaignGoal | null) => void;
}

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];


export function StatsView({
  entries,
  allEntries,
  monthTotal,
  calendarEvents,
  precursorHours,
  specialCampaignGoals,
  onSetSpecialCampaign,
}: StatsViewProps) {
  const t = useT();
  const [mode, setMode] = useState<"mensual" | "anual">("mensual");
  const [editing, setEditing] = useState(false);
  const { excluded, toggle, isIncluded } = useCategoryFilter();
  const now = new Date();

  // ── MENSUAL ──────────────────────────────────────────────────────────────
  const monthCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()
  );

  const { completedMs: totalCompletedMs, completedMsByCategory, completedCountByCategory } =
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


  // ── ANUAL (año sep–ago) ───────────────────────────────────────────────────
  const serviceYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const serviceYearFrom = new Date(serviceYearStart, 8, 1);
  const serviceYearTo   = new Date(serviceYearStart + 1, 8, 1);
  const serviceYearLabel = `Sep ${serviceYearStart} – Ago ${serviceYearStart + 1}`;

  const yearEntries = allEntries.filter(
    (e) => e.startTime >= serviceYearFrom && e.startTime < serviceYearTo
  );

  const yearTotalMs = yearEntries.reduce(
    (acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0
  );

  const monthBars = Array.from({ length: 12 }, (_, i) => {
    const calMonth = (8 + i) % 12;
    const calYear  = calMonth >= 8 ? serviceYearStart : serviceYearStart + 1;
    const isCurrentMonth = calMonth === now.getMonth() && calYear === now.getFullYear();
    const ms = yearEntries
      .filter((e) => e.startTime.getMonth() === calMonth && e.startTime.getFullYear() === calYear)
      .reduce((acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);
    return { month: calMonth, ms, isCurrentMonth };
  });
  const maxMonthMs = Math.max(...monthBars.map((b) => b.ms), 1);

  const yearCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date >= serviceYearFrom && e.date < serviceYearTo
  );

  const { yearMsByCategory, yearCountByCategory } = yearCompletedEvents.reduce(
    (acc, e) => {
      if (!e.endTime) return acc;
      const [h, m] = e.endTime.split(":").map(Number);
      const end = new Date(e.date);
      end.setHours(h, m, 0, 0);
      const ms = Math.max(0, end.getTime() - e.date.getTime());
      acc.yearMsByCategory[e.category] = (acc.yearMsByCategory[e.category] ?? 0) + ms;
      acc.yearCountByCategory[e.category] = (acc.yearCountByCategory[e.category] ?? 0) + 1;
      return acc;
    },
    { yearMsByCategory: {} as Record<string, number>, yearCountByCategory: {} as Record<string, number> }
  );
  const maxYearCatMs = Math.max(...CATEGORY_LIST.map((c) => yearMsByCategory[c] ?? 0), 1);

  return (
    <div className="px-4 space-y-4 pb-24">

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
            {m === "mensual" ? "Mensual" : "Anual"}
          </button>
        ))}
      </div>

      {/* ── MENSUAL ── */}
      {mode === "mensual" && (
        <>
          {/* Precursor progress banner */}
          {precursorHours != null && (() => {
            const goalMs = precursorHours * 3_600_000;
            const pct = Math.min(100, Math.round((monthTotal / goalMs) * 100));
            const remaining = Math.max(0, goalMs - monthTotal);
            const done = monthTotal >= goalMs;
            return (
              <div className={`rounded-2xl px-5 py-4 border ${done ? "bg-green-500/10 border-green-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-semibold ${done ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                    ⭐ Meta precursor · {precursorHours}h/mes
                  </p>
                  <span className={`text-xs font-bold ${done ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                    {done ? "✓ Completado" : `Faltan ${msToLabel(remaining)}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-xs mt-1.5 ${done ? "text-green-600/70 dark:text-green-400/70" : "text-blue-600/70 dark:text-blue-400/70"}`}>
                  {msToLabel(monthTotal)} de {precursorHours}h
                </p>
              </div>
            );
          })()}

          {/* Campaign special toggle (only when not a precursor) */}
          {precursorHours === null && (() => {
            const currentKey = monthKey(now);
            const campaignGoal = specialCampaignGoals?.[currentKey] ?? null;
            const goalMs = campaignGoal ? campaignGoal * 3_600_000 : 0;
            const pct = campaignGoal ? Math.min(100, Math.round((monthTotal / goalMs) * 100)) : 0;
            return (
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm">⚡</span>
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Campaña especial</p>
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
                      {opt === null ? "No" : `${opt}h`}
                    </button>
                  ))}
                </div>
                {campaignGoal && (
                  <>
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden mb-1.5">
                      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-xs text-amber-700/70 dark:text-amber-400/70">{msToLabel(monthTotal)} de {campaignGoal}h</p>
                  </>
                )}
              </div>
            );
          })()}

          {/* Quick stats */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #4ade8030, #34d39930)" }}>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-black tabular-nums text-foreground leading-none">{monthCompletedEvents.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Eventos completados este mes</p>
            </div>
          </div>

          {/* Resumen total mes (filtered) */}
          {(() => {
            const filteredMs = CATEGORY_LIST
              .filter((c) => isIncluded(c as EventCategory))
              .reduce((sum, c) => sum + (completedMsByCategory[c] ?? 0), 0);
            const hasExclusions = excluded.size > 0;
            return (
              <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                    {now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
                    {hasExclusions && <span className="ml-1 text-primary/70">· filtrado</span>}
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {filteredMs > 0 ? msToLabel(filteredMs) : "–"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">tiempo en eventos</p>
                </div>
                <div className="text-3xl">📋</div>
              </div>
            );
          })()}

          {/* Por categoría mensual con edición */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Por actividad</h3>
              <button
                onClick={() => setEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                  editing
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {editing ? "Listo" : "Editar"}
              </button>
            </div>
            <div className="space-y-3">
              {CATEGORY_LIST.map((cat) => {
                const ms = completedMsByCategory[cat] ?? 0;
                const count = completedCountByCategory[cat] ?? 0;
                const m = CATEGORY_META[cat];
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
                        <p className="text-[13px] font-semibold text-foreground">{cat}</p>
                        {ms > 0 && <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? t("stats_event") : t("stats_events")}</p>}
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
            </div>
          </div>

          {/* Enviar Informe mensual */}
          {(() => {
            const filteredMs = CATEGORY_LIST
              .filter((c) => isIncluded(c as EventCategory))
              .reduce((sum, c) => sum + (completedMsByCategory[c] ?? 0), 0);
            const estudiosCount = completedCountByCategory["Estudio"] ?? 0;
            const monthLabel = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
            const msg = `📊 Informe ${monthLabel}\n⏱️ Horas: ${filteredMs > 0 ? msToLabel(filteredMs) : "0m"}\n📖 Estudios: ${estudiosCount}`;
            return (
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                Enviar Informe
              </button>
            );
          })()}
        </>
      )}

      {/* ── ANUAL ── */}
      {mode === "anual" && (
        <>
          {/* Annual precursor goal (50h only) */}
          {precursorHours === 50 && (() => {
            const annualGoalMs = 600 * 3_600_000;
            const pct = Math.min(100, Math.round((yearTotalMs / annualGoalMs) * 100));
            const remaining = Math.max(0, annualGoalMs - yearTotalMs);
            const done = yearTotalMs >= annualGoalMs;
            return (
              <div className={`rounded-2xl px-5 py-4 border ${done ? "bg-green-500/10 border-green-500/20" : "bg-blue-500/10 border-blue-500/20"}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className={`text-xs font-semibold ${done ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                    ⭐ Meta anual precursor · 600h
                  </p>
                  <span className={`text-xs font-bold ${done ? "text-green-600 dark:text-green-400" : "text-blue-600 dark:text-blue-400"}`}>
                    {done ? "✓ Completado" : `Faltan ${msToLabel(remaining)}`}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${done ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className={`text-xs mt-1.5 ${done ? "text-green-600/70 dark:text-green-400/70" : "text-blue-600/70 dark:text-blue-400/70"}`}>
                  {msToLabel(yearTotalMs)} de 600h · {serviceYearLabel}
                </p>
              </div>
            );
          })()}

          {/* Quick stats */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #4ade8030, #34d39930)" }}>
              <CheckCircle2 className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-black tabular-nums text-foreground leading-none">{yearCompletedEvents.length}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Eventos completados este año</p>
            </div>
          </div>

          {/* Resumen total año (filtered) */}
          {(() => {
            const yearFilteredMs = CATEGORY_LIST
              .filter((c) => isIncluded(c as EventCategory))
              .reduce((sum, c) => sum + (yearMsByCategory[c] ?? 0), 0);
            const hasExclusions = excluded.size > 0;
            return (
              <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">
                    Total {serviceYearLabel}
                    {hasExclusions && <span className="ml-1 text-primary/70">· filtrado</span>}
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">
                    {yearFilteredMs > 0 ? msToLabel(yearFilteredMs) : "–"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{yearCompletedEvents.length} eventos completados</p>
                </div>
                <div className="text-3xl">📅</div>
              </div>
            );
          })()}

          {/* Barras por mes */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Por mes</h3>
            <div className="flex items-end gap-1.5 h-32">
              {monthBars.map(({ month, ms, isCurrentMonth }) => {
                const barH = ms > 0 ? Math.max(8, (ms / maxMonthMs) * 96) : 4;
                const hrs = Math.floor(ms / 3_600_000);
                return (
                  <div key={month} className="flex-1 flex flex-col items-center gap-1">
                    {ms > 0 && (
                      <span className={`text-[8px] font-bold tabular-nums ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                        {hrs > 0 ? `${hrs}h` : ""}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-lg transition-all"
                      style={{
                        height: barH,
                        background: ms > 0
                          ? isCurrentMonth
                            ? "linear-gradient(180deg, #818cf8, #60a5fa)"
                            : "linear-gradient(180deg, #818cf840, #60a5fa40)"
                          : undefined,
                        backgroundColor: ms === 0 ? "hsl(var(--muted))" : undefined,
                        opacity: ms === 0 ? 0.35 : 1,
                      }}
                      title={`${MONTH_NAMES[month]}: ${hrs}h`}
                    />
                    <span className={`text-[8px] font-semibold ${isCurrentMonth ? "text-primary" : "text-muted-foreground"}`}>
                      {MONTH_NAMES[month]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Por categoría anual con edición */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Por actividad</h3>
              <button
                onClick={() => setEditing((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors border ${
                  editing
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                }`}
              >
                {editing ? <Check className="w-3 h-3" /> : <Pencil className="w-3 h-3" />}
                {editing ? "Listo" : "Editar"}
              </button>
            </div>
            <div className="space-y-3">
              {CATEGORY_LIST.map((cat) => {
                const ms = yearMsByCategory[cat] ?? 0;
                const count = yearCountByCategory[cat] ?? 0;
                const m = CATEGORY_META[cat];
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
                        <p className="text-[13px] font-semibold text-foreground">{cat}</p>
                        {ms > 0 && <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? t("stats_event") : t("stats_events")}</p>}
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
            </div>
          </div>

          {/* Enviar Informe anual */}
          {(() => {
            const yearFilteredMs = CATEGORY_LIST
              .filter((c) => isIncluded(c as EventCategory))
              .reduce((sum, c) => sum + (yearMsByCategory[c] ?? 0), 0);
            const estudiosCount = yearCountByCategory["Estudio"] ?? 0;
            const msg = `📊 Informe Anual ${serviceYearLabel}\n⏱️ Horas: ${yearFilteredMs > 0 ? msToLabel(yearFilteredMs) : "0m"}\n📖 Estudios: ${estudiosCount}`;
            return (
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-semibold text-sm transition-colors shadow-sm"
              >
                <Send className="w-4 h-4" />
                Enviar Informe
              </button>
            );
          })()}
        </>
      )}
    </div>
  );
}

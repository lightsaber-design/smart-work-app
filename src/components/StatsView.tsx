import { useState } from "react";
import { CalendarEvent, EventCategory } from "@/hooks/useCalendarEvents";
import { TimeEntry } from "@/hooks/useTimeTracker";
import { useT } from "@/lib/LanguageContext";
import { Flame, CalendarDays, CheckCircle2 } from "lucide-react";

interface StatsViewProps {
  entries: TimeEntry[];
  allEntries: TimeEntry[];
  monthTotal: number;
  calendarEvents: CalendarEvent[];
}

const CATEGORY_META: Record<EventCategory, { icon: string; gradient: [string, string] }> = {
  Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"] },
  Carrito: { icon: "🛒", gradient: ["#4ade80", "#34d399"] },
  LDC:     { icon: "📖", gradient: ["#c084fc", "#818cf8"] },
  Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"] },
  Estudio: { icon: "📚", gradient: ["#f472b6", "#e879f9"] },
};

const CATEGORY_ORDER: EventCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];
const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function msToLabel(ms: number): string {
  const hrs = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}m`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}m`;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function computeStreak(entries: TimeEntry[]): number {
  const days = new Set(entries.filter((e) => e.endTime).map((e) => dateKey(e.startTime)));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (days.has(dateKey(d))) streak++;
    else if (i > 0) break;
  }
  return streak;
}

export function StatsView({ entries, allEntries, monthTotal, calendarEvents }: StatsViewProps) {
  const t = useT();
  const [mode, setMode] = useState<"mensual" | "anual">("mensual");
  const now = new Date();

  // ── MENSUAL ──────────────────────────────────────────────────────────────
  const monthCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date.getMonth() === now.getMonth() && e.date.getFullYear() === now.getFullYear()
  );

  const completedHoursByCategory = monthCompletedEvents.reduce<Record<string, number>>((acc, e) => {
    if (!e.endTime) return acc;
    const [h, m] = e.endTime.split(":").map(Number);
    const end = new Date(e.date); end.setHours(h, m, 0, 0);
    acc[e.category] = (acc[e.category] || 0) + Math.max(0, end.getTime() - e.date.getTime());
    return acc;
  }, {});

  const completedCountByCategory = monthCompletedEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const totalCompletedMs = Object.values(completedHoursByCategory).reduce((a, b) => a + b, 0);
  const maxCompletedMs = Math.max(...Object.values(completedHoursByCategory), 1);

  // Active days this month (from tracker entries)
  const monthEntries = allEntries.filter(
    (e) => e.startTime.getFullYear() === now.getFullYear() && e.startTime.getMonth() === now.getMonth()
  );
  const activeDaysMonth = new Set(monthEntries.filter((e) => e.endTime).map((e) => dateKey(e.startTime))).size;

  // Streak
  const streak = computeStreak(allEntries);

  // ── ANUAL (año sep–ago) ───────────────────────────────────────────────────
  const serviceYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const serviceYearFrom = new Date(serviceYearStart, 8, 1);
  const serviceYearTo   = new Date(serviceYearStart + 1, 8, 1);
  const serviceYearLabel = `Sep ${serviceYearStart} – Ago ${serviceYearStart + 1}`;

  const yearEntries = allEntries.filter(
    (e) => e.startTime >= serviceYearFrom && e.startTime < serviceYearTo
  );

  const yearTotalMs = yearEntries.reduce((acc, e) =>
    acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0);

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

  const yearCatRows = CATEGORY_ORDER.map((cat) => ({
    cat,
    ms: yearEntries
      .filter((e) => e.category === cat)
      .reduce((acc, e) => acc + Math.max(0, (e.endTime ?? new Date()).getTime() - e.startTime.getTime()), 0),
  })).filter((r) => r.ms > 0);
  const maxYearCatMs = Math.max(...yearCatRows.map((r) => r.ms), 1);

  const yearCompletedEvents = calendarEvents.filter(
    (e) => e.completed && e.date >= serviceYearFrom && e.date < serviceYearTo
  );
  const yearCompletedCount = yearCompletedEvents.length;
  const activeDaysYear = new Set(yearEntries.filter((e) => e.endTime).map((e) => dateKey(e.startTime))).size;

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
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #60a5fa30, #818cf830)" }}>
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{activeDaysMonth}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Días<br/>activos</p>
            </div>
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fb923c30, #f59e0b30)" }}>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{streak}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Racha<br/>actual</p>
            </div>
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4ade8030, #34d39930)" }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{monthCompletedEvents.length}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Eventos<br/>completados</p>
            </div>
          </div>

          {/* Resumen total mes */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5 capitalize">
                {now.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                {totalCompletedMs > 0 ? msToLabel(totalCompletedMs) : "–"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">tiempo en eventos</p>
            </div>
            <div className="text-3xl">📋</div>
          </div>

          {/* Por categoría mensual */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Por actividad</h3>
            {CATEGORY_ORDER.every((c) => !completedHoursByCategory[c]) ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin actividad completada este mes</p>
            ) : (
              <div className="space-y-4">
                {CATEGORY_ORDER.filter((c) => completedHoursByCategory[c] > 0).map((cat) => {
                  const ms = completedHoursByCategory[cat] || 0;
                  const count = completedCountByCategory[cat] || 0;
                  const m = CATEGORY_META[cat];
                  const pct = Math.round((ms / maxCompletedMs) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}
                      >
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-1.5">
                          <p className="text-[13px] font-semibold text-foreground">{cat}</p>
                          <p className="text-[11px] text-muted-foreground">{count} {count === 1 ? t("stats_event") : t("stats_events")}</p>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-12 text-right">{msToLabel(ms)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ANUAL ── */}
      {mode === "anual" && (
        <>
          {/* Quick stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #60a5fa30, #818cf830)" }}>
                <CalendarDays className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{activeDaysYear}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Días<br/>activos</p>
            </div>
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #fb923c30, #f59e0b30)" }}>
                <Flame className="w-4 h-4 text-orange-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{streak}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Racha<br/>actual</p>
            </div>
            <div className="rounded-2xl bg-card border border-border shadow-sm px-3 py-3 flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4ade8030, #34d39930)" }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-xl font-black tabular-nums text-foreground">{yearCompletedCount}</p>
              <p className="text-[10px] text-muted-foreground text-center leading-tight">Eventos<br/>completados</p>
            </div>
          </div>

          {/* Resumen total año */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Total {serviceYearLabel}</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">{yearTotalMs > 0 ? msToLabel(yearTotalMs) : "–"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{yearCompletedCount} eventos completados</p>
            </div>
            <div className="text-3xl">📅</div>
          </div>

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

          {/* Por categoría anual */}
          <div className="rounded-2xl bg-card border border-border shadow-sm px-5 py-4">
            <h3 className="text-sm font-bold text-foreground mb-4">Por actividad</h3>
            {yearCatRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin actividad este año</p>
            ) : (
              <div className="space-y-4">
                {yearCatRows.map(({ cat, ms }) => {
                  const m = CATEGORY_META[cat];
                  const pct = Math.round((ms / maxYearCatMs) * 100);
                  return (
                    <div key={cat} className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${m.gradient[0]}30, ${m.gradient[1]}30)` }}
                      >
                        {m.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-foreground mb-1.5">{cat}</p>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${m.gradient[0]}, ${m.gradient[1]})`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-[13px] font-bold text-foreground flex-shrink-0 w-12 text-right">{msToLabel(ms)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

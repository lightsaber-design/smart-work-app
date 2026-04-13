import { TimeEntry, formatDuration } from "@/hooks/useTimeTracker";

interface StatsViewProps {
  entries: TimeEntry[];
  monthTotal: number;
}

export function StatsView({ entries, monthTotal }: StatsViewProps) {
  // Group by day
  const byDay = entries.reduce<Record<string, number>>((acc, e) => {
    const key = e.startTime.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" });
    const duration = e.endTime
      ? e.endTime.getTime() - e.startTime.getTime()
      : Date.now() - e.startTime.getTime();
    acc[key] = (acc[key] || 0) + duration;
    return acc;
  }, {});

  const maxMs = Math.max(...Object.values(byDay), 1);

  return (
    <div className="px-4 space-y-6 pb-24">
      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
          Total mensual
        </h3>
        <p className="text-3xl font-bold text-foreground">{formatDuration(monthTotal)}</p>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Últimos días
        </h3>
        {Object.keys(byDay).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin datos aún</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byDay).map(([day, ms]) => (
              <div key={day} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium capitalize">{day}</span>
                  <span className="text-muted-foreground tabular-nums">{formatDuration(ms).slice(0, 5)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${(ms / maxMs) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

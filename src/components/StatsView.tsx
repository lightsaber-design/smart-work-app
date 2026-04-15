import { CalendarEvent, EventCategory } from "@/hooks/useCalendarEvents";
import { TimeEntry, formatDuration } from "@/hooks/useTimeTracker";

interface StatsViewProps {
  entries: TimeEntry[];
  monthTotal: number;
  calendarEvents: CalendarEvent[];
}

const categoryColors: Record<EventCategory, string> = {
  Predi: "bg-blue-500",
  Carrito: "bg-green-500",
  LDC: "bg-purple-500",
  Visitas: "bg-orange-500",
  Estudio: "bg-pink-500",
};

export function StatsView({ entries, monthTotal, calendarEvents }: StatsViewProps) {
  // Filter calendar events for current month
  const now = new Date();
  const monthEvents = calendarEvents.filter(
    (e) =>
      e.date.getMonth() === now.getMonth() &&
      e.date.getFullYear() === now.getFullYear()
  );

  // Count events by category
  const byCategory = monthEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const maxCount = Math.max(...Object.values(byCategory), 1);
  const totalEvents = monthEvents.length;

  return (
    <div className="px-4 space-y-6 pb-24">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Horas del mes
          </h3>
          <p className="text-3xl font-bold text-foreground">{formatDuration(monthTotal)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Eventos del mes
          </h3>
          <p className="text-3xl font-bold text-foreground">{totalEvents}</p>
        </div>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Por categoría
        </h3>
        {Object.keys(byCategory).length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos este mes</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(byCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([category, count]) => (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{category}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {count} {count === 1 ? "evento" : "eventos"}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className={`h-full rounded-full ${categoryColors[category as EventCategory] || "bg-primary"} transition-all duration-500`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
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

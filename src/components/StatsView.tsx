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

const CATEGORY_ORDER: EventCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

export function StatsView({ entries, monthTotal, calendarEvents }: StatsViewProps) {
  const now = new Date();

  // Hours per category from time entries
  const hoursByCategory = entries.reduce<Record<string, number>>((acc, e) => {
    const cat = e.category || "Predi";
    const end = e.endTime ? e.endTime.getTime() : Date.now();
    acc[cat] = (acc[cat] || 0) + (end - e.startTime.getTime());
    return acc;
  }, {});

  // Only completed calendar events this month
  const monthCompletedEvents = calendarEvents.filter(
    (e) =>
      e.completed &&
      e.date.getMonth() === now.getMonth() &&
      e.date.getFullYear() === now.getFullYear()
  );

  // Hours from completed events by category
  const completedHoursByCategory = monthCompletedEvents.reduce<Record<string, number>>((acc, e) => {
    if (!e.endTime) return acc;
    const start = e.date.getTime();
    const [h, m] = e.endTime.split(":").map(Number);
    const endDate = new Date(e.date);
    endDate.setHours(h, m, 0, 0);
    const diff = Math.max(0, endDate.getTime() - start);
    acc[e.category] = (acc[e.category] || 0) + diff;
    return acc;
  }, {});

  const completedCountByCategory = monthCompletedEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const totalCompletedHoursMs = Object.values(completedHoursByCategory).reduce((a, b) => a + b, 0);

  const maxHours = Math.max(...Object.values(hoursByCategory), 1);
  const maxCompleted = Math.max(...Object.values(completedHoursByCategory), 1);

  return (
    <div className="px-4 space-y-6 pb-24">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Horas fichadas
          </h3>
          <p className="text-3xl font-bold text-foreground">{formatDuration(monthTotal)}</p>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Horas realizadas
          </h3>
          <p className="text-3xl font-bold text-green-500">{formatDuration(totalCompletedHoursMs)}</p>
        </div>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Fichaje por categoría
        </h3>
        <div className="space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const ms = hoursByCategory[category] || 0;
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{category}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(ms)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full ${categoryColors[category]} transition-all duration-500`}
                    style={{ width: ms > 0 ? `${(ms / maxHours) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Eventos realizados por categoría
        </h3>
        <div className="space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const ms = completedHoursByCategory[category] || 0;
            const count = completedCountByCategory[category] || 0;
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{category}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(ms)} · {count} {count === 1 ? "evento" : "eventos"}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all duration-500"
                    style={{ width: ms > 0 ? `${(ms / maxCompleted) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

  // Events count per category
  const monthEvents = calendarEvents.filter(
    (e) =>
      e.date.getMonth() === now.getMonth() &&
      e.date.getFullYear() === now.getFullYear()
  );
  const eventsByCategory = monthEvents.reduce<Record<string, number>>((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + 1;
    return acc;
  }, {});

  const totalEvents = monthEvents.length;
  const maxHours = Math.max(...Object.values(hoursByCategory), 1);

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
          Horas por categoría
        </h3>
        <div className="space-y-3">
          {CATEGORY_ORDER.map((category) => {
            const ms = hoursByCategory[category] || 0;
            const events = eventsByCategory[category] || 0;
            return (
              <div key={category} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-foreground font-medium">{category}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {formatDuration(ms)} · {events} {events === 1 ? "evento" : "eventos"}
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
    </div>
  );
}

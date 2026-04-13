import { Clock, CalendarDays } from "lucide-react";
import { formatDuration } from "@/hooks/useTimeTracker";

interface DaySummaryProps {
  todayTotal: number;
  monthTotal: number;
  todayCount: number;
}

export function DaySummary({ todayTotal, monthTotal, todayCount }: DaySummaryProps) {
  return (
    <div className="grid grid-cols-3 gap-3 px-4">
      <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
        <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
        <p className="text-lg font-bold text-foreground">{formatDuration(todayTotal).slice(0, 5)}</p>
        <p className="text-xs text-muted-foreground">Hoy</p>
      </div>
      <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
        <CalendarDays className="w-5 h-5 mx-auto mb-2 text-accent" />
        <p className="text-lg font-bold text-foreground">{formatDuration(monthTotal).slice(0, 5)}</p>
        <p className="text-xs text-muted-foreground">Mes</p>
      </div>
      <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
        <div className="w-5 h-5 mx-auto mb-2 rounded-full bg-warning flex items-center justify-center text-[10px] font-bold text-warning-foreground">
          {todayCount}
        </div>
        <p className="text-lg font-bold text-foreground">{todayCount}</p>
        <p className="text-xs text-muted-foreground">Registros</p>
      </div>
    </div>
  );
}

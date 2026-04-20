import { Clock, CalendarDays } from "lucide-react";
import { formatDuration } from "@/hooks/useTimeTracker";
import { useT } from "@/lib/LanguageContext";

interface DaySummaryProps {
  todayTotal: number;
  monthTotal: number;
}

export function DaySummary({ todayTotal, monthTotal }: DaySummaryProps) {
  const t = useT();

  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
        <Clock className="w-5 h-5 mx-auto mb-2 text-primary" />
        <p className="text-lg font-bold text-foreground">{formatDuration(todayTotal).slice(0, 5)}</p>
        <p className="text-xs text-muted-foreground">{t('day_today')}</p>
      </div>
      <div className="rounded-xl bg-card p-4 text-center shadow-sm border border-border">
        <CalendarDays className="w-5 h-5 mx-auto mb-2 text-accent" />
        <p className="text-lg font-bold text-foreground">{formatDuration(monthTotal).slice(0, 5)}</p>
        <p className="text-xs text-muted-foreground">{t('day_month')}</p>
      </div>
    </div>
  );
}

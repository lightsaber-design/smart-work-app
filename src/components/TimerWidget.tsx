import { Pause } from "lucide-react";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface TimerWidgetProps {
  isRunning: boolean;
  elapsed: number; // seconds
  category?: string;
  onNavigate: () => void;
  t: TranslateFn;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export function TimerWidget({ isRunning, elapsed, category, onNavigate, t }: TimerWidgetProps) {
  if (!isRunning) return null;

  const now = new Date();
  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return (
    <button
      type="button"
      onClick={onNavigate}
      aria-label={t("timer_widget_running")}
      className="flex items-center gap-3 mb-5 active:scale-[0.98] transition-transform"
    >
      {/* Square with state icon */}
      <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm shadow-green-500/30 relative">
        <Pause className="w-6 h-6 text-white" fill="currentColor" />
        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-background animate-pulse" />
      </div>

      {/* Minutes + time */}
      <div className="min-w-0 text-left">
        <p className="text-2xl font-black tabular-nums text-foreground leading-none">
          {formatElapsed(elapsed)}
        </p>
        <p className="text-xs text-muted-foreground mt-1 truncate">
          {category ? `${category} · ${clock}` : clock}
        </p>
      </div>
    </button>
  );
}

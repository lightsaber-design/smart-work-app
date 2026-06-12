import { Timer } from "lucide-react";

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

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="w-full rounded-2xl border border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/30 p-4 mb-5 text-left active:scale-[0.98] transition-transform shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Left: pulsing dot + label */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm relative">
            <Timer className="w-5 h-5 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-400 border-2 border-background animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">
              {t("timer_widget_running")}
            </p>
            {category && (
              <p className="text-sm font-bold text-foreground truncate">{category}</p>
            )}
          </div>
        </div>

        {/* Right: elapsed + arrow */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg font-black tabular-nums text-green-600 dark:text-green-400">
            {formatElapsed(elapsed)}
          </span>
          <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-green-600 dark:text-green-400">
              <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>
    </button>
  );
}

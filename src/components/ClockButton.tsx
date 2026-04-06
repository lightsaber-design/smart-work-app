import { Play, Square } from "lucide-react";
import { formatDuration } from "@/hooks/useTimeTracker";

interface ClockButtonProps {
  isRunning: boolean;
  elapsed: number;
  onClockIn: () => void;
  onClockOut: () => void;
}

export function ClockButton({ isRunning, elapsed, onClockIn, onClockOut }: ClockButtonProps) {
  const elapsedMs = elapsed * 1000;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
        {isRunning ? formatDuration(elapsedMs) : "00:00:00"}
      </div>
      <p className="text-sm text-muted-foreground">
        {isRunning ? "Trabajando..." : "Listo para fichar"}
      </p>
      <button
        onClick={isRunning ? onClockOut : onClockIn}
        className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 active:scale-95 ${
          isRunning
            ? "bg-destructive timer-glow-active"
            : "bg-primary timer-glow"
        }`}
      >
        {isRunning ? (
          <Square className="w-8 h-8 text-destructive-foreground fill-current" />
        ) : (
          <Play className="w-8 h-8 text-primary-foreground ml-1" />
        )}
      </button>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {isRunning ? "Parar" : "Fichar"}
      </p>
    </div>
  );
}

import { Trash2 } from "lucide-react";
import { TimeEntry, formatTime, formatDuration } from "@/hooks/useTimeTracker";

interface TimeEntryListProps {
  entries: TimeEntry[];
  onDelete: (id: string) => void;
  onUpdateDescription: (id: string, desc: string) => void;
}

export function TimeEntryList({ entries, onDelete, onUpdateDescription }: TimeEntryListProps) {
  if (entries.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-muted-foreground text-sm">No hay registros hoy</p>
      </div>
    );
  }

  return (
    <div className="px-4 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Registros de hoy
      </h3>
      {entries.map((entry) => {
        const duration = entry.endTime
          ? entry.endTime.getTime() - entry.startTime.getTime()
          : Date.now() - entry.startTime.getTime();

        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-xl bg-card p-4 shadow-sm border border-border"
          >
            <div
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                entry.endTime ? "bg-muted-foreground" : "bg-success animate-pulse"
              }`}
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={entry.description}
                onChange={(e) => onUpdateDescription(entry.id, e.target.value)}
                placeholder="Añadir descripción..."
                className="text-sm font-medium text-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50"
              />
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTime(entry.startTime)}
                {entry.endTime ? ` — ${formatTime(entry.endTime)}` : " — en curso"}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground tabular-nums">
              {formatDuration(duration).slice(0, 5)}
            </p>
            {entry.endTime && (
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

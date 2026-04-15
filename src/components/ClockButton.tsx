import { Play, Square } from "lucide-react";
import { formatDuration, WorkCategory } from "@/hooks/useTimeTracker";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";

const CATEGORIES: WorkCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

interface ClockButtonProps {
  isRunning: boolean;
  elapsed: number;
  onClockIn: (category: WorkCategory) => void;
  onClockOut: () => void;
  onUpdateCategory: (category: WorkCategory) => void;
  calendarEvents: CalendarEvent[];
  activeCategory?: WorkCategory;
  activeEntryId?: string;
}

function detectCategoryFromEvents(events: CalendarEvent[]): WorkCategory | null {
  const now = Date.now();
  for (const event of events) {
    const start = event.date.getTime();
    let end = start + 2 * 60 * 60 * 1000; // default 2h
    if (event.endTime) {
      const [h, m] = event.endTime.split(":").map(Number);
      const endDate = new Date(event.date);
      endDate.setHours(h, m, 0, 0);
      end = endDate.getTime();
    }
    if (now >= start - 15 * 60 * 1000 && now <= end) {
      return event.category as WorkCategory;
    }
  }
  return null;
}

export function ClockButton({ isRunning, elapsed, onClockIn, onClockOut, onUpdateCategory, calendarEvents, activeCategory, activeEntryId }: ClockButtonProps) {
  const detected = detectCategoryFromEvents(calendarEvents);
  const [category, setCategory] = useState<WorkCategory>(detected || "Predi");

  useEffect(() => {
    if (!isRunning && detected) {
      setCategory(detected);
    }
  }, [detected, isRunning]);

  const elapsedMs = elapsed * 1000;

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
        {isRunning ? formatDuration(elapsedMs) : "00:00:00"}
      </div>

      <div className="w-48">
        <Select
          value={isRunning ? (activeCategory || category) : category}
          onValueChange={(v) => {
            const cat = v as WorkCategory;
            setCategory(cat);
            if (isRunning && activeEntryId) {
              onUpdateCategory(cat);
            }
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!isRunning && detected && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            Detectado del calendario
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {isRunning ? "Trabajando..." : "Listo para fichar"}
      </p>
      <button
        onClick={isRunning ? onClockOut : () => onClockIn(category)}
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

import { Play, Square, Clock, BookOpen, X } from "lucide-react";
import { formatDuration, WorkCategory } from "@/hooks/useTimeTracker";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { EstudioContact, EstudioSession, SessionFile } from "@/hooks/useEstudios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useEffect } from "react";
import { useT } from "@/lib/LanguageContext";

function getCurrentTimeStr(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function timeStrToDate(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function formatSessionDay(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.setHours(0,0,0,0)) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays === -1) return "ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const ALL_CATEGORIES: WorkCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

type SessionData = {
  time: string;
  files: SessionFile[];
};

type PendingPrompt = {
  contactId: string;
  contactName: string;
  nextSession: EstudioSession;
  sessionData: SessionData;
};

interface ClockButtonProps {
  isRunning: boolean;
  elapsed: number;
  onClockIn: (category: WorkCategory, customTime?: Date) => void;
  onClockOut: (customTime?: Date) => void;
  onUpdateCategory: (category: WorkCategory) => void;
  onUpdateStartTime: (startTime: Date) => void;
  calendarEvents: CalendarEvent[];
  activeCategory?: WorkCategory;
  activeEntryId?: string;
  activeEntryStartTime?: Date;
  estudios?: EstudioContact[];
  onEstudioSession?: (
    contactId: string,
    data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[]; forceNew?: boolean }
  ) => void;
}

function detectCategoryFromEvents(events: CalendarEvent[]): WorkCategory | null {
  const now = Date.now();
  for (const event of events) {
    const start = event.date.getTime();
    let end = start + 2 * 60 * 60 * 1000;
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

export function ClockButton({
  isRunning, elapsed, onClockIn, onClockOut, onUpdateCategory, onUpdateStartTime,
  calendarEvents, activeCategory, activeEntryId, activeEntryStartTime,
  estudios = [], onEstudioSession,
}: ClockButtonProps) {
  const t = useT();
  const detected = detectCategoryFromEvents(calendarEvents);
  const [category, setCategory] = useState<WorkCategory>(detected || "Predi");
  const [editingTime, setEditingTime] = useState(false);
  const [customTimeStr, setCustomTimeStr] = useState(getCurrentTimeStr());
  const [selectedEstudioId, setSelectedEstudioId] = useState<string>("");
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);

  const activeStudios = estudios.filter((e) => e.active);
  const categories = activeStudios.length > 0 ? ALL_CATEGORIES : ALL_CATEGORIES.filter((c) => c !== "Estudio");

  useEffect(() => {
    if (category === "Estudio" && activeStudios.length === 1) {
      setSelectedEstudioId(activeStudios[0].id);
    }
  }, [category, activeStudios.length]);

  useEffect(() => {
    if (!isRunning) {
      setCategory(detected || "Predi");
      setEditingTime(false);
    }
  }, [detected, isRunning]);

  const handleToggleEdit = () => {
    if (!editingTime) {
      if (isRunning && activeEntryStartTime) {
        setCustomTimeStr(
          `${String(activeEntryStartTime.getHours()).padStart(2, "0")}:${String(activeEntryStartTime.getMinutes()).padStart(2, "0")}`
        );
      } else {
        setCustomTimeStr(getCurrentTimeStr());
      }
    }
    setEditingTime((v) => !v);
  };

  const handleSaveStartTime = () => {
    onUpdateStartTime(timeStrToDate(customTimeStr));
    setEditingTime(false);
  };

  const handleAction = () => {
    if (isRunning) {
      onClockOut();

      if (selectedEstudioId && onEstudioSession) {
        const contact = estudios.find((e) => e.id === selectedEstudioId);
        const nextPending = contact?.sessions
          .filter((s) => s.pending)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;

        const sessionData: SessionData = { time: getCurrentTimeStr(), files: [] };

        if (nextPending) {
          const diffMs = new Date(nextPending.date).getTime() - Date.now();
          const diffHoursAbs = Math.abs(diffMs) / (1000 * 60 * 60);

          if (diffHoursAbs <= 1) {
            // Dentro de ±1 hora → completar automáticamente
            onEstudioSession(selectedEstudioId, sessionData);
          } else {
            // Más de 1 hora de diferencia → preguntar al usuario
            setPendingPrompt({
              contactId: selectedEstudioId,
              contactName: contact!.name,
              nextSession: nextPending,
              sessionData,
            });
          }
        } else {
          // Sin sesión pendiente → nueva sesión normal
          onEstudioSession(selectedEstudioId, sessionData);
        }
      }
    } else {
      const customTime = editingTime ? timeStrToDate(customTimeStr) : undefined;
      onClockIn(category, customTime);
      setEditingTime(false);
    }
  };

  const currentCategory = isRunning ? (activeCategory || category) : category;
  const showEstudioPicker = currentCategory === "Estudio" && activeStudios.length > 0;

  return (
    <>
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-4xl font-bold tracking-tight text-foreground tabular-nums">
          {isRunning ? formatDuration(elapsed * 1000) : "00:00:00"}
        </div>

        <div className="w-48 space-y-2">
          <Select
            value={currentCategory}
            onValueChange={(v) => {
              const cat = v as WorkCategory;
              setCategory(cat);
              if (cat !== "Estudio") setSelectedEstudioId("");
              if (isRunning && activeEntryId) onUpdateCategory(cat);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showEstudioPicker && (
            activeStudios.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-sm text-primary">
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate font-medium">{activeStudios[0].name}</span>
              </div>
            ) : (
              <Select value={selectedEstudioId} onValueChange={setSelectedEstudioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar estudio…" />
                </SelectTrigger>
                <SelectContent>
                  {activeStudios.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-3.5 h-3.5" />
                        {e.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          )}

          {!isRunning && detected && (
            <p className="text-xs text-muted-foreground text-center">{t('timer_detected')}</p>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleToggleEdit}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Clock className="w-3 h-3" />
            {editingTime ? t('timer_cancel') : isRunning ? t('timer_edit_start') : t('timer_forgot')}
          </button>
          {editingTime && (
            <>
              <input
                type="time"
                value={customTimeStr}
                onChange={(e) => setCustomTimeStr(e.target.value)}
                className="text-center text-sm font-medium bg-muted border border-border rounded-md px-3 py-1.5 text-foreground"
              />
              {isRunning && (
                <button onClick={handleSaveStartTime} className="text-xs font-medium text-primary hover:underline">
                  {t('timer_save')}
                </button>
              )}
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {isRunning ? t('timer_working') : t('timer_ready')}
        </p>

        <button
          onClick={handleAction}
          className={`relative flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 active:scale-95 ${
            isRunning ? "bg-destructive timer-glow-active" : "bg-primary timer-glow"
          }`}
        >
          {isRunning ? (
            <Square className="w-8 h-8 text-destructive-foreground fill-current" />
          ) : (
            <Play className="w-8 h-8 text-primary-foreground ml-1" />
          )}
        </button>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {isRunning ? t('timer_stop') : t('timer_clock_in')}
        </p>
      </div>

      {/* ── Prompt de sesión pendiente ── */}
      {pendingPrompt && (
        <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground leading-snug">
                  Guardando sesión de{" "}
                  <span className="font-semibold">{pendingPrompt.contactName}</span>
                  {" "}correspondiente al{" "}
                  <span className="font-semibold capitalize">
                    {formatSessionDay(pendingPrompt.nextSession.date)}
                  </span>
                </p>
              </div>
              <button onClick={() => setPendingPrompt(null)} className="flex-shrink-0 mt-0.5">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onEstudioSession!(pendingPrompt.contactId, pendingPrompt.sessionData);
                  setPendingPrompt(null);
                }}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                Sí
              </button>
              <button
                onClick={() => {
                  onEstudioSession!(pendingPrompt.contactId, { ...pendingPrompt.sessionData, forceNew: true });
                  setPendingPrompt(null);
                }}
                className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-medium"
              >
                No, sesión nueva
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

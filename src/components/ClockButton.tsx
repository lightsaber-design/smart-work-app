import { Pause, Play, BookOpen, X, Clock } from "lucide-react";
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
import { useMemo, useState, useEffect, useRef } from "react";
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
  const diffDays = Math.round((d.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "mañana";
  if (diffDays === -1) return "ayer";
  return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

const ALL_CATEGORIES: WorkCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

const CATEGORY_META: Record<WorkCategory, { icon: string; gradient: [string, string]; ring: string }> = {
  Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"], ring: "#818cf8" },
  Carrito: { icon: "🛒", gradient: ["#4ade80", "#34d399"], ring: "#34d399" },
  LDC:     { icon: "📖", gradient: ["#c084fc", "#818cf8"], ring: "#a855f7" },
  Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"], ring: "#f97316" },
  Estudio: { icon: "📚", gradient: ["#f472b6", "#e879f9"], ring: "#ec4899" },
};

const RING_RADIUS = 108;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SEC_RADIUS = 96;
const SEC_CIRCUMFERENCE = 2 * Math.PI * SEC_RADIUS;

type SessionData = { time: string; files: SessionFile[] };
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
  entries?: { category: WorkCategory; startTime: Date; endTime: Date | null }[];
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
  estudios = [], onEstudioSession, entries = [],
}: ClockButtonProps) {
  const t = useT();
  const detected = detectCategoryFromEvents(calendarEvents);
  const [category, setCategory] = useState<WorkCategory>(detected || "Predi");
  const [editingTime, setEditingTime] = useState(false);
  const [customTimeStr, setCustomTimeStr] = useState(getCurrentTimeStr());
  const [selectedEstudioId, setSelectedEstudioId] = useState<string>("");
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [wallTime, setWallTime] = useState(getCurrentTimeStr());
  const [seconds, setSeconds] = useState(new Date().getSeconds());
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Update wall clock every second
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setWallTime(getCurrentTimeStr());
      setSeconds(new Date().getSeconds());
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const activeStudios = useMemo(() => estudios.filter((e) => e.active), [estudios]);
  const categories = useMemo(
    () => activeStudios.length > 0 ? ALL_CATEGORIES : ALL_CATEGORIES.filter((c) => c !== "Estudio"),
    [activeStudios.length]
  );

  useEffect(() => {
    if (category === "Estudio" && activeStudios.length === 1) {
      setSelectedEstudioId(activeStudios[0].id);
    }
  }, [category, activeStudios]);

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
        if (!contact) { onEstudioSession(selectedEstudioId); return; }
        const nextPending = (contact.sessions ?? [])
          .filter((s) => s.pending)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
        const sessionData: SessionData = { time: getCurrentTimeStr(), files: [] };
        if (nextPending) {
          const diffHoursAbs = Math.abs(new Date(nextPending.date).getTime() - Date.now()) / (1000 * 60 * 60);
          if (diffHoursAbs <= 1) {
            onEstudioSession(selectedEstudioId, sessionData);
          } else {
            setPendingPrompt({ contactId: selectedEstudioId, contactName: contact.name, nextSession: nextPending, sessionData });
          }
        } else {
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
  const meta = CATEGORY_META[currentCategory];
  const showEstudioPicker = currentCategory === "Estudio" && activeStudios.length > 0;

  // Hour ring progress (fraction of current hour elapsed)
  const elapsedMs = elapsed * 1000;
  const hourProgress = elapsedMs > 0 ? (elapsedMs % 3_600_000) / 3_600_000 : 0;
  const dashOffset = CIRCUMFERENCE * (1 - hourProgress);

  // Seconds ring
  const secProgress = seconds / 60;
  const secDashOffset = SEC_CIRCUMFERENCE * (1 - secProgress);

  // Elapsed breakdown
  const elapsedHrs = Math.floor(elapsedMs / 3_600_000);
  const elapsedMins = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const elapsedSecs = Math.floor((elapsedMs % 60_000) / 1_000);

  return (
    <>
      <div className="flex flex-col items-center w-full gap-0">

        {/* ── Circular timer ── */}
        <div
          className={`relative flex items-center justify-center rounded-full transition-shadow duration-700 ${
            isRunning ? "shadow-[0_0_60px_16px_rgba(0,0,0,0.08)]" : "shadow-2xl"
          }`}
          style={{
            width: 264,
            height: 264,
            background: `radial-gradient(circle at 40% 35%, ${meta.gradient[0]}22, transparent 60%), radial-gradient(circle at 70% 70%, ${meta.gradient[1]}18, transparent 60%), var(--card)`,
            boxShadow: isRunning
              ? `0 0 0 1px ${meta.ring}30, 0 0 40px 8px ${meta.ring}18, 0 8px 32px rgba(0,0,0,0.1)`
              : "0 4px 24px rgba(0,0,0,0.08)",
          }}
        >
          {/* SVG rings */}
          <svg
            className="absolute inset-0 -rotate-90"
            width="264"
            height="264"
            viewBox="0 0 264 264"
          >
            {/* Outer track */}
            <circle cx="132" cy="132" r={RING_RADIUS} fill="none"
              stroke="currentColor" strokeWidth="5"
              className="text-border opacity-25"
            />
            {/* Outer progress (hours) */}
            {elapsedMs > 0 && (
              <circle cx="132" cy="132" r={RING_RADIUS} fill="none"
                stroke={meta.ring} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            )}
            {/* Inner seconds ring (only when running) */}
            {isRunning && (
              <>
                <circle cx="132" cy="132" r={SEC_RADIUS} fill="none"
                  stroke={meta.ring} strokeWidth="2"
                  className="opacity-15"
                  strokeDasharray={SEC_CIRCUMFERENCE}
                  strokeDashoffset="0"
                />
                <circle cx="132" cy="132" r={SEC_RADIUS} fill="none"
                  stroke={meta.ring} strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={SEC_CIRCUMFERENCE}
                  strokeDashoffset={secDashOffset}
                  style={{ transition: "stroke-dashoffset 0.95s linear" }}
                />
              </>
            )}
          </svg>

          {/* Inner content */}
          <div className="flex flex-col items-center gap-1.5 z-10 select-none">
            {isRunning ? (
              <>
                {/* Running: category badge */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[10px] font-bold tracking-wide"
                  style={{ background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})` }}
                >
                  <span>{meta.icon}</span>
                  <span>{currentCategory}</span>
                </div>

                {/* Elapsed time — big */}
                <div className="flex items-end gap-0.5 leading-none mt-0.5">
                  {elapsedHrs > 0 && (
                    <>
                      <span className="text-4xl font-black tabular-nums text-foreground">{elapsedHrs}</span>
                      <span className="text-base font-bold text-muted-foreground mb-0.5">h</span>
                    </>
                  )}
                  <span className="text-4xl font-black tabular-nums text-foreground ml-0.5">
                    {String(elapsedMins).padStart(elapsedHrs > 0 ? 2 : 1, "0")}
                  </span>
                  <span className="text-base font-bold text-muted-foreground mb-0.5">m</span>
                  <span className="text-2xl font-bold tabular-nums text-muted-foreground ml-0.5 mb-px">
                    {String(elapsedSecs).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-bold text-muted-foreground mb-0.5">s</span>
                </div>

                {/* Pause button */}
                <button
                  onClick={handleAction}
                  className="mt-2 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})` }}
                >
                  <Pause className="w-5 h-5 text-white fill-white" />
                </button>
              </>
            ) : (
              <>
                {/* Idle: wall clock */}
                <p className="text-[11px] font-semibold text-muted-foreground tracking-widest uppercase">
                  {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className="text-[42px] font-black tabular-nums text-foreground leading-none tracking-tight">
                  {wallTime}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">
                  {currentCategory} · Toca para iniciar
                </p>

                {/* Play button */}
                <button
                  onClick={handleAction}
                  className="mt-2 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})` }}
                >
                  <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Category icons ── */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {categories.map((cat) => {
            const m = CATEGORY_META[cat];
            const isActive = currentCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  if (cat !== "Estudio") setSelectedEstudioId("");
                  if (isRunning && activeEntryId) onUpdateCategory(cat);
                }}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all shadow-sm ${
                    isActive ? "scale-110 shadow-md" : "opacity-50"
                  }`}
                  style={isActive
                    ? { background: `linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]})` }
                    : { background: "var(--muted)" }
                  }
                >
                  {m.icon}
                </div>
                <span className={`text-[10px] font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                  {cat}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Estudio picker ── */}
        {showEstudioPicker && (
          <div className="mt-4 w-56">
            {activeStudios.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-sm text-primary">
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
            )}
          </div>
        )}

        {/* ── Edit start time ── */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <button
            onClick={handleToggleEdit}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <Clock className="w-3 h-3" />
            {editingTime ? t("timer_cancel") : isRunning ? t("timer_edit_start") : t("timer_forgot")}
          </button>
          {editingTime && (
            <>
              <input
                type="time"
                value={customTimeStr}
                onChange={(e) => setCustomTimeStr(e.target.value)}
                className="text-center text-sm font-medium bg-muted border border-border rounded-xl px-3 py-1.5 text-foreground"
              />
              {isRunning && (
                <button onClick={handleSaveStartTime} className="text-xs font-medium text-primary hover:underline cursor-pointer">
                  {t("timer_save")}
                </button>
              )}
            </>
          )}
        </div>

      </div>

      {/* ── Prompt sesión pendiente ── */}
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
              <button onClick={() => setPendingPrompt(null)} className="flex-shrink-0 mt-0.5 cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { onEstudioSession?.(pendingPrompt.contactId, pendingPrompt.sessionData); setPendingPrompt(null); }}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
              >
                Sí
              </button>
              <button
                onClick={() => { onEstudioSession?.(pendingPrompt.contactId, { ...pendingPrompt.sessionData, forceNew: true }); setPendingPrompt(null); }}
                className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-medium cursor-pointer"
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

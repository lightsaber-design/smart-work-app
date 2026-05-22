import { Pause, Play, BookOpen, X, Clock } from "lucide-react";
import { WorkCategory } from "@/hooks/useTimeTracker";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { EstudioContact, EstudioSession, SessionFile, hasActiveStudyWork } from "@/hooks/useEstudios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect, useRef } from "react";
import { useT } from "@/lib/LanguageContext";
import { DEFAULT_ACTIVITY_END_HOUR, DEFAULT_ACTIVITY_START_HOUR } from "@/lib/activityHours";
import { CategoryConfig, getActiveCategoryConfigs, getCategoryMeta } from "@/lib/categories";

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

function clampTimeToActivityRange(value: string, startHour: number, endHour: number): string {
  const [hours, minutes] = value.split(":").map(Number);
  const totalMinutes = hours * 60 + minutes;
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  if (!Number.isFinite(totalMinutes) || totalMinutes < startMinutes) return `${String(startHour).padStart(2, "0")}:00`;
  if (totalMinutes > endMinutes) return `${String(endHour).padStart(2, "0")}:00`;
  return value;
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

const RING_RADIUS = 108;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const SEC_RADIUS = 96;
const SEC_CIRCUMFERENCE = 2 * Math.PI * SEC_RADIUS;

function softCategoryBackground([from, to]: [string, string]): string {
  return `linear-gradient(145deg, ${from}20 0%, ${to}16 58%, rgba(255,255,255,0.97) 100%)`;
}

function strongCategoryBackground([from, to]: [string, string]): string {
  return `linear-gradient(145deg, ${from} 0%, ${to} 100%)`;
}

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
  onDisplayCategoryChange?: (category: WorkCategory) => void;
  onEstudioSession?: (
    contactId: string,
    data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[]; forceNew?: boolean }
  ) => void;
  categoryConfigs: CategoryConfig[];
  activityStartHour?: number;
  activityEndHour?: number;
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
  estudios = [], onDisplayCategoryChange, onEstudioSession,
  categoryConfigs,
  activityStartHour = DEFAULT_ACTIVITY_START_HOUR,
  activityEndHour = DEFAULT_ACTIVITY_END_HOUR,
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

  // Actualiza el reloj de pared cada segundo.
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setWallTime(getCurrentTimeStr());
      setSeconds(new Date().getSeconds());
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  const activeStudios = useMemo(() => estudios.filter(hasActiveStudyWork), [estudios]);
  const categories = useMemo(
    () => getActiveCategoryConfigs(categoryConfigs)
      .map((item) => item.name)
      .filter((cat) => cat !== "Estudio" || activeStudios.length > 0),
    [activeStudios.length, categoryConfigs]
  );

  useEffect(() => {
    if (category === "Estudio" && activeStudios.length === 1) {
      setSelectedEstudioId(activeStudios[0].id);
    } else if (category === "Estudio" && activeStudios.length === 0) {
      setCategory(categories[0] ?? "Predi");
      setSelectedEstudioId("");
    }
  }, [category, activeStudios, categories]);

  useEffect(() => {
    if (!isRunning) {
      const nextCategory = detected && categories.includes(detected) ? detected : categories[0] ?? "Predi";
      setCategory(nextCategory);
      setEditingTime(false);
    }
  }, [categories, detected, isRunning]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? "Predi");
  }, [categories, category]);

  useEffect(() => {
    setCustomTimeStr((value) => clampTimeToActivityRange(value, activityStartHour, activityEndHour));
  }, [activityStartHour, activityEndHour]);

  const handleToggleEdit = () => {
    if (!editingTime) {
      if (isRunning && activeEntryStartTime) {
        setCustomTimeStr(clampTimeToActivityRange(
          `${String(activeEntryStartTime.getHours()).padStart(2, "0")}:${String(activeEntryStartTime.getMinutes()).padStart(2, "0")}`,
          activityStartHour,
          activityEndHour
        ));
      } else {
        setCustomTimeStr(clampTimeToActivityRange(getCurrentTimeStr(), activityStartHour, activityEndHour));
      }
    }
    setEditingTime((v) => !v);
  };

  const handleSaveStartTime = () => {
    const safeTime = clampTimeToActivityRange(customTimeStr, activityStartHour, activityEndHour);
    onUpdateStartTime(timeStrToDate(safeTime));
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
      const customTime = editingTime
        ? timeStrToDate(clampTimeToActivityRange(customTimeStr, activityStartHour, activityEndHour))
        : undefined;
      onClockIn(category, customTime);
      setEditingTime(false);
    }
  };

  const currentCategory = isRunning ? (activeCategory || category) : category;
  const meta = getCategoryMeta(categoryConfigs, currentCategory);
  const showEstudioPicker = currentCategory === "Estudio" && activeStudios.length > 0;

  useEffect(() => {
    onDisplayCategoryChange?.(currentCategory);
  }, [currentCategory, onDisplayCategoryChange]);

  // Avance del anillo de hora según la fracción transcurrida.
  const elapsedMs = elapsed * 1000;
  const hourProgress = elapsedMs > 0 ? (elapsedMs % 3_600_000) / 3_600_000 : 0;
  const dashOffset = CIRCUMFERENCE * (1 - hourProgress);

  // Anillo de segundos.
  const secProgress = seconds / 60;
  const secDashOffset = SEC_CIRCUMFERENCE * (1 - secProgress);

  // Desglose del tiempo transcurrido.
  const elapsedHrs = Math.floor(elapsedMs / 3_600_000);
  const elapsedMins = Math.floor((elapsedMs % 3_600_000) / 60_000);
  const elapsedSecs = Math.floor((elapsedMs % 60_000) / 1_000);
  const elapsedHourDigits = String(elapsedHrs).length;
  const elapsedNumberClass = elapsedHourDigits >= 4
    ? "text-[2.45rem]"
    : elapsedHourDigits >= 3
    ? "text-[2.95rem]"
    : "text-6xl";
  const elapsedMinuteClass = elapsedHourDigits >= 4
    ? "text-[2.45rem]"
    : elapsedHourDigits >= 3
    ? "text-[2.85rem]"
    : "text-6xl";
  const elapsedUnitClass = elapsedHourDigits >= 3 ? "text-base mb-0.5" : "text-xl mb-1";
  const elapsedSecondsClass = elapsedHourDigits >= 4
    ? "text-xl mb-0.5"
    : elapsedHourDigits >= 3
    ? "text-2xl mb-0.5"
    : "text-3xl mb-1";
  const elapsedSecondsUnitClass = elapsedHourDigits >= 3 ? "text-xs mb-0.5" : "text-sm mb-1";
  const circleBackground = isRunning ? strongCategoryBackground(meta.gradient) : softCategoryBackground(meta.gradient);
  const circleText = isRunning ? "text-white" : "text-slate-900";
  const mutedCircleText = isRunning ? "text-white/75" : "text-slate-700";
  const subtleCircleText = isRunning ? "text-white/60" : "text-slate-500";
  const progressStroke = isRunning ? "rgba(255,255,255,0.94)" : meta.ring;

  return (
    <>
      <div className="flex flex-col items-center w-full gap-0">

        {/* Temporizador circular */}
        <div
          className={`relative flex items-center justify-center rounded-full transition-shadow duration-700 ${
            isRunning ? "shadow-[0_0_60px_16px_rgba(0,0,0,0.08)]" : "shadow-2xl"
          }`}
          style={{
            width: 264,
            height: 264,
            background: circleBackground,
            boxShadow: isRunning
              ? `0 0 0 1px ${meta.ring}66, 0 0 44px 10px ${meta.ring}3d, 0 8px 32px rgba(0,0,0,0.12)`
              : "0 10px 34px rgba(15,23,42,0.08)",
          }}
        >
          {/* Anillos SVG */}
          <svg
            className="absolute inset-0 -rotate-90"
            width="264"
            height="264"
            viewBox="0 0 264 264"
          >
            {/* Pista exterior */}
            <circle cx="132" cy="132" r={RING_RADIUS} fill="none"
              stroke="currentColor" strokeWidth="5"
              className={isRunning ? "text-white/25" : "text-slate-900/10"}
            />
            {/* Avance exterior por hora */}
            {elapsedMs > 0 && (
              <circle cx="132" cy="132" r={RING_RADIUS} fill="none"
                stroke={progressStroke} strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            )}
            {/* Anillo interior de segundos mientras corre */}
            {isRunning && (
              <>
                <circle cx="132" cy="132" r={SEC_RADIUS} fill="none"
                  stroke="rgba(255,255,255,0.22)" strokeWidth="2"
                  strokeDasharray={SEC_CIRCUMFERENCE}
                  strokeDashoffset="0"
                />
                <circle cx="132" cy="132" r={SEC_RADIUS} fill="none"
                  stroke={progressStroke} strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={SEC_CIRCUMFERENCE}
                  strokeDashoffset={secDashOffset}
                  style={{ transition: "stroke-dashoffset 0.95s linear" }}
                />
              </>
            )}
          </svg>

          {/* Contenido interno */}
          <div className="flex flex-col items-center gap-1.5 z-10 select-none">
            {isRunning ? (
              <>
                {/* Etiqueta de categoría activa */}
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-[10px] font-bold tracking-wide"
                  style={{ background: "rgba(255,255,255,0.18)" }}
                >
                  <span>{meta.icon}</span>
                  <span>{currentCategory}</span>
                </div>

                {/* Tiempo transcurrido grande */}
                <div className="flex max-w-[218px] items-end justify-center gap-0.5 leading-none mt-0.5 overflow-hidden">
                  {elapsedHrs > 0 && (
                    <>
                      <span className={`${elapsedNumberClass} font-black tabular-nums text-white leading-none`}>{elapsedHrs}</span>
                      <span className={`${elapsedUnitClass} font-bold text-white/75`}>h</span>
                    </>
                  )}
                  <span className={`${elapsedMinuteClass} font-black tabular-nums text-white leading-none ml-0.5`}>
                    {String(elapsedMins).padStart(elapsedHrs > 0 ? 2 : 1, "0")}
                  </span>
                  <span className={`${elapsedUnitClass} font-bold text-white/75`}>m</span>
                  <span className={`${elapsedSecondsClass} font-bold tabular-nums text-white/70 ml-0.5`}>
                    {String(elapsedSecs).padStart(2, "0")}
                  </span>
                  <span className={`${elapsedSecondsUnitClass} font-bold text-white/65`}>s</span>
                </div>

                {/* Botón de pausa */}
                <button
                  onClick={handleAction}
                  className="mt-2 w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                  style={{ background: "rgba(255,255,255,0.2)" }}
                >
                  <Pause className="w-5 h-5 text-white fill-white" />
                </button>
              </>
            ) : (
              <>
                {/* Reloj detenido */}
                <p className={`text-[11px] font-semibold ${subtleCircleText} tracking-widest uppercase`}>
                  {new Date().toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                </p>
                <p className={`text-[50px] font-black tabular-nums ${circleText} leading-none tracking-tight`}>
                  {wallTime}
                </p>
                <p className={`text-[11px] ${mutedCircleText} font-medium`}>
                  {currentCategory} · Toca para empezar
                </p>

                {/* Botón de inicio */}
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

        {/* Iconos de categoría */}
        <div className="flex items-center justify-center gap-4 mt-6">
          {categories.map((cat) => {
            const m = getCategoryMeta(categoryConfigs, cat);
            const isActive = currentCategory === cat;
            const isStrong = isActive && isRunning;
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
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl transition-all ${
                    isActive ? "scale-110 shadow-md" : "opacity-80"
                  }`}
                  style={isStrong
                    ? { background: strongCategoryBackground(m.gradient) }
                    : { background: softCategoryBackground(m.gradient) }
                  }
                >
                  {m.icon}
                </div>
                <span className={`text-[10px] font-semibold ${isStrong ? "text-white" : "text-slate-700"}`}>
                  {cat}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selector de estudio */}
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

        {/* Edición de hora inicial */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <button
            onClick={handleToggleEdit}
            className={`flex items-center gap-1 text-xs transition-colors cursor-pointer ${
              isRunning ? "text-white/80 hover:text-white" : "text-slate-700 hover:text-slate-950"
            }`}
          >
            <Clock className="w-3 h-3" />
            {editingTime ? t("timer_cancel") : isRunning ? t("timer_edit_start") : t("timer_forgot")}
          </button>
          {editingTime && (
            <>
              <input
                type="time"
                min={`${String(activityStartHour).padStart(2, "0")}:00`}
                max={`${String(activityEndHour).padStart(2, "0")}:00`}
                value={customTimeStr}
                onChange={(e) => setCustomTimeStr(e.target.value)}
                onBlur={() => setCustomTimeStr((value) => clampTimeToActivityRange(value, activityStartHour, activityEndHour))}
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

      {/* Aviso de sesión pendiente */}
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

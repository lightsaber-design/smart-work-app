import { Pause, Play, BookOpen, X, Clock, StickyNote, Check, Paperclip, Mic, Square, Trash2 } from "lucide-react";
import { WorkCategory } from "@/hooks/useTimeTracker";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { EstudioContact, EstudioSession, SessionFile, hasActiveStudyWork, nearestPendingSession, weekStartMs } from "@/hooks/useEstudios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState, useEffect, useRef } from "react";
import { saveFile } from "@/lib/sessionFiles";
import { generateId } from "@/lib/uuid";
import { localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { DEFAULT_ACTIVITY_END_HOUR, DEFAULT_ACTIVITY_START_HOUR } from "@/lib/activityHours";
import { CategoryConfig, getActiveCategoryConfigs, getCategoryLabel, getCategoryMeta } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { formatDateLong, formatShortMonth, formatWeekday } from "@/lib/dateFormat";

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

function formatSessionDay(isoDate: string, t: (key: string) => string, locale: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays === 0) return t("date_today_lower");
  if (diffDays === 1) return t("date_tomorrow_lower");
  if (diffDays === -1) return t("date_yesterday_lower");
  return formatDateLong(d, locale);
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
type PostStudyState = {
  contactId: string;
  contactName: string;
  sessionId: string;
  sessionDate: string;
  sessionLesson?: string;
  notes: string;
};

const POST_STUDY_SECONDS = 10;

interface ClockButtonProps {
  isRunning: boolean;
  isPaused?: boolean;
  elapsed: number;
  onClockIn: (category: WorkCategory, customTime?: Date) => void;
  onClockOut: (customTime?: Date) => void;
  onPause?: () => void;
  onResume?: () => void;
  onUpdateCategory: (category: WorkCategory) => void;
  onUpdateStartTime: (startTime: Date) => void;
  calendarEvents: CalendarEvent[];
  activeCategory?: WorkCategory;
  activeEntryId?: string;
  activeEntryStartTime?: Date;
  activeEventNotes?: string;
  onSaveNotes?: (notes: string) => void;
  estudios?: EstudioContact[];
  onDisplayCategoryChange?: (category: WorkCategory) => void;
  onEstudioSession?: (
    contactId: string,
    data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[]; forceNew?: boolean }
  ) => void;
  onUpdateEstudioNotes?: (contactId: string, sessionId: string, notes: string) => void;
  categoryConfigs: CategoryConfig[];
  /** Categoría preseleccionada al abrir el cronómetro (configurable en Ajustes). */
  defaultCategory?: WorkCategory;
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
  isRunning, isPaused = false, elapsed, onClockIn, onClockOut, onPause, onResume, onUpdateCategory, onUpdateStartTime,
  calendarEvents, activeCategory, activeEntryId, activeEntryStartTime,
  activeEventNotes, onSaveNotes,
  estudios = [], onDisplayCategoryChange, onEstudioSession, onUpdateEstudioNotes,
  categoryConfigs,
  defaultCategory = "Predi",
  activityStartHour = DEFAULT_ACTIVITY_START_HOUR,
  activityEndHour = DEFAULT_ACTIVITY_END_HOUR,
}: ClockButtonProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  const detected = detectCategoryFromEvents(calendarEvents);
  const [category, setCategory] = useState<WorkCategory>(detected || defaultCategory);
  const [editingTime, setEditingTime] = useState(false);
  const [customTimeStr, setCustomTimeStr] = useState(getCurrentTimeStr());
  const [selectedEstudioId, setSelectedEstudioId] = useState<string>("");
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [wallTime, setWallTime] = useState(getCurrentTimeStr());
  const [seconds, setSeconds] = useState(new Date().getSeconds());
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState(activeEventNotes ?? "");
  const [notesSaved, setNotesSaved] = useState(false);
  const [sessionLesson, setSessionLesson] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [sessionNearestDate, setSessionNearestDate] = useState<string | null>(null);
  const [sessionPendingFiles, setSessionPendingFiles] = useState<{ file: File; id: string }[]>([]);
  const [postStudy, setPostStudy] = useState<PostStudyState | null>(null);
  const [postStudyCountdown, setPostStudyCountdown] = useState(POST_STUDY_SECONDS);
  // Voice note state
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceNoteDataUrl, setVoiceNoteDataUrl] = useState<string | null>(null);
  const [isPlayingVoice, setIsPlayingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const estudiosRef = useRef(estudios);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const postStudyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Actualiza el reloj de pared cada segundo.
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setWallTime(getCurrentTimeStr());
      setSeconds(new Date().getSeconds());
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, []);

  // Sincroniza notas cuando cambia el evento activo.
  useEffect(() => {
    setNotesText(activeEventNotes ?? "");
    setNotesSaved(false);
  }, [activeEventNotes]);

  // Mantiene la ref de estudios actualizada sin causar re-renders.
  useEffect(() => { estudiosRef.current = estudios; }, [estudios]);

  // Resetea el estado de notas cuando el timer se detiene.
  useEffect(() => {
    if (!isRunning) {
      setNotesOpen(false);
      setNotesText("");
      setNotesSaved(false);
      setSessionLesson("");
      setSessionNotes("");
      setSessionNearestDate(null);
      setSessionPendingFiles([]);
    }
  }, [isRunning]);

  // Precarga los datos de la sesión más cercana cuando cambia el contacto seleccionado.
  // Sólo depende de selectedEstudioId para no resetear el estado al re-renderizarse el padre.
  useEffect(() => {
    if (!selectedEstudioId) return;
    const contact = estudiosRef.current.find((e) => e.id === selectedEstudioId);
    if (!contact) return;
    const nearest = nearestPendingSession(contact.sessions ?? [], Date.now());
    setSessionLesson(nearest?.lesson ?? "");
    setSessionNotes(nearest?.notes ?? "");
    setSessionNearestDate(nearest?.date ?? null);
    setSessionPendingFiles([]);
  }, [selectedEstudioId]);

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
      const preferred = categories.includes(defaultCategory) ? defaultCategory : (categories[0] ?? "Predi");
      const nextCategory = detected && categories.includes(detected) ? detected : preferred;
      setCategory(nextCategory);
      setEditingTime(false);
    }
  }, [categories, detected, isRunning, defaultCategory]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory(categories[0] ?? "Predi");
  }, [categories, category]);

  useEffect(() => {
    setCustomTimeStr((value) => clampTimeToActivityRange(value, activityStartHour, activityEndHour));
  }, [activityStartHour, activityEndHour]);

  // ── Post-study popup helpers ────────────────────────────────────────────────
  const dismissPostStudy = () => {
    if (postStudyIntervalRef.current) clearInterval(postStudyIntervalRef.current);
    postStudyIntervalRef.current = null;
    setPostStudy(null);
    setPostStudyCountdown(POST_STUDY_SECONDS);
    stopRecording();
    setVoiceNoteDataUrl(null);
    setIsPlayingVoice(false);
  };

  // ── Voice recording helpers ───────────────────────────────────────────────
  const startRecording = async () => {
    // Pause the auto-dismiss countdown while recording
    setPostStudyCountdown(POST_STUDY_SECONDS);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => { setVoiceNoteDataUrl(reader.result as string); };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      isRecordingRef.current = true;
      setRecordingSeconds(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      // microphone permission denied or not available
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    setIsRecording(false);
    isRecordingRef.current = false;
  };

  const toggleVoicePlay = () => {
    if (!voiceNoteDataUrl) return;
    if (!voiceAudioRef.current) {
      voiceAudioRef.current = new Audio(voiceNoteDataUrl);
      voiceAudioRef.current.onended = () => setIsPlayingVoice(false);
    }
    if (isPlayingVoice) {
      voiceAudioRef.current.pause();
      setIsPlayingVoice(false);
    } else {
      void voiceAudioRef.current.play();
      setIsPlayingVoice(true);
    }
  };

  const deleteVoiceNote = () => {
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    setVoiceNoteDataUrl(null);
    setIsPlayingVoice(false);
  };

  const savePostStudyNotes = () => {
    if (postStudy?.notes.trim()) {
      onUpdateEstudioNotes?.(postStudy.contactId, postStudy.sessionId, postStudy.notes.trim());
    }
    if (voiceNoteDataUrl && postStudy?.sessionId) {
      try { localStorage.setItem(`vn-${postStudy.sessionId}`, voiceNoteDataUrl); } catch { /* quota */ }
    }
    dismissPostStudy();
  };

  const showPostStudyFor = (contactId: string) => {
    // Busca la próxima sesión programada tras un pequeño delay para que
    // estudiosRef tenga los datos ya actualizados por el padre.
    setTimeout(() => {
      const contact = estudiosRef.current.find((e) => e.id === contactId);
      if (!contact) return;
      const next = nearestPendingSession(contact.sessions ?? [], Date.now());
      if (!next) return;
      if (postStudyIntervalRef.current) clearInterval(postStudyIntervalRef.current);
      setPostStudy({ contactId, contactName: contact.name, sessionId: next.id, sessionDate: next.date, sessionLesson: next.lesson, notes: "" });
      setPostStudyCountdown(POST_STUDY_SECONDS);
      postStudyIntervalRef.current = setInterval(() => {
        if (isRecordingRef.current) return; // pause countdown while recording
        setPostStudyCountdown((prev) => {
          if (prev <= 1) {
            if (postStudyIntervalRef.current) clearInterval(postStudyIntervalRef.current);
            postStudyIntervalRef.current = null;
            setPostStudy(null);
            return POST_STUDY_SECONDS;
          }
          return prev - 1;
        });
      }, 1000);
    }, 350);
  };

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

  const handleAction = async () => {
    if (isRunning) {
      onClockOut();
      if (selectedEstudioId && onEstudioSession) {
        const contact = estudios.find((e) => e.id === selectedEstudioId);
        if (!contact) { onEstudioSession(selectedEstudioId); return; }

        // Guarda los archivos pendientes antes de pasar los metadatos.
        const savedFiles: SessionFile[] = [];
        for (const { file, id } of sessionPendingFiles) {
          await saveFile(id, file);
          savedFiles.push({ id, name: file.name, type: file.type, size: file.size });
        }

        const nextPending = nearestPendingSession(contact.sessions ?? [], Date.now());
        const sessionData = {
          time: getCurrentTimeStr(),
          files: savedFiles,
          lesson: sessionLesson.trim() || undefined,
          notes: sessionNotes.trim() || undefined,
        };

        if (nextPending) {
          // Si la sesión pendiente es de esta misma semana, la reescribimos
          // directamente sin pedir confirmación (modelo "semana a semana").
          const isCurrentWeek = weekStartMs(new Date(nextPending.date)) === weekStartMs(new Date());
          if (isCurrentWeek) {
            onEstudioSession(selectedEstudioId, sessionData);
            showPostStudyFor(selectedEstudioId);
          } else {
            // Sesión de una semana futura: preguntar si es la correcta
            setPendingPrompt({ contactId: selectedEstudioId, contactName: contact.name, nextSession: nextPending, sessionData });
          }
        } else {
          onEstudioSession(selectedEstudioId, sessionData);
          showPostStudyFor(selectedEstudioId);
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
  const scheduledActivityHint = !isRunning && detected
    ? t("timer_replaces_scheduled", { category: getCategoryLabel(detected, t) })
    : null;

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
                  <CategoryIcon icon={meta.icon} />
                  <span>{getCategoryLabel(currentCategory, t)}</span>
                </div>

                {/* Indicador de pausa */}
                {isPaused && (
                  <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white text-[10px] font-bold tracking-wide uppercase animate-pulse" style={{ background: "rgba(255,255,255,0.22)" }}>
                    <Pause className="w-3 h-3 fill-white" />
                    <span>{t("timer_paused")}</span>
                  </div>
                )}

                {/* Tiempo transcurrido grande */}
                <div className={`flex max-w-[218px] items-end justify-center gap-0.5 leading-none mt-0.5 overflow-hidden ${isPaused ? "opacity-60" : ""}`}>
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

                {/* Controles: pausar/reanudar + parar */}
                <div className="mt-2 flex items-center gap-4">
                  <button
                    onClick={() => (isPaused ? onResume?.() : onPause?.())}
                    aria-label={isPaused ? t("timer_resume") : t("timer_pause")}
                    title={isPaused ? t("timer_resume") : t("timer_pause")}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg"
                    style={{ background: "rgba(255,255,255,0.2)" }}
                  >
                    {isPaused
                      ? <Play className="w-5 h-5 text-white fill-white ml-0.5" />
                      : <Pause className="w-5 h-5 text-white fill-white" />}
                  </button>
                  <button
                    onClick={handleAction}
                    aria-label={t("timer_stop")}
                    title={t("timer_stop")}
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-lg bg-white"
                  >
                    <Square className="w-5 h-5 fill-current" style={{ color: meta.gradient[0] }} />
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Reloj detenido */}
                <p className={`text-[11px] font-semibold ${subtleCircleText} tracking-widest uppercase`}>
                  {`${formatWeekday(new Date(), locale, "short")}, ${new Date().getDate()} ${formatShortMonth(new Date(), locale)}`}
                </p>
                <p className={`text-[50px] font-black tabular-nums ${circleText} leading-none tracking-tight`}>
                  {wallTime}
                </p>
                <p className={`text-[11px] ${mutedCircleText} font-medium`}>
                  {t("timer_touch_to_start", { category: getCategoryLabel(currentCategory, t) })}
                </p>
                {scheduledActivityHint && (
                  <p className={`max-w-[190px] text-center text-[10px] ${subtleCircleText} font-medium leading-tight`}>
                    {scheduledActivityHint}
                  </p>
                )}

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
                  <CategoryIcon icon={m.icon} />
                </div>
                <span className={`text-[10px] font-semibold ${isActive ? "text-slate-900" : "text-slate-600"}`}>
                  {getCategoryLabel(cat, t)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selector de estudio */}
        {showEstudioPicker && (
          <div className="mt-4 w-full px-1 space-y-3">
            {/* Nombre del contacto */}
            {activeStudios.length === 1 ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm bg-primary/10 text-primary">
                <BookOpen className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate font-medium">{activeStudios[0].name}</span>
              </div>
            ) : (
              <Select value={selectedEstudioId} onValueChange={setSelectedEstudioId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("clock_select_study")} />
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

            {/* Panel de sesión programada — siempre editable */}
            {selectedEstudioId && (
              <div
                className="rounded-2xl px-3.5 py-3 space-y-2.5"
                style={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}
              >
                {/* Cabecera con título y fecha de la sesión */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    {t("timer_session_header")}
                  </span>
                  {sessionNearestDate && (
                    <span className="text-[10px] font-semibold text-slate-600">
                      {formatSessionDay(sessionNearestDate, t, locale)}
                    </span>
                  )}
                </div>

                {/* Campos siempre editables */}
                <div className="space-y-2.5">
                  {/* Lección */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("study_lesson")}
                    </label>
                    <input
                      type="text"
                      value={sessionLesson}
                      onChange={(e) => setSessionLesson(e.target.value)}
                      placeholder={t("studies_lesson_placeholder")}
                      className={`w-full rounded-xl px-3 py-2 text-sm border-0 shadow-sm focus:outline-none focus:ring-2 ${isRunning ? "bg-white/90 text-slate-900 placeholder:text-slate-400 focus:ring-white/40" : "bg-white text-slate-900 placeholder:text-slate-400 focus:ring-slate-300"}`}
                    />
                  </div>
                  {/* Notas de sesión */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("study_notes")}
                    </label>
                    <textarea
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      placeholder={t("studies_session_notes_placeholder")}
                      rows={2}
                      className={`w-full resize-none rounded-xl px-3 py-2 text-sm border-0 shadow-sm focus:outline-none focus:ring-2 ${isRunning ? "bg-white/90 text-slate-900 placeholder:text-slate-400 focus:ring-white/40" : "bg-white text-slate-900 placeholder:text-slate-400 focus:ring-slate-300"}`}
                    />
                  </div>
                  {/* Archivos */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t("study_files")}
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const selected = Array.from(e.target.files ?? []);
                        setSessionPendingFiles((prev) => [...prev, ...selected.map((file) => ({ file, id: generateId() }))]);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs border-2 border-dashed cursor-pointer text-slate-500"
                    >
                      <Paperclip className="w-3.5 h-3.5" />
                      {t("study_attach_file")}
                    </button>
                    {sessionPendingFiles.map(({ file, id }) => (
                      <div key={id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100">
                        <span className="flex-1 text-xs truncate text-slate-800">{file.name}</span>
                        <button type="button" onClick={() => setSessionPendingFiles((prev) => prev.filter((f) => f.id !== id))} className="cursor-pointer">
                          <X className="w-3 h-3 text-slate-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edición de hora inicial */}
        <div className="flex flex-col items-center gap-2 mt-4">
          <button
            onClick={handleToggleEdit}
            className={`flex items-center gap-1 text-sm font-semibold transition-colors cursor-pointer ${
              isRunning
                ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:text-white/90"
                : "text-slate-800 hover:text-slate-950"
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
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
                className="text-center text-base font-medium bg-muted border border-border rounded-xl px-3 py-1.5 text-foreground"
              />
              {isRunning && (
                <button onClick={handleSaveStartTime} className="text-sm font-medium text-primary hover:underline cursor-pointer">
                  {t("timer_save")}
                </button>
              )}
            </>
          )}
        </div>

        {/* Sección de notas — solo visible mientras el timer está activo */}
        {isRunning && (
          <div className="w-full mt-5 px-1">
            <button
              onClick={() => setNotesOpen((v) => !v)}
              className="w-full flex items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-white/80 border border-white/60 shadow-sm transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 text-slate-700 text-xs font-semibold">
                <StickyNote className="w-3.5 h-3.5" />
                {t("timer_notes")}
                {notesText.trim() && !notesOpen && (
                  <span className="max-w-[140px] truncate text-slate-400 font-normal">{notesText}</span>
                )}
              </span>
              <span className={`text-slate-400 text-[10px] transition-transform duration-200 ${notesOpen ? "rotate-180" : ""}`}>▾</span>
            </button>

            {notesOpen && (
              <div className="mt-2 px-1">
                <textarea
                  value={notesText}
                  onChange={(e) => { setNotesText(e.target.value); setNotesSaved(false); }}
                  placeholder={t("timer_notes_placeholder")}
                  rows={3}
                  className="w-full resize-none rounded-2xl px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 bg-white/90 border-0 shadow-sm focus:outline-none focus:ring-2 focus:ring-white/50"
                />
                <button
                  onClick={() => {
                    onSaveNotes?.(notesText.trim());
                    setNotesSaved(true);
                    setTimeout(() => setNotesSaved(false), 2000);
                  }}
                  className={`mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer border ${notesSaved ? "bg-green-50 border-green-200" : "bg-white/80 border-white/60 shadow-sm"}`}
                >
                  {notesSaved
                    ? <><Check className="w-3.5 h-3.5 text-green-500" /><span className="text-green-700">{t("timer_save")}</span></>
                    : <span className="text-slate-600">{t("timer_notes_save")}</span>
                  }
                </button>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Aviso de sesión pendiente */}
      {pendingPrompt && (
        <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 duration-200">
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-start gap-2">
                <BookOpen className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-foreground leading-snug">
                  {t("clock_saving_session_prefix")}{" "}
                  <span className="font-semibold">{pendingPrompt.contactName}</span>
                  {" "}{t("clock_saving_session_day")}{" "}
                  <span className="font-semibold">
                    {formatSessionDay(pendingPrompt.nextSession.date, t, locale)}
                  </span>
                </p>
              </div>
              <button onClick={() => setPendingPrompt(null)} className="flex-shrink-0 mt-0.5 cursor-pointer">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onEstudioSession?.(pendingPrompt.contactId, pendingPrompt.sessionData);
                  showPostStudyFor(pendingPrompt.contactId);
                  setPendingPrompt(null);
                }}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
              >
                {t("common_yes")}
              </button>
              <button
                onClick={() => {
                  onEstudioSession?.(pendingPrompt.contactId, { ...pendingPrompt.sessionData, forceNew: true });
                  showPostStudyFor(pendingPrompt.contactId);
                  setPendingPrompt(null);
                }}
                className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-medium cursor-pointer"
              >
                {t("clock_new_session")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup post-estudio: notas para la próxima sesión */}
      {postStudy && (
        <div className="fixed bottom-20 left-0 right-0 px-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 duration-300">
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            {/* Barra de cuenta atrás */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-border/40">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${(postStudyCountdown / POST_STUDY_SECONDS) * 100}%` }}
              />
            </div>

            <div className="px-4 pt-5 pb-4 space-y-3">
              {/* Cabecera */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    {t("timer_post_study_header")}
                  </p>
                  <p className="text-sm font-semibold text-foreground truncate">
                    {postStudy.contactName}
                    <span className="text-muted-foreground font-normal"> · {formatSessionDay(postStudy.sessionDate, t, locale)}</span>
                  </p>
                  {postStudy.sessionLesson && (
                    <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{postStudy.sessionLesson}</p>
                  )}
                </div>
                <button
                  onClick={dismissPostStudy}
                  className="flex-shrink-0 p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Textarea de notas */}
              <textarea
                value={postStudy.notes}
                onChange={(e) => {
                  const val = e.target.value;
                  setPostStudy((s) => s ? { ...s, notes: val } : s);
                  setPostStudyCountdown(POST_STUDY_SECONDS);
                }}
                placeholder={t("timer_post_study_placeholder")}
                rows={3}
                autoFocus
                className="w-full resize-none rounded-xl px-3 py-2.5 text-sm bg-muted text-foreground placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-primary/40"
              />

              {/* Nota de voz */}
              <div className="flex items-center gap-2">
                {!voiceNoteDataUrl ? (
                  /* Record button */
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isRecording
                        ? "bg-red-500 text-white"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <Square className="w-3 h-3" />
                        <span className="tabular-nums">
                          {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:{String(recordingSeconds % 60).padStart(2, "0")}
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        {t("voice_note_record")}
                      </>
                    )}
                  </button>
                ) : (
                  /* Playback + delete */
                  <>
                    <button
                      type="button"
                      onClick={toggleVoicePlay}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold"
                    >
                      {isPlayingVoice ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      {t("voice_note_play")}
                    </button>
                    <button
                      type="button"
                      onClick={deleteVoiceNote}
                      className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-destructive"
                      aria-label={t("voice_note_delete")}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Botones */}
              <div className="flex gap-2">
                <button
                  onClick={savePostStudyNotes}
                  className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold cursor-pointer"
                >
                  {t("timer_post_study_save")}
                </button>
                <button
                  onClick={dismissPostStudy}
                  className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium cursor-pointer"
                >
                  {t("timer_post_study_skip")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

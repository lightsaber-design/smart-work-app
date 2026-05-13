import { useState, useEffect, useRef } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { CalendarEvent, EventCategory, AddEventParams, RecurrenceType } from "@/hooks/useCalendarEvents";
import { EstudioContact, EstudioSession, SessionFile } from "@/hooks/useEstudios";
import {
  Plus, Trash2, BellOff, MapPin, Repeat, Clock, CheckCircle2,
  Circle, Pencil, ChevronLeft, ChevronRight, BookOpen, Star,
} from "lucide-react";
import { CampaignGoal, monthKey } from "@/hooks/useSpecialCampaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LocationPicker } from "@/components/LocationPicker";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { useT } from "@/lib/LanguageContext";
import { getTravelReminderMinutes, type TravelReminderSettings } from "@/lib/eventReminders";

import { CATEGORY_LIST as CATEGORIES, CATEGORY_META, CATEGORY_STYLE } from "@/lib/categories";

const SHEET_POSITION_CLASS = "bottom-16";
const SHEET_MAX_HEIGHT_CLASS = "max-h-[80vh]";

type CalendarMode = "daily" | "monthly";

interface CalendarViewProps {
  events: CalendarEvent[];
  onAddEvent: (params: AddEventParams) => void;
  onDeleteEvent: (id: string) => void;
  onToggleCompleted: (id: string) => void;
  onUpdateEvent: (
    id: string,
    updates: {
      date?: Date;
      endTime?: string;
      category?: EventCategory;
      reminderMinutesBefore?: number;
      notified?: boolean;
      completed?: boolean;
      location?: { lat: number; lng: number };
      recurrence?: RecurrenceType;
      parentId?: string;
    }
  ) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  favoritePlaces: FavoritePlace[];
  defaultCenter?: { lat: number; lng: number };
  estudiosContacts?: EstudioContact[];
  onUpdateEstudioSession?: (contactId: string, sessionId: string, data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }) => void;
  precursorHours?: number | null;
  travelReminder?: TravelReminderSettings;
  specialCampaignGoals?: Record<string, CampaignGoal>;
  onSetSpecialCampaign?: (key: string, goal: CampaignGoal | null) => void;
}

const DAY_NAMES_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 22;
const HOUR_HEIGHT = 64;
const HOURS = Array.from({ length: TIMELINE_END_HOUR - TIMELINE_START_HOUR }, (_, i) => i + TIMELINE_START_HOUR);
const TIMELINE_HEIGHT = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * HOUR_HEIGHT;

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}

function formatEventTime(date: Date) {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

function computeDuration(event: CalendarEvent): string | null {
  if (!event.endTime) return null;
  const [h, m] = event.endTime.split(":").map(Number);
  const end = new Date(event.date);
  end.setHours(h, m, 0, 0);
  const diff = end.getTime() - event.date.getTime();
  if (diff <= 0) return null;
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function getWeekDates(anchorDate: Date): Date[] {
  const dow = anchorDate.getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(anchorDate);
    d.setDate(anchorDate.getDate() + mondayOffset + i);
    return d;
  });
}

function dayTotalFromEvents(dayEvents: CalendarEvent[]): { ms: number; hrs: number; mins: number } {
  const ms = dayEvents.filter((e) => e.completed).reduce((acc, e) => {
    if (!e.endTime) return acc;
    const [h, m] = e.endTime.split(":").map(Number);
    const end = new Date(e.date);
    end.setHours(h, m, 0, 0);
    return acc + Math.max(0, end.getTime() - e.date.getTime());
  }, 0);
  return { ms, hrs: Math.floor(ms / 3600000), mins: Math.floor((ms % 3600000) / 60000) };
}

function minutesFromTimelineStart(date: Date): number {
  return (date.getHours() - TIMELINE_START_HOUR) * 60 + date.getMinutes();
}

function eventEndDate(event: CalendarEvent): Date {
  if (!event.endTime) return new Date(event.date.getTime() + 60 * 60_000);
  const [h, m] = event.endTime.split(":").map(Number);
  const end = new Date(event.date);
  end.setHours(h, m, 0, 0);
  return end.getTime() > event.date.getTime() ? end : new Date(event.date.getTime() + 60 * 60_000);
}

function addParamsEndDate(params: AddEventParams): Date {
  if (!params.endTime) return new Date(params.date.getTime() + 60 * 60_000);
  const [h, m] = params.endTime.split(":").map(Number);
  const end = new Date(params.date);
  end.setHours(h, m, 0, 0);
  return end.getTime() > params.date.getTime() ? end : new Date(params.date.getTime() + 60 * 60_000);
}

function isSameCalendarDay(a: Date, b: Date) {
  return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function eventsOverlap(candidate: AddEventParams, event: CalendarEvent): boolean {
  if (!isSameCalendarDay(candidate.date, event.date)) return false;
  const candidateStart = candidate.date.getTime();
  const candidateEnd = addParamsEndDate(candidate).getTime();
  const eventStart = event.date.getTime();
  const eventEnd = eventEndDate(event).getTime();
  return candidateStart < eventEnd && candidateEnd > eventStart;
}

function timelineTopFromMinutes(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT;
}

// ── Event card: dos cajas apiladas ────────────────────────────────────────
function EventCard({
  event,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
  fill = false,
}: {
  event: CalendarEvent;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
  fill?: boolean;
}) {
  const style = CATEGORY_STYLE[event.category] ?? {
    card: "bg-muted border-border",
    border: "border-border",
    dot: "bg-primary",
    dotColor: "hsl(var(--primary))",
    accent: "hsl(var(--primary))",
  };
  const duration = computeDuration(event);
  const timeLabel = `${formatEventTime(event.date)}${event.endTime ? ` – ${event.endTime}` : ""}${duration ? ` · ${duration}` : ""}`;

  if (compact) {
    return (
      <div
        className={`rounded-xl border px-2.5 py-1.5 mb-1.5 ${style.card} ${event.completed ? "opacity-50" : ""} cursor-pointer active:opacity-75 transition-opacity`}
        onClick={onEdit}
      >
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
            className="flex-shrink-0"
          >
            {event.completed
              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
          <span className="text-[11px] font-semibold text-foreground truncate">{event.category}</span>
          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{formatEventTime(event.date)}</span>
          <Pencil className="w-3 h-3 text-muted-foreground flex-shrink-0 ml-1" />
        </div>
      </div>
    );
  }

  return (
    <div className={`${fill ? "h-full" : "mb-2"} rounded-2xl overflow-hidden border shadow-sm ${style.card} ${style.border} ${event.completed ? "opacity-60" : ""}`}
      style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
    >
      {/* Row 1: toggle + name + actions */}
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5 pb-1">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={onToggle} className="flex-shrink-0 cursor-pointer">
            {event.completed
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <Circle className="w-4 h-4 text-muted-foreground" />}
          </button>
          <p className={`text-sm font-semibold text-foreground leading-tight truncate ${event.completed ? "line-through" : ""}`}>
            {event.category}
            {event.recurrence !== "none" && (
              <Repeat className="w-2.5 h-2.5 inline ml-1.5 opacity-50" />
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {event.location && <MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
          <button onClick={onEdit} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors cursor-pointer">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Row 2: time */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5">
        <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] text-muted-foreground">{timeLabel}</span>
      </div>
    </div>
  );
}

// ── Hours heatmap grid ────────────────────────────────────────────────────
function HoursMonthGrid({
  monthBase,
  getEventsForDate,
  onSelectDate,
}: {
  monthBase: Date;
  getEventsForDate: (date: Date) => CalendarEvent[];
  onSelectDate: (date: Date) => void;
}) {
  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;

  const days: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const today = new Date();

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-3">
      <div className="grid grid-cols-7 mb-1">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (!day) return <div key={`empty-${wi}-${di}`} />;
              const dayEvents = getEventsForDate(day);
              const { hrs, mins, ms } = dayTotalFromEvents(dayEvents);
              const isToday = day.toDateString() === today.toDateString();
              let label = "";
              if (ms > 0) {
                label = hrs >= 1 ? (mins >= 30 ? `${hrs}.5h` : `${hrs}h`) : `${mins}m`;
              }
              const bgClass =
                ms >= 5 * 3_600_000 ? "bg-primary text-primary-foreground" :
                ms >= 3 * 3_600_000 ? "bg-primary/75 text-primary-foreground" :
                ms >= 1 * 3_600_000 ? "bg-primary/45 text-foreground" :
                ms > 0              ? "bg-primary/20 text-foreground" :
                                      "bg-muted/40 text-muted-foreground";
              return (
                <button
                  key={day.toDateString()}
                  onClick={() => onSelectDate(day)}
                  className={`relative aspect-square rounded-xl flex items-center justify-center transition-all active:scale-95 ${bgClass} ${
                    isToday ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
                  }`}
                >
                  <span className="absolute top-[3px] right-[5px] text-[8px] font-semibold leading-none opacity-60">
                    {day.getDate()}
                  </span>
                  {label ? (
                    <span className="text-[11px] font-bold leading-none mt-1">{label}</span>
                  ) : (
                    <span className="text-[10px] opacity-20 mt-1">·</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-border/40">
        <span className="text-[9px] text-muted-foreground">Menos</span>
        {["bg-muted/40", "bg-primary/20", "bg-primary/45", "bg-primary/75", "bg-primary"].map((c) => (
          <span key={c} className={`w-3.5 h-3.5 rounded-md ${c}`} />
        ))}
        <span className="text-[9px] text-muted-foreground">Más</span>
      </div>
    </div>
  );
}

// ── Event state monthly grid ──────────────────────────────────────────────
function EventMonthGrid({
  monthBase,
  events,
  selectedDate,
  estudiosContacts,
  onSelectDate,
}: {
  monthBase: Date;
  events: CalendarEvent[];
  selectedDate: Date;
  estudiosContacts: EstudioContact[];
  onSelectDate: (date: Date) => void;
}) {
  const year = monthBase.getFullYear();
  const month = monthBase.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const offset = firstDow === 0 ? 6 : firstDow - 1;

  const days: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (days.length % 7 !== 0) days.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const today = new Date();
  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);

  const estudioDateStrings = new Set(
    estudiosContacts.flatMap((c) =>
      (c.sessions ?? []).filter((s) => s.pending).map((s) => new Date(s.date).toDateString())
    )
  );

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-3">
      <div className="grid grid-cols-7 mb-1">
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="space-y-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1">
            {week.map((day, di) => {
              if (!day) return <div key={`empty-${wi}-${di}`} />;

              const dayMidnight = new Date(day); dayMidnight.setHours(0, 0, 0, 0);
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isToday = day.toDateString() === today.toDateString();
              const isEstudio = estudioDateStrings.has(day.toDateString());

              const dayEvents = events.filter((e) => e.date.toDateString() === day.toDateString());
              const hasCompleted = dayEvents.some((e) => e.completed);
              const hasFuture = dayEvents.some((e) => {
                const d = new Date(e.date); d.setHours(0, 0, 0, 0);
                return d >= todayMidnight && !e.completed;
              });
              const hasPastPending = dayEvents.some((e) => {
                const d = new Date(e.date); d.setHours(0, 0, 0, 0);
                return d < todayMidnight && !e.completed;
              });

              const bgClass = isSelected
                ? "bg-primary text-primary-foreground"
                : hasCompleted
                ? "bg-green-500/25 text-foreground"
                : hasFuture
                ? "bg-primary/20 text-foreground"
                : hasPastPending
                ? "bg-muted-foreground/20 text-muted-foreground"
                : "bg-muted/40 text-muted-foreground";

              const categoryDots = Array.from(
                new Set(dayEvents.slice(0, 3).map((e) => e.category))
              );

              return (
                <button
                  key={day.toDateString()}
                  onClick={() => onSelectDate(day)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 ${bgClass} ${
                    isToday && !isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-card" : ""
                  } ${isEstudio && !isSelected ? "ring-2 ring-pink-400 ring-offset-1 ring-offset-card" : ""}`}
                >
                  <span className={`text-[11px] font-bold leading-none ${isSelected ? "text-primary-foreground" : ""}`}>
                    {day.getDate()}
                  </span>
                  {categoryDots.length > 0 && (
                    <div className="flex items-center gap-[2px]">
                      {categoryDots.map((cat) => (
                        <span
                          key={cat}
                          className="w-[4px] h-[4px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.7)" : CATEGORY_STYLE[cat]?.dotColor ?? "#888" }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/40 flex-wrap">
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="w-3 h-3 rounded-md bg-primary/20" /> Por venir
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="w-3 h-3 rounded-md bg-green-500/25" /> Realizado
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="w-3 h-3 rounded-md bg-muted-foreground/20" /> Pendiente
        </span>
        <span className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <span className="w-3 h-3 rounded-md ring-2 ring-pink-400" /> Estudio
        </span>
      </div>
    </div>
  );
}

export function CalendarView({
  events,
  onAddEvent,
  onDeleteEvent,
  onToggleCompleted,
  onUpdateEvent,
  getEventsForDate,
  favoritePlaces,
  defaultCenter,
  estudiosContacts = [],
  onUpdateEstudioSession,
  precursorHours = null,
  travelReminder = { enabled: false, minutes: 0 },
  specialCampaignGoals = {},
  onSetSpecialCampaign,
}: CalendarViewProps) {
  const t = useT();
  const activeContacts = estudiosContacts.filter((c) => c.active);
  const [mode, setMode] = useState<CalendarMode>("daily");
  const [monthHoursMode, setMonthHoursMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAddConflict, setPendingAddConflict] = useState<{
    params: AddEventParams;
    conflicts: CalendarEvent[];
  } | null>(null);
  const [pendingEstudioConflict, setPendingEstudioConflict] = useState<{
    params: AddEventParams;
    contact: EstudioContact;
    session: EstudioSession;
  } | null>(null);

  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("Predi");
  const [selectedEstudioContactId, setSelectedEstudioContactId] = useState<string>("");
  const [reminder, setReminder] = useState("15");
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [locationMode, setLocationMode] = useState<"none" | "custom">("none");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCategory, setEditCategory] = useState<EventCategory>("Predi");
  const [editEstudioContactId, setEditEstudioContactId] = useState<string>("");
  const [editReminder, setEditReminder] = useState("15");

  // Filtered categories: hide Estudio if no active contacts
  const availableCategories = CATEGORIES.filter(
    (cat) => cat !== "Estudio" || activeContacts.length > 0
  );

  useScrollLock(dialogOpen || !!editEvent || !!pendingAddConflict);

  const selectedEvents = getEventsForDate(selectedDate).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const selectedStudySessions = estudiosContacts
    .flatMap((c) =>
      (c.sessions ?? [])
        .filter((s) => s.pending && new Date(s.date).toDateString() === selectedDate.toDateString())
        .map((s) => ({ ...s, contactName: c.name }))
    )
    .sort((a, b) => a.time.localeCompare(b.time));
  const { hrs: dayTotalHrs, mins: dayTotalMins, ms: dayTotalMs } = dayTotalFromEvents(selectedEvents);
  const isSelectedToday = selectedDate.toDateString() === new Date().toDateString();
  const nowMinutes = isSelectedToday ? minutesFromTimelineStart(new Date()) : null;
  const nowTop = nowMinutes == null ? null : timelineTopFromMinutes(Math.max(0, Math.min((TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60, nowMinutes)));
  const firstSelectedEventMs = selectedEvents[0]?.date.getTime() ?? null;

  const monthBase = new Date();
  monthBase.setDate(1);
  monthBase.setMonth(monthBase.getMonth() + monthOffset);
  const monthLabel = monthBase.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  // Computed once; shared by the precursor banner, campaign toggle, and hours-grid total.
  const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();
  const monthTotalMs = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthBase.getFullYear(), monthBase.getMonth(), i + 1);
    return dayTotalFromEvents(getEventsForDate(d)).ms;
  }).reduce((a, b) => a + b, 0);
  const monthTotalHrs = monthTotalMs / 3_600_000;
  const previewDate = new Date(selectedDate);
  const [previewHours, previewMinutes] = time.split(":").map(Number);
  previewDate.setHours(previewHours, previewMinutes, 0, 0);
  const isAddingPastEvent = previewDate.getTime() < Date.now();
  const travelReminderPreview = getTravelReminderMinutes(previewDate, events, travelReminder);
  const editPreviewDate = editEvent ? new Date(editEvent.date) : null;
  if (editPreviewDate) {
    const [editPreviewHours, editPreviewMinutes] = editTime.split(":").map(Number);
    editPreviewDate.setHours(editPreviewHours, editPreviewMinutes, 0, 0);
  }
  const isEditingPastEvent = editPreviewDate ? editPreviewDate.getTime() < Date.now() : false;
  const eventsForEditReminder = editEvent ? events.filter((event) => event.id !== editEvent.id) : events;
  const editTravelReminderPreview = editPreviewDate ? getTravelReminderMinutes(editPreviewDate, eventsForEditReminder, travelReminder) : 0;

  const openEdit = (event: CalendarEvent) => {
    setEditEvent(event);
    const hh = String(event.date.getHours()).padStart(2, "0");
    const mm = String(event.date.getMinutes()).padStart(2, "0");
    setEditTime(`${hh}:${mm}`);
    setEditEndTime(event.endTime || "");
    setEditCategory(event.category);
    setEditReminder(String(event.reminderMinutesBefore));
    if (event.category === "Estudio" && activeContacts.length === 1) {
      setEditEstudioContactId(activeContacts[0].id);
    } else {
      setEditEstudioContactId("");
    }
  };

  const handleSaveEdit = () => {
    if (!editEvent) return;
    const [h, m] = editTime.split(":").map(Number);
    const newDate = new Date(editEvent.date);
    newDate.setHours(h, m, 0, 0);
    const isPastEvent = newDate.getTime() < Date.now();
    const reminderMinutesBefore = isPastEvent
      ? 0
      : travelReminder.enabled
      ? getTravelReminderMinutes(newDate, eventsForEditReminder, travelReminder)
      : parseInt(editReminder) || 15;
    onUpdateEvent(editEvent.id, {
      date: newDate,
      endTime: editEndTime || undefined,
      category: editCategory,
      reminderMinutesBefore,
      notified: isPastEvent ? true : undefined,
    });
    setEditEvent(null);
  };

  const resetAddForm = () => {
    setTime("09:00"); setEndTime(""); setCategory("Predi"); setReminder("15");
    setSelectedEstudioContactId("");
    setLocation(undefined); setLocationMode("none"); setSelectedFavoriteId(""); setRecurrence("none");
    setDialogOpen(false);
    setPendingAddConflict(null);
    setPendingEstudioConflict(null);
  };

  const commitAdd = (params: AddEventParams) => {
    onAddEvent(params);
    resetAddForm();
  };

  const overwriteAddConflict = () => {
    if (!pendingAddConflict) return;
    const target = pendingAddConflict.conflicts[0];
    const { params } = pendingAddConflict;
    onUpdateEvent(target.id, {
      date: params.date,
      endTime: params.endTime,
      category: params.category,
      reminderMinutesBefore: params.reminderMinutesBefore,
      location: params.location,
      recurrence: params.recurrence,
      parentId: undefined,
      notified: params.date.getTime() < Date.now() ? true : undefined,
      completed: false,
    });
    resetAddForm();
  };

  const handleAdd = () => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(selectedDate);
    date.setHours(hours, minutes, 0, 0);
    const eventLocation =
      locationMode === "custom"
        ? location
        : selectedFavoriteId
        ? favoritePlaces.find((p) => p.id === selectedFavoriteId)?.location
        : undefined;
    const manualReminder = parseInt(reminder) || 15;
    const isPastEvent = date.getTime() < Date.now();
    const reminderMinutesBefore = isPastEvent
      ? 0
      : travelReminder.enabled
      ? getTravelReminderMinutes(date, events, travelReminder)
      : manualReminder;
    const params: AddEventParams = { date, endTime: endTime || undefined, category, reminderMinutesBefore, location: eventLocation, recurrence };

    // Check upcoming study session conflict
    if (category === "Estudio") {
      const contact =
        activeContacts.find((c) => c.id === selectedEstudioContactId) ??
        (activeContacts.length === 1 ? activeContacts[0] : null);
      if (contact) {
        const now = Date.now();
        const nextPending = (contact.sessions ?? [])
          .filter((s) => s.pending && new Date(s.date).getTime() > now - 86_400_000)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null;
        if (nextPending) {
          setPendingEstudioConflict({ params, contact, session: nextPending });
          return;
        }
      }
    }

    const conflicts = events.filter((event) => eventsOverlap(params, event));
    if (conflicts.length > 0) {
      setPendingAddConflict({
        params,
        conflicts: conflicts.sort((a, b) => a.date.getTime() - b.date.getTime()),
      });
      return;
    }
    commitAdd(params);
  };

  const commitAddAfterEstudioCheck = (params: AddEventParams) => {
    const conflicts = events.filter((event) => eventsOverlap(params, event));
    if (conflicts.length > 0) {
      setPendingAddConflict({ params, conflicts: conflicts.sort((a, b) => a.date.getTime() - b.date.getTime()) });
      return;
    }
    commitAdd(params);
  };

  const handleEstudioOverwrite = () => {
    if (!pendingEstudioConflict) return;
    const { params, contact, session } = pendingEstudioConflict;
    const d = params.date;
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    onUpdateEstudioSession?.(contact.id, session.id, {
      date: dateStr,
      time: timeStr,
      lesson: session.lesson,
      notes: session.notes,
      files: session.files ?? [],
    });
    setPendingEstudioConflict(null);
    commitAddAfterEstudioCheck(params);
  };

  const handleEstudioAddNew = () => {
    if (!pendingEstudioConflict) return;
    const { params } = pendingEstudioConflict;
    setPendingEstudioConflict(null);
    commitAddAfterEstudioCheck(params);
  };

  const notifStatus =
    "Notification" in window
      ? Notification.permission === "granted" ? "granted"
      : Notification.permission === "denied" ? "denied"
      : "default"
      : "unsupported";

  const dailyWeekDates = getWeekDates(selectedDate);

  useEffect(() => {
    if (mode !== "daily" || !timelineScrollRef.current) return;
    const targetMinutes = isSelectedToday
      ? minutesFromTimelineStart(new Date())
      : firstSelectedEventMs != null
      ? minutesFromTimelineStart(new Date(firstSelectedEventMs))
      : 0;
    const top = Math.max(0, timelineTopFromMinutes(targetMinutes) - 120);
    timelineScrollRef.current.scrollTo({ top, behavior: "smooth" });
  }, [mode, selectedDate, isSelectedToday, firstSelectedEventMs]);

  return (
    <div className="flex flex-col pb-24">
      {/* Notification banner */}
      {notifStatus !== "granted" && (
        <div className="mx-4 mt-4 rounded-xl bg-accent/50 p-3 flex items-center gap-2 text-sm border border-border">
          <BellOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground text-xs">
            {notifStatus === "denied" ? t("cal_notif_blocked") : t("cal_notif_allow")}
          </span>
          {notifStatus === "default" && (
            <Button size="sm" variant="outline" className="ml-auto text-xs" onClick={() => Notification.requestPermission()}>
              {t("cal_notif_activate")}
            </Button>
          )}
        </div>
      )}

      {/* Mode switcher */}
      <div className="px-5 pt-4">
        <div className="flex rounded-full bg-muted/70 p-1 gap-1 border border-border/40">
          {(["daily", "monthly"] as CalendarMode[]).map((m) => {
            const meta: Record<CalendarMode, { label: string; icon: string }> = {
              daily: { label: "Día", icon: "📅" },
              monthly: { label: "Mes", icon: "🗓" },
            };
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold rounded-full transition-all duration-200 ${
                  mode === m
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-sm leading-none">{meta[m].icon}</span>
                <span>{meta[m].label}</span>
              </button>
            );
          })}
        </div>
      </div>
      {/* Vista diaria */}
      {mode === "daily" && (
        <div className="mx-5 mt-4 pb-8">
          {/* Header: día grande + mes + navegación + botón Hoy */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-end gap-2.5">
              <span className="text-6xl font-black text-foreground leading-none tracking-tight">
                {selectedDate.getDate()}
              </span>
              <div className="pb-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">
                  {selectedDate.getFullYear()}
                </p>
                <p className="text-lg font-bold text-foreground leading-none capitalize">
                  {selectedDate.toLocaleDateString("es-ES", { month: "long" })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => setSelectedDate(new Date())}
                className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md shadow-primary/25"
              >
                Hoy
              </button>
              <button
                onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}
                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Week strip */}
          <div className="flex justify-between mb-5">
            {dailyWeekDates.map((d) => {
              const isSelected = d.toDateString() === selectedDate.toDateString();
              const isToday = d.toDateString() === new Date().toDateString();
              const hasEvents = events.some((e) => e.date.toDateString() === d.toDateString());
              return (
                <button
                  key={d.toDateString()}
                  onClick={() => setSelectedDate(d)}
                  className="flex flex-col items-center gap-1 flex-1"
                >
                  <span className={`text-[10px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                    {DAY_NAMES_SHORT[d.getDay()]}
                  </span>
                  <span
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : isToday
                        ? "text-primary"
                        : "text-foreground"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                  <span className={`h-1 w-1 rounded-full ${hasEvents ? (isSelected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          {/* Total + Add button */}
          <div className="flex items-center justify-between mb-3 px-1">
            <p className="text-xs font-semibold text-muted-foreground">
              {dayTotalMs > 0 ? `${t("cal_total")} ${dayTotalHrs}h ${dayTotalMins}m` : " "}
            </p>
            <button
              onClick={() => setDialogOpen(true)}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md shadow-primary/25"
              aria-label="Add event"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* ── Timeline ── */}
          <div
            ref={timelineScrollRef}
            className="overflow-y-auto"
            style={{ maxHeight: "60vh" }}
          >
            <div className="flex relative" style={{ minHeight: TIMELINE_HEIGHT }}>

              {/* Hour labels column */}
              <div className="w-14 flex-shrink-0 relative" style={{ height: TIMELINE_HEIGHT }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 flex items-start justify-end pr-3"
                    style={{ top: (h - TIMELINE_START_HOUR) * HOUR_HEIGHT - 8 }}
                  >
                    <span className="text-[9px] text-muted-foreground/70 font-medium leading-none">
                      {formatHour(h)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Timeline content — border-l is the vertical rule */}
              <div className="flex-1 relative border-l border-border" style={{ height: TIMELINE_HEIGHT }}>

                {/* Hour grid lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: (h - TIMELINE_START_HOUR) * HOUR_HEIGHT }}
                  />
                ))}

                {/* Current time indicator */}
                {nowTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-20 flex items-center pointer-events-none"
                    style={{ top: nowTop }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 -ml-1.5 shadow-sm" />
                    <div className="flex-1 h-[1.5px] bg-primary" />
                  </div>
                )}

                {/* Calendar events */}
                {selectedEvents.map((event) => {
                  const startMins = minutesFromTimelineStart(event.date);
                  const clampedStart = Math.max(0, Math.min((TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60 - 30, startMins));
                  const endDate = eventEndDate(event);
                  const durationMins = Math.max(30, (endDate.getTime() - event.date.getTime()) / 60000);
                  const top = timelineTopFromMinutes(clampedStart);
                  const height = Math.max(44, (durationMins / 60) * HOUR_HEIGHT);
                  const style = CATEGORY_STYLE[event.category] ?? { accent: "hsl(var(--primary))" };
                  const meta = CATEGORY_META[event.category] ?? { icon: "•", gradient: ["#93c5fd", "#a5b4fc"] as [string, string] };
                  const opacity = event.completed ? 0.45 : 1;
                  return (
                    <div
                      key={event.id}
                      className="absolute left-2 right-2 rounded-xl overflow-hidden cursor-pointer active:opacity-75 transition-opacity"
                      style={{
                        top,
                        height,
                        opacity,
                        background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
                        borderLeftWidth: 3,
                        borderLeftColor: style.accent,
                      }}
                      onClick={() => openEdit(event)}
                    >
                      <div className="px-2.5 py-2 h-full flex flex-col justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm leading-none">{meta.icon}</span>
                            <p className={`text-[11px] font-bold text-foreground leading-tight truncate ${event.completed ? "line-through" : ""}`}>
                              {event.category}
                            </p>
                            {event.recurrence !== "none" && <Repeat className="w-2.5 h-2.5 opacity-50 flex-shrink-0" />}
                          </div>
                          {height > 54 && (
                            <p className="text-[9px] text-foreground/60 mt-0.5 leading-none">
                              {formatEventTime(event.date)}{event.endTime ? ` – ${event.endTime}` : ""}
                            </p>
                          )}
                        </div>
                        {height > 72 && (
                          <div className="flex items-center gap-1 mt-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleCompleted(event.id); }}
                              className="p-0.5"
                            >
                              {event.completed
                                ? <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                                : <Circle className="w-3.5 h-3.5 text-foreground/50" />}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); onDeleteEvent(event.id); }}
                              className="p-0.5 text-foreground/40 ml-auto"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Study sessions */}
                {selectedStudySessions.map((s) => {
                  const [hh, mm] = s.time.split(":").map(Number);
                  const sessionDate = new Date(selectedDate);
                  sessionDate.setHours(hh, mm, 0, 0);
                  const startMins = minutesFromTimelineStart(sessionDate);
                  if (startMins < 0 || startMins >= (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60) return null;
                  const top = timelineTopFromMinutes(startMins);
                  return (
                    <div
                      key={s.id}
                      className="absolute left-2 right-2 rounded-xl overflow-hidden"
                      style={{
                        top,
                        height: 52,
                        background: "linear-gradient(135deg, #fce7f3, #f5d0fe)",
                        borderLeftWidth: 3,
                        borderLeftColor: "#ec4899",
                      }}
                    >
                      <div className="px-2.5 py-2">
                        <div className="flex items-center gap-1">
                          <span className="text-sm leading-none">📖</span>
                          <p className="text-[11px] font-bold text-foreground truncate">{s.contactName}</p>
                        </div>
                        <p className="text-[9px] text-foreground/60 mt-0.5">{s.time}</p>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── MONTHLY VIEW ── */}
      {mode === "monthly" && (
        <>
          <div className="px-5 pt-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setMonthOffset((v) => v - 1)}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <p className="text-base font-bold text-foreground capitalize">{monthLabel}</p>
              <div className="flex items-center gap-1.5">
                <Button size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
                  <Plus className="w-4 h-4" /> {t("cal_add")}
                </Button>
                <button
                  onClick={() => setMonthOffset((v) => v + 1)}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setMonthHoursMode((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all border cursor-pointer ${
                    monthHoursMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {monthHoursMode ? "Horas" : "Normal"}
                </button>
              </div>
            </div>

            {/* ── Banner precursor ── */}
            {precursorHours !== null && (() => {
              const progress = Math.min(1, monthTotalHrs / precursorHours);
              const remaining = Math.max(0, precursorHours - monthTotalHrs);
              const done = progress >= 1;
              return (
                <div className={`mb-4 rounded-2xl border px-3 py-2.5 space-y-2 ${
                  done
                    ? "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800/40"
                    : "border-primary/20 bg-primary/5 dark:bg-primary/10"
                }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className={`w-3.5 h-3.5 ${done ? "text-green-500" : "text-primary"}`} />
                      <span className={`text-xs font-semibold ${done ? "text-green-700 dark:text-green-400" : "text-primary"}`}>
                        Meta precursor · {precursorHours}h/mes
                      </span>
                    </div>
                    <span className={`text-xs font-bold ${done ? "text-green-600 dark:text-green-400" : "text-primary"}`}>
                      {done ? "✓ Completado" : `Faltan ${remaining.toFixed(1)}h`}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] ${done ? "text-green-600 dark:text-green-400" : "text-primary/70"}`}>
                        {monthTotalHrs.toFixed(1)}h de {precursorHours}h
                      </span>
                      <span className={`text-[10px] font-semibold ${done ? "text-green-700 dark:text-green-400" : "text-primary"}`}>
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                    <div className={`h-1.5 rounded-full overflow-hidden ${done ? "bg-green-200 dark:bg-green-800/40" : "bg-primary/20"}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${done ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${progress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Campaña especial toggle (solo si no es precursor) ── */}
            {precursorHours === null && onSetSpecialCampaign && (() => {
              const key = monthKey(monthBase);
              const activeGoal = specialCampaignGoals[key] ?? null;
              const progress = activeGoal ? Math.min(1, monthTotalHrs / activeGoal) : 0;
              return (
                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">Campaña especial</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {([null, 15, 30] as const).map((opt) => (
                        <button
                          key={String(opt)}
                          onClick={() => onSetSpecialCampaign(key, opt as CampaignGoal | null)}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                            activeGoal === opt
                              ? "bg-amber-500 text-white border-amber-500"
                              : "bg-card text-muted-foreground border-border hover:border-amber-300"
                          }`}
                        >
                          {opt === null ? "Off" : `${opt}h`}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeGoal && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-amber-600 dark:text-amber-400">
                          {monthTotalHrs.toFixed(1)}h de {activeGoal}h
                        </span>
                        <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                          {Math.round(progress * 100)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-800/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          <div className="px-5">
            {monthHoursMode ? (
              <>
                <HoursMonthGrid
                  monthBase={monthBase}
                  getEventsForDate={getEventsForDate}
                  onSelectDate={(d) => { setSelectedDate(d); setMode("daily"); }}
                />
                {(() => {
                  if (monthTotalMs === 0) return null;
                  const mHrs = Math.floor(monthTotalMs / 3_600_000);
                  const mMins = Math.floor((monthTotalMs % 3_600_000) / 60_000);
                  return (
                    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">
                        Total del mes: {mHrs}h {mMins}m
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <>
                <EventMonthGrid
                  monthBase={monthBase}
                  events={events}
                  selectedDate={selectedDate}
                  estudiosContacts={estudiosContacts}
                  onSelectDate={(d) => { setSelectedDate(d); setMode("daily"); }}
                />

                {selectedEvents.length > 0 && (
                  <div className="space-y-1.5 mt-3 mb-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      {selectedDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}
                    </p>
                    {selectedEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onToggle={() => onToggleCompleted(event.id)}
                        onEdit={() => openEdit(event)}
                        onDelete={() => onDeleteEvent(event.id)}
                        compact
                      />
                    ))}
                  </div>
                )}
              </>
            )}

          </div>
        </>
      )}

      {/* ── Add event bottom sheet ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          dialogOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setDialogOpen(false)}
      />
      <div
        className={`fixed left-0 right-0 ${SHEET_POSITION_CLASS} max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          dialogOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className={`bg-card rounded-t-3xl border-t border-x border-border shadow-2xl ${SHEET_MAX_HEIGHT_CLASS} flex flex-col`}>
          <button onClick={() => setDialogOpen(false)} className="w-full flex flex-col items-center pt-3 pb-2 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </button>
          <div className="px-5 space-y-4 overflow-y-auto flex-1 pb-2">
            <h2 className="text-base font-bold text-foreground">{t("cal_new_event")}</h2>
            <p className="text-sm text-muted-foreground capitalize -mt-2">
              {selectedDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <div className="space-y-2">
              <Label>{t("cal_category")}</Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  setCategory(v as EventCategory);
                  if (v === "Estudio" && activeContacts.length === 1) {
                    setSelectedEstudioContactId(activeContacts[0].id);
                  } else if (v !== "Estudio") {
                    setSelectedEstudioContactId("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue>
                    {category === "Estudio" && activeContacts.length === 1
                      ? `Estudio – ${activeContacts[0].name}`
                      : category}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat === "Estudio" && activeContacts.length === 1
                        ? `Estudio – ${activeContacts[0].name}`
                        : cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {category === "Estudio" && activeContacts.length > 1 && (
              <div className="space-y-2">
                <Label>Contacto de estudio</Label>
                <Select value={selectedEstudioContactId} onValueChange={setSelectedEstudioContactId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                  <SelectContent>
                    {activeContacts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("cal_start_time")}</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("cal_end_time")} <span className="text-muted-foreground text-xs">({t("cal_optional")})</span></Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("cal_repeat")}</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("cal_no_repeat")}</SelectItem>
                  <SelectItem value="weekly">{t("cal_weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("cal_monthly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isAddingPastEvent && (
              <div className="space-y-2">
                <Label>{t("cal_reminder")}</Label>
                {travelReminder.enabled ? (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                    <p className="text-sm font-medium text-foreground">
                      {travelReminderPreview > 0 ? `${travelReminderPreview} minutes before` : "At start time"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adjusted from travel time so it stays after the previous event.
                    </p>
                  </div>
                ) : (
                  <Select value={reminder} onValueChange={setReminder}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">{t("cal_min_before", { n: 5 })}</SelectItem>
                      <SelectItem value="10">{t("cal_min_before", { n: 10 })}</SelectItem>
                      <SelectItem value="15">{t("cal_min_before", { n: 15 })}</SelectItem>
                      <SelectItem value="30">{t("cal_min_before", { n: 30 })}</SelectItem>
                      <SelectItem value="60">{t("cal_1h_before")}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>{t("cal_location")}</Label>
              <Select
                value={selectedFavoriteId || locationMode}
                onValueChange={(v) => {
                  if (v === "none" || v === "custom") { setLocationMode(v as "none" | "custom"); setSelectedFavoriteId(""); }
                  else { setLocationMode("none"); setSelectedFavoriteId(v); }
                }}
              >
                <SelectTrigger><SelectValue placeholder={t("cal_no_location")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("cal_no_location")}</SelectItem>
                  {favoritePlaces.map((p) => <SelectItem key={p.id} value={p.id}>⭐ {p.name}</SelectItem>)}
                  <SelectItem value="custom">{t("cal_choose_map")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locationMode === "custom" && (
              <LocationPicker value={location} onChange={setLocation} defaultCenter={defaultCenter} />
            )}
          </div>
          <div className="flex-shrink-0 px-5 pt-3 pb-8 border-t border-border bg-card">
            <Button onClick={handleAdd} className="w-full">{t("cal_save_event")}</Button>
          </div>
        </div>
      </div>

      <AlertDialog open={!!pendingAddConflict} onOpenChange={(open) => { if (!open) setPendingAddConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Event already scheduled</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAddConflict && (
                <span className="block space-y-2">
                  <span className="block">
                    The new event overlaps with {pendingAddConflict.conflicts.length === 1 ? "this event" : `${pendingAddConflict.conflicts.length} events`}.
                  </span>
                  <span className="block rounded-lg border border-border bg-muted/40 px-3 py-2 text-foreground">
                    {pendingAddConflict.conflicts[0].category} · {formatEventTime(pendingAddConflict.conflicts[0].date)}
                    {pendingAddConflict.conflicts[0].endTime ? ` - ${pendingAddConflict.conflicts[0].endTime}` : ""}
                  </span>
                  <span className="block">
                    Overwrite it, add the new event in parallel, or cancel.
                  </span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel onClick={() => setPendingAddConflict(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={() => {
                if (pendingAddConflict) commitAdd(pendingAddConflict.params);
              }}
            >
              Add in parallel
            </AlertDialogAction>
            <AlertDialogAction onClick={overwriteAddConflict}>Overwrite</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Edit event bottom sheet ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          editEvent ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditEvent(null)}
      />
      <div
        className={`fixed left-0 right-0 ${SHEET_POSITION_CLASS} max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          editEvent ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className={`bg-card rounded-t-3xl border-t border-x border-border shadow-2xl ${SHEET_MAX_HEIGHT_CLASS} flex flex-col`}>
          <button onClick={() => setEditEvent(null)} className="w-full flex flex-col items-center pt-3 pb-2 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-border" />
          </button>
          {editEvent && (
            <>
              <div className="px-5 space-y-4 overflow-y-auto flex-1 pb-2">
                <h2 className="text-base font-bold text-foreground">{t("cal_edit_event")}</h2>
                <p className="text-sm text-muted-foreground capitalize -mt-2">
                  {editEvent.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <div className="space-y-2">
                  <Label>{t("cal_category")}</Label>
                  <Select
                    value={editCategory}
                    onValueChange={(v) => {
                      setEditCategory(v as EventCategory);
                      if (v === "Estudio" && activeContacts.length === 1) {
                        setEditEstudioContactId(activeContacts[0].id);
                      } else if (v !== "Estudio") {
                        setEditEstudioContactId("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {editCategory === "Estudio" && activeContacts.length === 1
                          ? `Estudio – ${activeContacts[0].name}`
                          : editCategory}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat === "Estudio" && activeContacts.length === 1
                            ? `Estudio – ${activeContacts[0].name}`
                            : cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editCategory === "Estudio" && activeContacts.length > 1 && (
                  <div className="space-y-2">
                    <Label>Contacto de estudio</Label>
                    <Select value={editEstudioContactId} onValueChange={setEditEstudioContactId}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
                      <SelectContent>
                        {activeContacts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t("cal_start_time")}</Label>
                    <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("cal_end_time")} <span className="text-muted-foreground text-xs">({t("cal_optional")})</span></Label>
                    <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                  </div>
                </div>
                {!isEditingPastEvent && (
                  <div className="space-y-2">
                    <Label>{t("cal_reminder")}</Label>
                    {travelReminder.enabled ? (
                      <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {editTravelReminderPreview > 0 ? `${editTravelReminderPreview} minutes before` : "At start time"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Adjusted from travel time so it stays after the previous event.
                        </p>
                      </div>
                    ) : (
                      <Select value={editReminder} onValueChange={setEditReminder}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">{t("cal_min_before", { n: 5 })}</SelectItem>
                          <SelectItem value="10">{t("cal_min_before", { n: 10 })}</SelectItem>
                          <SelectItem value="15">{t("cal_min_before", { n: 15 })}</SelectItem>
                          <SelectItem value="30">{t("cal_min_before", { n: 30 })}</SelectItem>
                          <SelectItem value="60">{t("cal_1h_before")}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 px-5 pt-3 pb-8 border-t border-border bg-card">
                <Button onClick={handleSaveEdit} className="w-full">{t("cal_save_changes")}</Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Estudio session conflict dialog ── */}
      <AlertDialog open={!!pendingEstudioConflict} onOpenChange={(open) => { if (!open) setPendingEstudioConflict(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sesión de estudio programada</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <span className="block space-y-2 text-sm text-muted-foreground">
                {pendingEstudioConflict && (() => {
                  const { contact, session } = pendingEstudioConflict;
                  const sessionDate = new Date(session.date);
                  const dateStr = sessionDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
                  return (
                    <>
                      <span className="block">
                        <strong className="text-foreground">{contact.name}</strong> tiene una sesión programada el{" "}
                        <strong className="text-foreground">{dateStr} a las {session.time}</strong>.
                      </span>
                      <span className="block">¿Este evento es esa sesión (mover la fecha programada) o es una sesión adicional?</span>
                    </>
                  );
                })()}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-col">
            <AlertDialogCancel onClick={() => setPendingEstudioConflict(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-secondary text-secondary-foreground hover:bg-secondary/80"
              onClick={handleEstudioAddNew}
            >
              Añadir como nueva
            </AlertDialogAction>
            <AlertDialogAction onClick={handleEstudioOverwrite}>
              Sobreescribir sesión programada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { CalendarEvent, EventCategory, AddEventParams, RecurrenceType } from "@/hooks/useCalendarEvents";
import { EstudioContact } from "@/hooks/useEstudios";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus, Trash2, BellOff, MapPin, Repeat, Clock, CheckCircle2,
  Circle, Pencil, ChevronLeft, ChevronRight, BookOpen,
} from "lucide-react";
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
import { LocationPicker } from "@/components/LocationPicker";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { useT } from "@/lib/LanguageContext";

const CATEGORIES: EventCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

const CATEGORY_STYLE: Record<EventCategory, { card: string; border: string; dot: string; dotColor: string }> = {
  Predi:   { card: "bg-blue-50 border-blue-200",    border: "border-blue-200",   dot: "bg-blue-500",   dotColor: "#3b82f6" },
  Carrito: { card: "bg-green-50 border-green-200",  border: "border-green-200",  dot: "bg-green-500",  dotColor: "#22c55e" },
  LDC:     { card: "bg-purple-50 border-purple-200", border: "border-purple-200", dot: "bg-purple-500", dotColor: "#a855f7" },
  Visitas: { card: "bg-orange-50 border-orange-200", border: "border-orange-200", dot: "bg-orange-500", dotColor: "#f97316" },
  Estudio: { card: "bg-pink-50 border-pink-200",    border: "border-pink-200",   dot: "bg-pink-500",   dotColor: "#ec4899" },
};

type CalendarMode = "daily" | "monthly";

interface CalendarViewProps {
  events: CalendarEvent[];
  onAddEvent: (params: AddEventParams) => void;
  onDeleteEvent: (id: string) => void;
  onToggleCompleted: (id: string) => void;
  onUpdateEvent: (
    id: string,
    updates: { date?: Date; endTime?: string; category?: EventCategory; reminderMinutesBefore?: number }
  ) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
  favoritePlaces: FavoritePlace[];
  defaultCenter?: { lat: number; lng: number };
  estudiosContacts?: EstudioContact[];
}

const DAY_NAMES_SHORT = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7 AM – 9 PM

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

// ── Event card: dos cajas apiladas ────────────────────────────────────────
function EventCard({
  event,
  onToggle,
  onEdit,
  onDelete,
  compact = false,
}: {
  event: CalendarEvent;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const style = CATEGORY_STYLE[event.category] ?? { card: "bg-muted border-border", border: "border-border", dot: "bg-primary", dotColor: "hsl(var(--primary))" };
  const duration = computeDuration(event);
  const timeLabel = `${formatEventTime(event.date)}${event.endTime ? ` – ${event.endTime}` : ""}${duration ? ` · ${duration}` : ""}`;

  if (compact) {
    return (
      <div className={`rounded-xl border px-2.5 py-1.5 mb-1.5 ${style.card} ${event.completed ? "opacity-50" : ""}`}>
        <div className="flex items-center gap-1.5">
          <button onClick={onToggle} className="flex-shrink-0">
            {event.completed
              ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              : <Circle className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
          <span className="text-[11px] font-semibold text-foreground truncate">{event.category}</span>
          <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{formatEventTime(event.date)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mb-2 ${event.completed ? "opacity-60" : ""}`}>
      {/* Caja 1: nombre / categoría */}
      <div className={`rounded-t-2xl rounded-b-none border-x border-t px-3 py-2.5 ${style.card}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button onClick={onToggle} className="flex-shrink-0">
              {event.completed
                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                : <Circle className="w-4 h-4 text-muted-foreground" />}
            </button>
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
            <p className={`text-sm font-semibold text-foreground leading-tight truncate ${event.completed ? "line-through" : ""}`}>
              {event.category}
              {event.recurrence !== "none" && (
                <Repeat className="w-2.5 h-2.5 inline ml-1.5 opacity-50" />
              )}
            </p>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {event.location && <MapPin className="w-3.5 h-3.5 text-muted-foreground" />}
            <button onClick={onEdit} className="p-1 rounded text-muted-foreground hover:text-primary transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Caja 2: horario / duración */}
      <div className={`rounded-t-none rounded-b-2xl border-x border-b border-t-0 px-3 py-2 bg-background/60 ${style.border}`}>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
          <span className="text-[11px] text-muted-foreground">{timeLabel}</span>
        </div>
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
}: CalendarViewProps) {
  const t = useT();
  const [mode, setMode] = useState<CalendarMode>("daily");
  const [monthHoursMode, setMonthHoursMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [monthOffset, setMonthOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("Predi");
  const [reminder, setReminder] = useState("15");
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [locationMode, setLocationMode] = useState<"none" | "custom">("none");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");

  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCategory, setEditCategory] = useState<EventCategory>("Predi");
  const [editReminder, setEditReminder] = useState("15");

  useScrollLock(dialogOpen || !!editEvent);

  const todayMidnight = new Date(); todayMidnight.setHours(0, 0, 0, 0);
  const selectedMidnight = new Date(selectedDate); selectedMidnight.setHours(0, 0, 0, 0);
  const isAddingPastNoRepeat = selectedMidnight < todayMidnight && recurrence === "none";

  const selectedEvents = getEventsForDate(selectedDate).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
  const { hrs: dayTotalHrs, mins: dayTotalMins, ms: dayTotalMs } = dayTotalFromEvents(selectedEvents);

  const monthBase = new Date();
  monthBase.setDate(1);
  monthBase.setMonth(monthBase.getMonth() + monthOffset);
  const monthLabel = monthBase.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const openEdit = (event: CalendarEvent) => {
    setEditEvent(event);
    const hh = String(event.date.getHours()).padStart(2, "0");
    const mm = String(event.date.getMinutes()).padStart(2, "0");
    setEditTime(`${hh}:${mm}`);
    setEditEndTime(event.endTime || "");
    setEditCategory(event.category);
    setEditReminder(String(event.reminderMinutesBefore));
  };

  const handleSaveEdit = () => {
    if (!editEvent) return;
    const [h, m] = editTime.split(":").map(Number);
    const newDate = new Date(editEvent.date);
    newDate.setHours(h, m, 0, 0);
    onUpdateEvent(editEvent.id, {
      date: newDate,
      endTime: editEndTime || undefined,
      category: editCategory,
      reminderMinutesBefore: parseInt(editReminder) || 15,
    });
    setEditEvent(null);
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
    onAddEvent({ date, endTime: endTime || undefined, category, reminderMinutesBefore: parseInt(reminder) || 15, location: eventLocation, recurrence });
    setTime("09:00"); setEndTime(""); setCategory("Predi"); setReminder("15");
    setLocation(undefined); setLocationMode("none"); setSelectedFavoriteId(""); setRecurrence("none");
    setDialogOpen(false);
  };

  const notifStatus =
    "Notification" in window
      ? Notification.permission === "granted" ? "granted"
      : Notification.permission === "denied" ? "denied"
      : "default"
      : "unsupported";

  const dailyWeekDates = getWeekDates(selectedDate);

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
      <div className="px-4 pt-4">
        <div className="flex rounded-2xl bg-muted p-1 gap-1">
          {(["daily", "monthly"] as CalendarMode[]).map((m) => {
            const labels: Record<CalendarMode, string> = { daily: "Día", monthly: "Mes" };
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {labels[m]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── DAILY VIEW ── */}
      {mode === "daily" && (
        <>
          {/* Container 1: navegación + días de la semana */}
          <div className="mx-4 mt-4 rounded-2xl bg-card/60 border border-border/50 shadow-sm px-4 py-4">
            {/* Date header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 7); setSelectedDate(d); }}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <div className="text-center">
                <p className="text-xs text-muted-foreground capitalize">
                  {selectedDate.toLocaleDateString("es-ES", { weekday: "long" })}
                </p>
                <p className="text-base font-bold text-foreground">
                  {selectedDate.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 7); setSelectedDate(d); }}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Weekly strip */}
            <div className="flex justify-between">
              {dailyWeekDates.map((d) => {
                const isSelected = d.toDateString() === selectedDate.toDateString();
                const isToday = d.toDateString() === new Date().toDateString();
                const hasEvents = events.some((e) => e.date.toDateString() === d.toDateString());
                return (
                  <button
                    key={d.toDateString()}
                    onClick={() => setSelectedDate(d)}
                    className={`flex flex-col items-center gap-1 w-10 py-2 rounded-2xl transition-colors ${
                      isSelected ? "bg-primary" : isToday ? "bg-primary/10" : "hover:bg-muted"
                    }`}
                  >
                    <span className={`text-[9px] font-semibold ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}>
                      {DAY_NAMES_SHORT[d.getDay()]}
                    </span>
                    <span className={`text-sm font-bold ${isSelected ? "text-primary-foreground" : isToday ? "text-primary" : "text-foreground"}`}>
                      {d.getDate()}
                    </span>
                    {hasEvents && !isSelected && <span className="w-1 h-1 rounded-full bg-primary/60" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Container 2: total del día + eventos */}
          <div className="mx-4 mt-3 rounded-2xl bg-card/60 border border-border/50 shadow-sm px-4 pt-3 pb-4">
            {/* Day total + add */}
            <div className="flex items-center justify-between mb-3">
              {dayTotalMs > 0 ? (
                <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold text-primary">
                    {t("cal_total")} {dayTotalHrs}h {dayTotalMins}m
                  </span>
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {selectedEvents.length === 0 ? t("cal_no_events") : `${selectedEvents.length} evento(s)`}
                </span>
              )}
              <Button size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" /> {t("cal_add")}
              </Button>
            </div>

          {/* Timeline */}
          <div className="">
            {HOURS.map((hour) => {
              const hourEvents = selectedEvents.filter((e) => e.date.getHours() === hour);
              const hourEstudios = estudiosContacts
                .flatMap((c) =>
                  (c.sessions ?? [])
                    .filter((s) => s.pending && new Date(s.date).toDateString() === selectedDate.toDateString())
                    .map((s) => ({ ...s, contactName: c.name }))
                )
                .filter((s) => parseInt(s.time.split(":")[0]) === hour);
              return (
                <div key={hour} className="flex gap-3">
                  <div className="w-12 text-right flex-shrink-0 pt-1">
                    <span className="text-[11px] text-muted-foreground">{formatHour(hour)}</span>
                  </div>
                  <div className="flex-1 border-l border-border/40 pl-4 pb-3 min-h-[52px]">
                    {hourEvents.map((event) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        onToggle={() => onToggleCompleted(event.id)}
                        onEdit={() => openEdit(event)}
                        onDelete={() => onDeleteEvent(event.id)}
                      />
                    ))}
                    {hourEstudios.map((s) => (
                      <div key={s.id} className="mb-2">
                        {/* Caja 1: nombre */}
                        <div className="rounded-t-2xl rounded-b-none border-x border-t border-pink-200 bg-pink-50 px-3 py-2.5 flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-pink-500 flex-shrink-0" />
                          <span className="text-[12px] font-semibold text-pink-700 truncate">{s.contactName}</span>
                          {s.lesson && <span className="text-[10px] text-pink-500 truncate flex-1">{s.lesson}</span>}
                        </div>
                        {/* Caja 2: hora */}
                        <div className="rounded-t-none rounded-b-2xl border-x border-b border-t-0 border-pink-200 bg-background/60 px-3 py-1.5 flex items-center gap-1.5">
                          <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-[11px] text-muted-foreground">{s.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          </div>{/* /container 2 */}
        </>
      )}

      {/* ── MONTHLY VIEW ── */}
      {mode === "monthly" && (
        <>
          <div className="px-4 pt-4">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => setMonthOffset((v) => v - 1)}
                className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5 text-muted-foreground" />
              </button>
              <p className="text-base font-bold text-foreground capitalize">{monthLabel}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setMonthOffset((v) => v + 1)}
                  className="w-9 h-9 rounded-full bg-muted flex items-center justify-center"
                >
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </button>
                <button
                  onClick={() => setMonthHoursMode((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold transition-all border ${
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

            {!monthHoursMode && (
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-primary/50" /> {t("cal_upcoming")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/50" /> {t("cal_done")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" /> {t("cal_pending")}
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full ring-2 ring-pink-400" /> Estudio
                </span>
              </div>
            )}
          </div>

          <div className="px-4">
            {monthHoursMode ? (
              <>
                <HoursMonthGrid
                  monthBase={monthBase}
                  getEventsForDate={getEventsForDate}
                  onSelectDate={(d) => { setSelectedDate(d); setMode("daily"); }}
                />
                {(() => {
                  const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();
                  const monthTotalMs = Array.from({ length: daysInMonth }, (_, i) => {
                    const d = new Date(monthBase.getFullYear(), monthBase.getMonth(), i + 1);
                    return dayTotalFromEvents(getEventsForDate(d)).ms;
                  }).reduce((a, b) => a + b, 0);
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
                <div className="rounded-2xl bg-card border border-border shadow-sm p-3 flex justify-center">
                  <Calendar
                    mode="single"
                    month={monthBase}
                    selected={selectedDate}
                    onSelect={(d) => { if (d) { setSelectedDate(d); setMode("daily"); } }}
                    onMonthChange={(m) => {
                      const diff =
                        (m.getFullYear() - new Date().getFullYear()) * 12 +
                        (m.getMonth() - new Date().getMonth());
                      setMonthOffset(diff);
                    }}
                    modifiers={{
                      completedEvent: events.filter((e) => e.completed).map((e) => e.date),
                      pastPending: events.filter((e) => {
                        const d = new Date(e.date); d.setHours(0, 0, 0, 0);
                        const now = new Date(); now.setHours(0, 0, 0, 0);
                        return d < now && !e.completed;
                      }).map((e) => e.date),
                      futureEvent: events.filter((e) => {
                        const d = new Date(e.date); d.setHours(0, 0, 0, 0);
                        const now = new Date(); now.setHours(0, 0, 0, 0);
                        return d >= now && !e.completed;
                      }).map((e) => e.date),
                      estudioSession: estudiosContacts
                        .flatMap((c) => (c.sessions ?? []).filter((s) => s.pending).map((s) => new Date(s.date))),
                    }}
                    modifiersClassNames={{
                      completedEvent: "bg-green-500/20 font-bold text-green-600",
                      pastPending: "bg-muted-foreground/20 font-bold text-muted-foreground",
                      futureEvent: "bg-primary/20 font-bold text-primary",
                      estudioSession: "ring-2 ring-pink-400 ring-offset-1",
                    }}
                    className="pointer-events-auto"
                  />
                </div>

                {selectedEvents.length > 0 && (
                  <div className="space-y-1 mt-3 mb-4">
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

            <div className="flex justify-end mt-3 mb-4">
              <Button size="sm" className="gap-1" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" /> {t("cal_add")}
              </Button>
            </div>
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
        className={`fixed left-0 right-0 bottom-16 max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          dialogOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-card rounded-t-3xl border-t border-x border-border shadow-2xl max-h-[80vh] flex flex-col">
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
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            {!isAddingPastNoRepeat && (
              <div className="space-y-2">
                <Label>{t("cal_reminder")}</Label>
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

      {/* ── Edit event bottom sheet ── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          editEvent ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setEditEvent(null)}
      />
      <div
        className={`fixed left-0 right-0 bottom-0 max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${
          editEvent ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="bg-card rounded-t-3xl border-t border-x border-border shadow-2xl max-h-[90vh] flex flex-col">
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
                  <Select value={editCategory} onValueChange={(v) => setEditCategory(v as EventCategory)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
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
                <div className="space-y-2">
                  <Label>{t("cal_reminder")}</Label>
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
                </div>
              </div>
              <div className="flex-shrink-0 px-5 pt-3 pb-8 border-t border-border bg-card">
                <Button onClick={handleSaveEdit} className="w-full">{t("cal_save_changes")}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

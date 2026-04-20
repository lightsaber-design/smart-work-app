import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent, EventCategory, AddEventParams, RecurrenceType } from "@/hooks/useCalendarEvents";
import { Plus, Trash2, Bell, BellOff, MapPin, Repeat, Clock, X, CheckCircle2, Circle, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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

const categoryColors: Record<EventCategory, string> = {
  Predi: "bg-blue-500",
  Carrito: "bg-green-500",
  LDC: "bg-purple-500",
  Visitas: "bg-orange-500",
  Estudio: "bg-pink-500",
};

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
}

type CalendarTab = "calendar" | "add";

function computeEventDuration(event: CalendarEvent): string | null {
  const start = event.date.getTime();
  if (!event.endTime) return null;
  const [h, m] = event.endTime.split(":").map(Number);
  const endDate = new Date(event.date);
  endDate.setHours(h, m, 0, 0);
  const diffMs = endDate.getTime() - start;
  if (diffMs <= 0) return null;
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

function formatEventTime(date: Date) {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
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
}: CalendarViewProps) {
  const t = useT();
  const [tab, setTab] = useState<CalendarTab>("calendar");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [detailOpen, setDetailOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("Predi");
  const [reminder, setReminder] = useState("15");
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [locationMode, setLocationMode] = useState<"none" | "custom">("none");
  const [selectedFavoriteId, setSelectedFavoriteId] = useState<string>("");

  // Edit state
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);
  const [editTime, setEditTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("");
  const [editCategory, setEditCategory] = useState<EventCategory>("Predi");
  const [editReminder, setEditReminder] = useState("15");

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
      reminderMinutesBefore: parseInt(editReminder),
    });
    setEditEvent(null);
  };

  const selectedEvents = getEventsForDate(selectedDate);

  const eventDates = events.map((e) => e.date);

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const completedEventDates = events.filter((e) => e.completed).map((e) => e.date);
  const pastPendingDates = events.filter((e) => {
    const d = new Date(e.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() < now.getTime() && !e.completed;
  }).map((e) => e.date);
  const futureEventDates = events.filter((e) => {
    const d = new Date(e.date);
    d.setHours(0, 0, 0, 0);
    return d.getTime() >= now.getTime() && !e.completed;
  }).map((e) => e.date);

  const handleDayClick = (d: Date | undefined) => {
    if (d) {
      setSelectedDate(d);
      setDetailOpen(true);
    }
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

    onAddEvent({
      date,
      endTime: endTime || undefined,
      category,
      reminderMinutesBefore: parseInt(reminder),
      location: eventLocation,
      recurrence,
    });
    setTime("09:00");
    setEndTime("");
    setCategory("Predi");
    setReminder("15");
    setShowMap(false);
    setLocation(undefined);
    setLocationMode("none");
    setSelectedFavoriteId("");
    setRecurrence("none");
    setDialogOpen(false);
  };

  const completedDayEvents = selectedEvents.filter((e) => e.completed);
  const dayTotalMs = completedDayEvents.reduce((acc, event) => {
    if (!event.endTime) return acc;
    const start = event.date.getTime();
    const [h, m] = event.endTime.split(":").map(Number);
    const endDate = new Date(event.date);
    endDate.setHours(h, m, 0, 0);
    return acc + Math.max(0, endDate.getTime() - start);
  }, 0);
  const dayTotalHrs = Math.floor(dayTotalMs / 3600000);
  const dayTotalMins = Math.floor((dayTotalMs % 3600000) / 60000);

  const notificationStatus =
    "Notification" in window
      ? Notification.permission === "granted"
        ? "granted"
        : Notification.permission === "denied"
        ? "denied"
        : "default"
      : "unsupported";

  const recurrenceLabel = (r: RecurrenceType) =>
    r === "weekly" ? t('cal_weekly') : r === "monthly" ? t('cal_monthly') : "";

  return (
    <div className="px-4 space-y-4 pb-24">
      {notificationStatus !== "granted" && (
        <div className="rounded-xl bg-accent/50 p-3 flex items-center gap-2 text-sm border border-border">
          <BellOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            {notificationStatus === "denied"
              ? t('cal_notif_blocked')
              : t('cal_notif_allow')}
          </span>
          {notificationStatus === "default" && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-xs"
              onClick={() => Notification.requestPermission()}
            >
              {t('cal_notif_activate')}
            </Button>
          )}
        </div>
      )}

      <div className="rounded-xl bg-card p-4 shadow-sm border border-border flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleDayClick}
          modifiers={{
            completedEvent: completedEventDates,
            pastPending: pastPendingDates,
            futureEvent: futureEventDates,
          }}
          modifiersClassNames={{
            completedEvent: "bg-green-500/20 font-bold text-green-600",
            pastPending: "bg-muted-foreground/20 font-bold text-muted-foreground",
            futureEvent: "bg-primary/20 font-bold text-primary",
          }}
          className="pointer-events-auto"
        />
      </div>

      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary/40" />
            {t('cal_upcoming')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500/40" />
            {t('cal_done')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-muted-foreground/40" />
            {t('cal_pending')}
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          {t('cal_add')}
        </Button>
      </div>

      {/* Day detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDate.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </DialogTitle>
          </DialogHeader>

          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t('cal_no_events')}</p>
          ) : (
            <div className="space-y-4 pt-2">
              {dayTotalMs > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    {t('cal_total')} {dayTotalHrs}h {dayTotalMins}m
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {selectedEvents.map((event) => {
                  const duration = computeEventDuration(event);
                  return (
                    <div
                      key={event.id}
                      className={`rounded-lg p-3 space-y-2 ${event.completed ? "bg-green-500/10 border border-green-500/30" : "bg-secondary/50"}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleCompleted(event.id)}
                            className="flex-shrink-0 transition-colors"
                          >
                            {event.completed ? (
                              <CheckCircle2 className="w-5 h-5 text-green-500" />
                            ) : (
                              <Circle className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                          <span className={`w-2.5 h-2.5 rounded-full ${categoryColors[event.category]}`} />
                          <span className="text-sm font-semibold text-foreground">
                            {event.category}
                          </span>
                          {event.recurrence !== "none" && (
                            <span className="text-xs bg-accent text-accent-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Repeat className="w-3 h-3" />
                              {recurrenceLabel(event.recurrence)}
                            </span>
                          )}
                          {event.location && (
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setDetailOpen(false);
                              openEdit(event);
                            }}
                            className="p-1 rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteEvent(event.id)}
                            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {formatEventTime(event.date)}
                          {event.endTime && ` – ${event.endTime}`}
                        </span>
                        {duration && (
                          <span className="font-medium text-foreground bg-secondary px-1.5 py-0.5 rounded">
                            {duration}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-1 mt-2"
            onClick={() => {
              setDetailOpen(false);
              setDialogOpen(true);
            }}
          >
            <Plus className="w-4 h-4" />
            {t('cal_add_event_day')}
          </Button>
        </DialogContent>
      </Dialog>

      {/* Add event dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cal_new_event')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="text-sm text-muted-foreground">
              {selectedDate.toLocaleDateString("es-ES", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
            <div className="space-y-2">
              <Label>{t('cal_category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('cal_start_time')}</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('cal_end_time')} <span className="text-muted-foreground text-xs">({t('cal_optional')})</span></Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('cal_repeat')}</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('cal_no_repeat')}</SelectItem>
                  <SelectItem value="weekly">{t('cal_weekly')}</SelectItem>
                  <SelectItem value="monthly">{t('cal_monthly')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('cal_reminder')}</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">{t('cal_min_before', { n: 5 })}</SelectItem>
                  <SelectItem value="10">{t('cal_min_before', { n: 10 })}</SelectItem>
                  <SelectItem value="15">{t('cal_min_before', { n: 15 })}</SelectItem>
                  <SelectItem value="30">{t('cal_min_before', { n: 30 })}</SelectItem>
                  <SelectItem value="60">{t('cal_1h_before')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('cal_location')}</Label>
              <Select
                value={selectedFavoriteId || locationMode}
                onValueChange={(v) => {
                  if (v === "none" || v === "custom") {
                    setLocationMode(v as "none" | "custom");
                    setSelectedFavoriteId("");
                  } else {
                    setLocationMode("none");
                    setSelectedFavoriteId(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('cal_no_location')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('cal_no_location')}</SelectItem>
                  {favoritePlaces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      ⭐ {p.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">{t('cal_choose_map')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {locationMode === "custom" && (
              <LocationPicker value={location} onChange={setLocation} defaultCenter={defaultCenter} />
            )}
            <Button onClick={handleAdd} className="w-full">
              {t('cal_save_event')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit event dialog */}
      <Dialog open={!!editEvent} onOpenChange={(o) => !o && setEditEvent(null)}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cal_edit_event')}</DialogTitle>
          </DialogHeader>
          {editEvent && (
            <div className="space-y-4 pt-2">
              <div className="text-sm text-muted-foreground">
                {editEvent.date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <div className="space-y-2">
                <Label>{t('cal_category')}</Label>
                <Select value={editCategory} onValueChange={(v) => setEditCategory(v as EventCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t('cal_start_time')}</Label>
                  <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t('cal_end_time')} <span className="text-muted-foreground text-xs">({t('cal_optional')})</span></Label>
                  <Input type="time" value={editEndTime} onChange={(e) => setEditEndTime(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('cal_reminder')}</Label>
                <Select value={editReminder} onValueChange={setEditReminder}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">{t('cal_min_before', { n: 5 })}</SelectItem>
                    <SelectItem value="10">{t('cal_min_before', { n: 10 })}</SelectItem>
                    <SelectItem value="15">{t('cal_min_before', { n: 15 })}</SelectItem>
                    <SelectItem value="30">{t('cal_min_before', { n: 30 })}</SelectItem>
                    <SelectItem value="60">{t('cal_1h_before')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSaveEdit} className="w-full">
                {t('cal_save_changes')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

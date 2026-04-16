import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent, EventCategory, AddEventParams, RecurrenceType } from "@/hooks/useCalendarEvents";
import { Plus, Trash2, Bell, BellOff, MapPin, Repeat, Clock, X, CheckCircle2, Circle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  getEventsForDate: (date: Date) => CalendarEvent[];
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

const recurrenceLabel = (r: RecurrenceType) =>
  r === "weekly" ? "Semanal" : r === "monthly" ? "Mensual" : "";

export function CalendarView({
  events,
  onAddEvent,
  onDeleteEvent,
  onToggleCompleted,
  getEventsForDate,
}: CalendarViewProps) {
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
    onAddEvent({
      date,
      endTime: endTime || undefined,
      category,
      reminderMinutesBefore: parseInt(reminder),
      location: showMap ? location : undefined,
      recurrence,
    });
    setTime("09:00");
    setEndTime("");
    setCategory("Predi");
    setReminder("15");
    setShowMap(false);
    setLocation(undefined);
    setRecurrence("none");
    setDialogOpen(false);
  };

  const dayTotalMs = selectedEvents.reduce((acc, event) => {
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

  return (
    <div className="px-4 space-y-4 pb-24">
      {notificationStatus !== "granted" && (
        <div className="rounded-xl bg-accent/50 p-3 flex items-center gap-2 text-sm border border-border">
          <BellOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">
            {notificationStatus === "denied"
              ? "Notificaciones bloqueadas. Actívalas en ajustes del navegador."
              : "Permite notificaciones para recibir recordatorios."}
          </span>
          {notificationStatus === "default" && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-xs"
              onClick={() => Notification.requestPermission()}
            >
              Activar
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
            Por venir
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-green-500/40" />
            Realizado
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-muted-foreground/40" />
            Pendiente
          </span>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4" />
          Añadir
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
            <p className="text-sm text-muted-foreground py-4">Sin eventos este día</p>
          ) : (
            <div className="space-y-4 pt-2">
              {dayTotalMs > 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 p-3">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">
                    Total: {dayTotalHrs}h {dayTotalMins}m
                  </span>
                </div>
              )}

              <div className="space-y-3">
                {selectedEvents.map((event) => {
                  const duration = computeEventDuration(event);
                  return (
                    <div
                      key={event.id}
                      className="rounded-lg bg-secondary/50 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
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
                        <button
                          onClick={() => onDeleteEvent(event.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
            Añadir evento este día
          </Button>
        </DialogContent>
      </Dialog>

      {/* Add event dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo evento</DialogTitle>
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
              <Label>Categoría</Label>
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
                <Label>Hora inicio</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Hora fin <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Repetir</Label>
              <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No repetir</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Recordatorio</Label>
              <Select value={reminder} onValueChange={setReminder}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 minutos antes</SelectItem>
                  <SelectItem value="10">10 minutos antes</SelectItem>
                  <SelectItem value="15">15 minutos antes</SelectItem>
                  <SelectItem value="30">30 minutos antes</SelectItem>
                  <SelectItem value="60">1 hora antes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <Label className="text-sm">Añadir ubicación</Label>
              </div>
              <Switch checked={showMap} onCheckedChange={setShowMap} />
            </div>
            {showMap && <LocationPicker value={location} onChange={setLocation} />}
            <Button onClick={handleAdd} className="w-full">
              Guardar evento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent, EventCategory, AddEventParams, RecurrenceType } from "@/hooks/useCalendarEvents";
import { Plus, Trash2, Bell, BellOff, MapPin, Repeat } from "lucide-react";
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

interface CalendarViewProps {
  events: CalendarEvent[];
  onAddEvent: (params: AddEventParams) => void;
  onDeleteEvent: (id: string) => void;
  getEventsForDate: (date: Date) => CalendarEvent[];
}

export function CalendarView({
  events,
  onAddEvent,
  onDeleteEvent,
  getEventsForDate,
}: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [time, setTime] = useState("09:00");
  const [endTime, setEndTime] = useState("");
  const [category, setCategory] = useState<EventCategory>("Predi");
  const [reminder, setReminder] = useState("15");
  const [showMap, setShowMap] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");

  const selectedEvents = getEventsForDate(selectedDate);

  const handleDaySelect = (d: Date | undefined) => {
    if (d) {
      setSelectedDate(d);
      setDialogOpen(true);
    }
  };

  const eventDates = events.map((e) => e.date);

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

  const formatEventTime = (date: Date) =>
    date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const recurrenceLabel = (r: RecurrenceType) =>
    r === "weekly" ? "Semanal" : r === "monthly" ? "Mensual" : "";

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
          onSelect={handleDaySelect}
          modifiers={{ hasEvent: eventDates }}
          modifiersClassNames={{
            hasEvent: "bg-primary/20 font-bold text-primary",
          }}
          className="pointer-events-auto"
        />
      </div>

      <div className="rounded-xl bg-card p-5 shadow-sm border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {selectedDate.toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </h3>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <Plus className="w-4 h-4" />
                Añadir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuevo evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
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
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora fin <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
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
                {showMap && (
                  <LocationPicker value={location} onChange={setLocation} />
                )}
                <Button onClick={handleAdd} className="w-full">
                  Guardar evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin eventos este día</p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-center gap-3 rounded-lg bg-secondary/50 p-3"
              >
                <Bell className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                      {event.category}
                    </span>
                    {event.recurrence !== "none" && (
                      <span className="text-xs font-medium bg-accent text-accent-foreground px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" />
                        {recurrenceLabel(event.recurrence)}
                      </span>
                    )}
                    {event.location && (
                      <MapPin className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatEventTime(event.date)}
                    {event.endTime && ` – ${event.endTime}`}
                    {(() => {
                      const now = Date.now();
                      const start = event.date.getTime();
                      if (now > start) {
                        let end = now;
                        if (event.endTime) {
                          const [h, m] = event.endTime.split(":").map(Number);
                          const endDate = new Date(event.date);
                          endDate.setHours(h, m, 0, 0);
                          end = Math.min(now, endDate.getTime());
                        }
                        const diffMs = end - start;
                        if (diffMs > 0) {
                          const hrs = Math.floor(diffMs / 3600000);
                          const mins = Math.floor((diffMs % 3600000) / 60000);
                          return ` · ${hrs}h ${mins}m`;
                        }
                      }
                      return "";
                    })()}
                    {" · "}Aviso {event.reminderMinutesBefore} min antes
                    {event.notified && " · ✓ Notificado"}
                  </p>
                </div>
                <button
                  onClick={() => onDeleteEvent(event.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

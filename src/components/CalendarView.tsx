import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { CalendarEvent } from "@/hooks/useCalendarEvents";
import { Plus, Trash2, Bell, BellOff } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CalendarViewProps {
  events: CalendarEvent[];
  onAddEvent: (title: string, date: Date, reminderMinutes: number) => void;
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
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("09:00");
  const [reminder, setReminder] = useState("15");

  const selectedEvents = getEventsForDate(selectedDate);

  // Dates that have events (for calendar highlighting)
  const eventDates = events.map((e) => e.date);

  const handleAdd = () => {
    if (!title.trim()) return;
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date(selectedDate);
    date.setHours(hours, minutes, 0, 0);
    onAddEvent(title.trim(), date, parseInt(reminder));
    setTitle("");
    setTime("09:00");
    setReminder("15");
    setDialogOpen(false);
  };

  const formatEventTime = (date: Date) =>
    date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

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
      {/* Notification status */}
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

      {/* Calendar */}
      <div className="rounded-xl bg-card p-4 shadow-sm border border-border flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(d) => d && setSelectedDate(d)}
          modifiers={{ hasEvent: eventDates }}
          modifiersClassNames={{
            hasEvent: "bg-primary/20 font-bold text-primary",
          }}
          className="pointer-events-auto"
        />
      </div>

      {/* Selected date events */}
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
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Nuevo evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    placeholder="Ej: Turno de mañana"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hora</Label>
                  <Input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
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
                <Button onClick={handleAdd} className="w-full" disabled={!title.trim()}>
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
                  <p className="text-sm font-medium text-foreground truncate">
                    {event.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatEventTime(event.date)} · Aviso {event.reminderMinutesBefore} min antes
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

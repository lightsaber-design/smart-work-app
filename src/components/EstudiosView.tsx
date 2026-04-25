import { useState, useRef } from "react";
import {
  BookOpen, Plus, Trash2, CheckCircle2, MapPin, Clock,
  Paperclip, X, FileText, Image, File,
  CalendarPlus, History, ArrowLeft, MoreVertical,
  StickyNote, Pencil, RefreshCw, Archive, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  EstudioContact, EstudioSession, SessionFile,
  ContactFormData, ContactSchedule, ScheduleFrequency,
  getNextOccurrences,
} from "@/hooks/useEstudios";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";
import { saveFile, getFileURL, formatFileSize } from "@/lib/sessionFiles";

/* ── constants ── */
const DAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const FREQ_LABELS: Record<ScheduleFrequency, string> = {
  weekly: "Semanal",
  fortnightly: "Quincenal",
  monthly: "Mensual",
};

/* ── helpers ── */
function formatRelative(isoDate: string): string {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return "hoy";
    if (days === 1) return "ayer";
    if (days < 7) return `hace ${days} días`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `hace ${weeks} semana${weeks > 1 ? "s" : ""}`;
    const months = Math.floor(days / 30);
    return `hace ${months} mes${months > 1 ? "es" : ""}`;
  } catch { return ""; }
}

function formatDateLabel(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-ES", {
    weekday: "short", day: "numeric", month: "long", year: "numeric",
  });
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function isoToDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ── small shared components ── */
function FileTypeIcon({ type }: { type: string }) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  if (type === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function FilePicker({ files, onChange }: {
  files: { file: File; id: string }[];
  onChange: (files: { file: File; id: string }[]) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const add = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files ?? []);
    onChange([...files, ...newFiles.map((f) => ({ file: f, id: crypto.randomUUID() }))]);
    e.target.value = "";
  };
  return (
    <div className="space-y-1.5">
      <input ref={ref} type="file" multiple className="hidden" onChange={add} />
      <button
        onClick={() => ref.current?.click()}
        className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-3 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        <Paperclip className="w-4 h-4" /> Adjuntar archivo
      </button>
      {files.map(({ file, id }) => (
        <div key={id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted">
          <FileTypeIcon type={file.type} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
          </div>
          <button onClick={() => onChange(files.filter((f) => f.id !== id))}>
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
}

/* ── Contact form (add & edit) ── */
function ContactSheet({ contact, favoritePlaces, onSave, onClose }: {
  contact?: EstudioContact;
  favoritePlaces: FavoritePlace[];
  onSave: (data: ContactFormData) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(contact?.name ?? "");
  const [address, setAddress] = useState(contact?.address ?? "");
  const [notes, setNotes] = useState(contact?.notes ?? "");
  const [placeId, setPlaceId] = useState(contact?.favoritePlaceId ?? "none");

  const initFreq: ScheduleFrequency | "none" = contact?.schedule?.frequency ?? "none";
  const [freq, setFreq] = useState<ScheduleFrequency | "none">(initFreq);
  const [schedDay, setSchedDay] = useState(contact?.schedule?.dayOfWeek ?? new Date().getDay());
  const [schedTime, setSchedTime] = useState(contact?.schedule?.time ?? "10:00");
  const [schedLesson, setSchedLesson] = useState(contact?.schedule?.lesson ?? "");

  const handleSave = () => {
    if (!name.trim()) return;
    const schedule: ContactSchedule | undefined =
      freq !== "none"
        ? { frequency: freq, dayOfWeek: schedDay, time: schedTime, lesson: schedLesson.trim() || undefined }
        : undefined;
    onSave({
      name: name.trim(),
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
      favoritePlaceId: placeId !== "none" ? placeId : undefined,
      schedule,
    });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 max-w-md mx-auto z-[90] flex flex-col bg-card rounded-t-3xl border-t border-x shadow-2xl max-h-[90vh]">
        <button className="w-full flex justify-center pt-3 pb-2 flex-shrink-0" onClick={onClose}>
          <div className="w-10 h-1 rounded-full bg-border" />
        </button>
        <div className="px-4 pb-3 flex-shrink-0">
          <h2 className="text-base font-semibold">{contact ? "Editar estudio" : "Nuevo estudio"}</h2>
        </div>

        <div className="px-4 space-y-4 overflow-y-auto flex-1">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input placeholder="Ej: Juan García" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Dirección <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input placeholder="Ej: Calle Mayor 12, 2ºA" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          {favoritePlaces.length > 0 && (
            <div className="space-y-1.5">
              <Label>Ubicación guardada <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
              <Select value={placeId} onValueChange={setPlaceId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar lugar…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin ubicación</SelectItem>
                  {favoritePlaces.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <span className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" />{p.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input placeholder="Ej: Interesado en el libro de Juan" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="space-y-3 pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <Label className="text-sm font-semibold">Repetición automática</Label>
            </div>
            <Select value={freq} onValueChange={(v) => setFreq(v as ScheduleFrequency | "none")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin repetición</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="fortnightly">Quincenal</SelectItem>
                <SelectItem value="monthly">Mensual</SelectItem>
              </SelectContent>
            </Select>

            {freq !== "none" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Día</Label>
                    <Select value={String(schedDay)} onValueChange={(v) => setSchedDay(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((d, i) => (
                          <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hora</Label>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Lección por defecto <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
                  <Input
                    placeholder="Ej: Estudio de la Biblia"
                    value={schedLesson}
                    onChange={(e) => setSchedLesson(e.target.value)}
                  />
                </div>
                <div className="rounded-xl bg-primary/5 border border-primary/20 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Próximas fechas generadas</p>
                  {getNextOccurrences({ frequency: freq, dayOfWeek: schedDay, time: schedTime }, 3).map((d, i) => (
                    <p key={i} className="text-xs text-foreground capitalize">
                      {d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })} · {schedTime}
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="pt-4 pb-20">
            <Button onClick={handleSave} disabled={!name.trim()} className="w-full">
              {contact ? "Guardar cambios" : "Guardar estudio"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Unified session form sheet (add now / schedule / edit) ── */
function SessionEditSheet({ session, contact, onSave, onComplete, onDelete, onClose }: {
  session: EstudioSession | null;
  contact: EstudioContact;
  onSave: (data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }) => void;
  onComplete?: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const isNew = session === null;
  const isPending = session?.pending ?? false;

  const [date, setDate] = useState(session ? isoToDateStr(session.date) : todayDateStr());
  const [time, setTime] = useState(session?.time ?? nowTime());
  const [lesson, setLesson] = useState(session?.lesson ?? "");
  const [notes, setNotes] = useState(session?.notes ?? "");
  const [existingFiles, setExistingFiles] = useState<SessionFile[]>(session?.files ?? []);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; id: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const metas: SessionFile[] = [...existingFiles];
      for (const { file, id } of pendingFiles) {
        await saveFile(id, file);
        metas.push({ id, name: file.name, type: file.type, size: file.size });
      }
      onSave({ date, time, lesson: lesson.trim() || undefined, notes: notes.trim() || undefined, files: metas });
      onClose();
    } finally { setSaving(false); }
  };

  const subtitle = isNew
    ? (isPending ? "Programar sesión" : "Registrar sesión")
    : (isPending ? "Sesión programada" : "Sesión registrada");

  return (
    <>
      <div className="fixed inset-0 z-[80] bg-black/40" onClick={onClose} />
      <div className="fixed left-0 right-0 bottom-0 max-w-md mx-auto z-[90] flex flex-col bg-card rounded-t-3xl border-t border-x shadow-2xl max-h-[90vh]">
        <button className="w-full flex justify-center pt-3 pb-2 flex-shrink-0" onClick={onClose}>
          <div className="w-10 h-1 rounded-full bg-border" />
        </button>
        <div className="px-4 pb-3 flex-shrink-0">
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <h2 className="text-base font-semibold">{contact.name}</h2>
        </div>

        <div className="px-4 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora</Label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Lección <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              placeholder="Ej: Cap. 3 — La esperanza de la resurrección"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Notas <span className="text-muted-foreground font-normal text-xs">(opcional)</span></Label>
            <Input
              placeholder="Ej: Mostró interés en el tema de la familia"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {existingFiles.length > 0 && (
            <div className="space-y-1.5">
              <Label>Archivos</Label>
              <div className="space-y-1">
                {existingFiles.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted">
                    <FileTypeIcon type={f.type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                    <button
                      onClick={async () => {
                        const url = await getFileURL(f.id);
                        if (url) window.open(url, "_blank");
                      }}
                    >
                      <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => setExistingFiles(existingFiles.filter((ef) => ef.id !== f.id))}>
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>
              {existingFiles.length > 0 ? "Añadir archivos" : "Archivos"}
              <span className="text-muted-foreground font-normal text-xs ml-1">(opcional)</span>
            </Label>
            <FilePicker files={pendingFiles} onChange={setPendingFiles} />
          </div>
        </div>

        <div className="flex-shrink-0 px-4 pt-3 pb-20 border-t border-border bg-card mt-2 space-y-2">
          <Button onClick={handleSave} disabled={saving || !date} className="w-full">
            {saving ? "Guardando…" : isNew ? (isPending ? "Programar sesión" : "Guardar sesión") : "Guardar cambios"}
          </Button>
          {!isNew && isPending && onComplete && (
            <Button
              variant="outline"
              onClick={() => { onComplete(); onClose(); }}
              className="w-full gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Marcar como completada
            </Button>
          )}
          {!isNew && (
            <Button
              variant="ghost"
              onClick={() => { onDelete(); onClose(); }}
              className="w-full text-destructive gap-2"
            >
              <Trash2 className="w-4 h-4" /> Eliminar sesión
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

/* ── History session card (click to open) ── */
function HistorySessionCard({ session, onOpen }: { session: EstudioSession; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl border bg-card border-border p-4 active:scale-[0.99] transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground capitalize">{formatDateLabel(session.date)}</p>
          {session.lesson
            ? <p className="text-sm font-medium text-foreground mt-0.5">{session.lesson}</p>
            : <p className="text-sm text-muted-foreground mt-0.5 italic">Sin lección registrada</p>
          }
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-muted-foreground">{session.time}</span>
          {session.notes && <StickyNote className="w-3.5 h-3.5 text-muted-foreground" />}
          {(session.files ?? []).length > 0 && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">
              {session.files.length} archivo{session.files.length !== 1 ? "s" : ""}
            </span>
          )}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    </button>
  );
}

/* ── Contact detail view ── */
function ContactDetail({ contact, favoritePlaces, onBack, onUpdate, onDelete, onArchive, onUnarchive,
  onAddSession, onUpdateSession, onGenerateScheduled, onDeleteSession, onCompleteSession,
}: {
  contact: EstudioContact;
  favoritePlaces: FavoritePlace[];
  onBack: () => void;
  onUpdate: (data: ContactFormData) => void;
  onDelete: (id: string) => void;
  onArchive: (id: string) => void;
  onUnarchive: (id: string) => void;
  onAddSession: (contactId: string, data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[] }) => void;
  onUpdateSession: (contactId: string, sessionId: string, data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }) => void;
  onGenerateScheduled: (contactId: string) => void;
  onDeleteSession: (contactId: string, sessionId: string) => void;
  onCompleteSession: (contactId: string, sessionId: string) => void;
}) {
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<EstudioSession | null>(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const doneSessions = (contact.sessions ?? [])
    .filter((s) => !s.pending)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const upcomingSessions = (contact.sessions ?? [])
    .filter((s) => s.pending)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const hasSessions = contact.sessions.length > 0;
  const savedPlace = contact.favoritePlaceId
    ? favoritePlaces.find((p) => p.id === contact.favoritePlaceId)
    : null;
  const locationLabel = savedPlace?.name ?? contact.address ?? null;
  const sessionToday = doneSessions.some((s) => new Date(s.date).toDateString() === new Date().toDateString());

  return (
    <div className="pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-xl border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${contact.active ? "bg-green-500" : "bg-muted-foreground"}`} />
              <h2 className="text-base font-bold text-foreground truncate">{contact.name}</h2>
              {!contact.active && (
                <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  Archivado
                </span>
              )}
            </div>
            {locationLabel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{locationLabel}
              </p>
            )}
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
          >
            <Pencil className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-[30]" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-10 z-[40] bg-card rounded-2xl shadow-xl border border-border overflow-hidden min-w-[180px]">
                  {contact.active ? (
                    <button
                      onClick={() => { onArchive(contact.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left active:bg-muted"
                    >
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      Archivar estudio
                    </button>
                  ) : (
                    <button
                      onClick={() => { onUnarchive(contact.id); setMenuOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left active:bg-muted"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Reactivar estudio
                    </button>
                  )}
                  {!hasSessions && (
                    <>
                      <div className="h-px bg-border mx-3" />
                      <button
                        onClick={() => { onDelete(contact.id); onBack(); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm text-left text-destructive active:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Eliminar
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {contact.active && (
          <div className="mt-3">
            <Button size="sm" onClick={() => setNewSessionOpen(true)} className="w-full gap-1.5">
              <BookOpen className="w-4 h-4" />
              {sessionToday ? "Añadir otra sesión" : "Registrar sesión de hoy"}
            </Button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* ── Schedule banner ── */}
        {contact.schedule && (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-xs font-semibold text-primary">
                    {FREQ_LABELS[contact.schedule.frequency]} · {DAY_NAMES[contact.schedule.dayOfWeek]} · {contact.schedule.time}
                  </p>
                  {contact.schedule.lesson && (
                    <p className="text-xs text-muted-foreground">{contact.schedule.lesson}</p>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs flex-shrink-0"
                onClick={() => onGenerateScheduled(contact.id)}
              >
                Generar sesiones
              </Button>
            </div>
            <div className="space-y-0.5">
              {getNextOccurrences(contact.schedule, 3).map((d, i) => (
                <p key={i} className="text-xs text-muted-foreground capitalize">
                  • {d.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })} · {contact.schedule!.time}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* ── Próximas sesiones ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarPlus className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Próximas sesiones</h3>
            {upcomingSessions.length > 0 && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                {upcomingSessions.length}
              </span>
            )}
          </div>
          {upcomingSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">Sin sesiones programadas</p>
              <p className="text-xs text-muted-foreground mt-1">Usa "Generar sesiones" para crear las próximas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(showAllUpcoming ? upcomingSessions : upcomingSessions.slice(0, 1)).map((s) => {
                const isPast = new Date(s.date) < new Date() && new Date(s.date).toDateString() !== new Date().toDateString();
                return (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`w-full text-left rounded-2xl border p-4 space-y-1 active:scale-[0.99] transition-all ${
                      isPast ? "bg-orange-50 border-orange-200" : "bg-primary/5 border-primary/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground capitalize">{formatDateLabel(s.date)}</p>
                        {s.lesson && <p className="text-sm font-medium text-foreground mt-0.5">{s.lesson}</p>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">{s.time}</span>
                        {isPast && (
                          <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">
                            Pendiente
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </button>
                );
              })}
              {!showAllUpcoming && upcomingSessions.length > 1 && (
                <button
                  onClick={() => setShowAllUpcoming(true)}
                  className="w-full text-center text-xs font-medium text-primary py-2"
                >
                  Ver {upcomingSessions.length - 1} más →
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Historial ── */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">Historial</h3>
            {doneSessions.length > 0 && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-semibold">
                {doneSessions.length}
              </span>
            )}
          </div>
          {doneSessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center">
              <p className="text-xs text-muted-foreground">Sin sesiones registradas</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(showAllHistory ? doneSessions : doneSessions.slice(0, 1)).map((s) => (
                <HistorySessionCard
                  key={s.id}
                  session={s}
                  onOpen={() => setSelectedSession(s)}
                />
              ))}
              {!showAllHistory && doneSessions.length > 1 && (
                <button
                  onClick={() => setShowAllHistory(true)}
                  className="w-full text-center text-xs font-medium text-muted-foreground py-2"
                >
                  Ver {doneSessions.length - 1} más →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── New session sheet (registro rápido) ── */}
      {newSessionOpen && (
        <SessionEditSheet
          session={null}
          contact={contact}
          onSave={(data) => onAddSession(contact.id, { time: data.time, lesson: data.lesson, notes: data.notes, files: data.files })}
          onDelete={() => {}}
          onClose={() => setNewSessionOpen(false)}
        />
      )}

      {/* ── Edit existing session sheet ── */}
      {selectedSession && (
        <SessionEditSheet
          session={selectedSession}
          contact={contact}
          onSave={(data) => onUpdateSession(contact.id, selectedSession.id, data)}
          onComplete={selectedSession.pending ? () => onCompleteSession(contact.id, selectedSession.id) : undefined}
          onDelete={() => onDeleteSession(contact.id, selectedSession.id)}
          onClose={() => setSelectedSession(null)}
        />
      )}

      {editOpen && (
        <ContactSheet contact={contact} favoritePlaces={favoritePlaces} onSave={onUpdate} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}

/* ── Contact card (list item) ── */
function ContactCard({ contact, favoritePlaces, onClick }: {
  contact: EstudioContact;
  favoritePlaces: FavoritePlace[];
  onClick: () => void;
}) {
  const doneSessions = (contact.sessions ?? []).filter((s) => !s.pending)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const lastSession = doneSessions[0] ?? null;
  const upcomingCount = (contact.sessions ?? []).filter((s) => s.pending).length;
  const savedPlace = contact.favoritePlaceId
    ? favoritePlaces.find((p) => p.id === contact.favoritePlaceId)
    : null;
  const locationLabel = savedPlace?.name ?? contact.address ?? null;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-2xl border p-4 space-y-2 transition-all active:scale-[0.99] ${
        contact.active ? "bg-card border-border" : "bg-muted/40 border-border/50"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${contact.active ? "bg-green-500" : "bg-muted-foreground"}`} />
          <span className={`font-semibold text-sm truncate ${contact.active ? "text-foreground" : "text-muted-foreground"}`}>
            {contact.name}
          </span>
          {!contact.active && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex-shrink-0">
              Archivado
            </span>
          )}
          {contact.schedule && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full flex-shrink-0 flex items-center gap-0.5">
              <RefreshCw className="w-2.5 h-2.5" />
              {FREQ_LABELS[contact.schedule.frequency]}
            </span>
          )}
        </div>
        <ArrowLeft className="w-4 h-4 text-muted-foreground rotate-180 flex-shrink-0" />
      </div>
      {locationLabel && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </p>
      )}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="w-3 h-3" />
          {doneSessions.length} sesión{doneSessions.length !== 1 ? "es" : ""}
        </span>
        {lastSession && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelative(lastSession.date)}
          </span>
        )}
        {upcomingCount > 0 && (
          <span className="flex items-center gap-1 text-primary font-medium">
            <CalendarPlus className="w-3 h-3" />
            {upcomingCount} próxima{upcomingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </button>
  );
}

/* ── Main view ── */
interface EstudiosViewProps {
  contacts: EstudioContact[];
  favoritePlaces: FavoritePlace[];
  onAddContact: (data: ContactFormData) => void;
  onUpdateContact: (id: string, data: ContactFormData) => void;
  onDeleteContact: (id: string) => void;
  onArchiveContact: (id: string) => void;
  onUnarchiveContact: (id: string) => void;
  onAddSession: (contactId: string, data?: { time?: string; lesson?: string; notes?: string; files?: SessionFile[] }) => void;
  onUpdateSession: (contactId: string, sessionId: string, data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }) => void;
  onGenerateScheduled: (contactId: string) => void;
  onDeleteSession: (contactId: string, sessionId: string) => void;
  onCompleteSession: (contactId: string, sessionId: string) => void;
  onToggleActive: (id: string) => void;
}

export function EstudiosView({
  contacts, favoritePlaces,
  onAddContact, onUpdateContact, onDeleteContact, onArchiveContact, onUnarchiveContact,
  onAddSession, onUpdateSession, onGenerateScheduled, onDeleteSession, onCompleteSession,
}: EstudiosViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const selectedContact = selectedId ? contacts.find((c) => c.id === selectedId) ?? null : null;

  const active = contacts.filter((c) => c.active);
  const archived = contacts.filter((c) => !c.active);

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        favoritePlaces={favoritePlaces}
        onBack={() => setSelectedId(null)}
        onUpdate={(data) => onUpdateContact(selectedContact.id, data)}
        onDelete={(id) => { onDeleteContact(id); setSelectedId(null); }}
        onArchive={onArchiveContact}
        onUnarchive={onUnarchiveContact}
        onAddSession={onAddSession}
        onUpdateSession={onUpdateSession}
        onGenerateScheduled={onGenerateScheduled}
        onDeleteSession={onDeleteSession}
        onCompleteSession={onCompleteSession}
      />
    );
  }

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Estudios activos</p>
            <p className="text-lg font-bold text-foreground leading-none">{active.length}</p>
          </div>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Añadir
        </Button>
      </div>

      <div className="px-4 space-y-3 mt-2">
        {contacts.length === 0 && (
          <div className="text-center py-16 space-y-2">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">Sin estudios registrados</p>
            <p className="text-xs text-muted-foreground">Pulsa Añadir para registrar tu primer estudio</p>
          </div>
        )}
        {active.map((c) => (
          <ContactCard key={c.id} contact={c} favoritePlaces={favoritePlaces} onClick={() => setSelectedId(c.id)} />
        ))}
        {archived.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Archivados</p>
            {archived.map((c) => (
              <ContactCard key={c.id} contact={c} favoritePlaces={favoritePlaces} onClick={() => setSelectedId(c.id)} />
            ))}
          </>
        )}
      </div>

      {addOpen && (
        <ContactSheet
          favoritePlaces={favoritePlaces}
          onSave={(data) => { onAddContact(data); setAddOpen(false); }}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

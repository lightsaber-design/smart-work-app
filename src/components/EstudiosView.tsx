import { useState } from "react";
import { BookOpen, Plus, Trash2, CheckCircle2, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstudioContact } from "@/hooks/useEstudios";
import { FavoritePlace } from "@/hooks/useFavoritePlaces";

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "hace 1 semana";
  if (weeks < 5) return `hace ${weeks} semanas`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? "es" : ""}`;
}

interface ContactCardProps {
  contact: EstudioContact;
  favoritePlaces: FavoritePlace[];
  onAddSession: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string) => void;
}

function ContactCard({ contact, favoritePlaces, onAddSession, onDelete, onToggleActive }: ContactCardProps) {
  const lastSession = contact.sessions.at(-1);
  const todayStr = new Date().toDateString();
  const sessionToday = contact.sessions.some(
    (s) => new Date(s.date).toDateString() === todayStr
  );
  const savedPlace = contact.favoritePlaceId
    ? favoritePlaces.find((p) => p.id === contact.favoritePlaceId)
    : null;
  const locationLabel = savedPlace?.name ?? contact.address;

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${contact.active ? "bg-card border-border" : "bg-muted/40 border-border/50"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${contact.active ? "bg-green-500" : "bg-muted-foreground"}`} />
          <span className={`font-semibold text-sm truncate ${contact.active ? "text-foreground" : "text-muted-foreground"}`}>
            {contact.name}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onToggleActive(contact.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CheckCircle2 className={`w-4 h-4 ${contact.active ? "text-green-500" : ""}`} />
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {locationLabel && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{locationLabel}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="w-3 h-3" />
            {contact.sessions.length} sesión{contact.sessions.length !== 1 ? "es" : ""}
          </span>
          {lastSession && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelative(lastSession.date)}
            </span>
          )}
        </div>
        {contact.active && (
          <button
            onClick={() => onAddSession(contact.id)}
            disabled={sessionToday}
            className={`text-xs font-medium px-3 py-1.5 rounded-xl transition-colors ${
              sessionToday
                ? "bg-green-100 text-green-600 cursor-default"
                : "bg-primary/10 text-primary active:bg-primary/20"
            }`}
          >
            {sessionToday ? "✓ Registrada" : "Sesión hoy"}
          </button>
        )}
      </div>
    </div>
  );
}

interface EstudiosViewProps {
  contacts: EstudioContact[];
  favoritePlaces: FavoritePlace[];
  onAddContact: (name: string, address?: string, notes?: string, favoritePlaceId?: string) => void;
  onDeleteContact: (id: string) => void;
  onAddSession: (id: string) => void;
  onToggleActive: (id: string) => void;
}

export function EstudiosView({ contacts, favoritePlaces, onAddContact, onDeleteContact, onAddSession, onToggleActive }: EstudiosViewProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [favoritePlaceId, setFavoritePlaceId] = useState<string>("");

  const active = contacts.filter((c) => c.active);
  const inactive = contacts.filter((c) => !c.active);

  const handleSave = () => {
    if (!name.trim()) return;
    onAddContact(name, address, notes, favoritePlaceId === "none" || !favoritePlaceId ? undefined : favoritePlaceId);
    setName("");
    setAddress("");
    setNotes("");
    setFavoritePlaceId("");
    setSheetOpen(false);
  };

  const handleClose = () => {
    setSheetOpen(false);
    setName("");
    setAddress("");
    setNotes("");
    setFavoritePlaceId("");
  };

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
        <Button size="sm" onClick={() => setSheetOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Añadir
        </Button>
      </div>

      <div className="px-4 space-y-3 mt-2">
        {contacts.length === 0 && (
          <div className="text-center py-12 space-y-2">
            <BookOpen className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-sm font-medium text-foreground">Sin estudios registrados</p>
            <p className="text-xs text-muted-foreground">Pulsa Añadir para registrar tu primer estudio</p>
          </div>
        )}
        {active.map((c) => (
          <ContactCard key={c.id} contact={c} favoritePlaces={favoritePlaces} onAddSession={onAddSession} onDelete={onDeleteContact} onToggleActive={onToggleActive} />
        ))}
        {inactive.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-2">Inactivos</p>
            {inactive.map((c) => (
              <ContactCard key={c.id} contact={c} favoritePlaces={favoritePlaces} onAddSession={onAddSession} onDelete={onDeleteContact} onToggleActive={onToggleActive} />
            ))}
          </>
        )}
      </div>

      {sheetOpen && <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />}

      <div className={`fixed left-0 right-0 bottom-0 max-w-md mx-auto z-40 transition-transform duration-300 ease-out ${sheetOpen ? "translate-y-0" : "translate-y-full"}`}>
        <div className="bg-card rounded-t-3xl border-t border-x shadow-2xl flex flex-col max-h-[85vh]">
          {/* Handle */}
          <button className="w-full flex flex-col items-center pt-3 pb-2 flex-shrink-0" onClick={handleClose}>
            <div className="w-10 h-1 rounded-full bg-border" />
          </button>

          {/* Scrollable fields */}
          <div className="px-4 space-y-4 overflow-y-auto flex-1 pb-2">
            <h2 className="text-base font-semibold text-foreground">Nuevo estudio</h2>
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input placeholder="Ej: Juan García" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Dirección <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input placeholder="Ej: Calle Mayor 12, 2ºA" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            {favoritePlaces.length > 0 && (
              <div className="space-y-2">
                <Label>Ubicación <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Select value={favoritePlaceId} onValueChange={setFavoritePlaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar lugar guardado…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin ubicación</SelectItem>
                    {favoritePlaces.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5" />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Notas <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input placeholder="Ej: Interesado en el libro de Juan" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Fixed footer — always visible above the nav bar */}
          <div className="flex-shrink-0 px-4 pt-3 pb-20 border-t border-border bg-card">
            <Button onClick={handleSave} disabled={!name.trim()} className="w-full">
              Guardar estudio
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

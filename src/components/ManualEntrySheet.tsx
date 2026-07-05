import { useState, useCallback } from "react";
import { X, MapPin, RotateCcw, StickyNote, Loader2, Pencil } from "lucide-react";
import type { WorkCategory } from "@/hooks/useTimeTracker";
import type { AddEventParams } from "@/hooks/useCalendarEvents";
import type { CategoryConfig } from "@/lib/categories";
import { getCategoryLabel, getCategoryMeta } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { useFavoritePlaces } from "@/hooks/useFavoritePlaces";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;
type RecurrenceType = "none" | "weekly" | "monthly";

export interface ManualEntrySheetProps {
  categoryConfigs: CategoryConfig[];
  estudiosContacts?: { id: string; name: string }[];
  /** Entradas ya fichadas, para avisar si la nueva se solapa con alguna. */
  existingEntries?: { startTime: Date; endTime: Date | null }[];
  onSavePast: (start: Date, end: Date, category: WorkCategory, description: string, location?: { lat: number; lng: number }) => void;
  onSaveFuture: (params: AddEventParams) => void;
  onClose: () => void;
  t: TranslateFn;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nowTimeStr(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60000);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function parseDateTimeToMs(dateStr: string, timeStr: string): number {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);
  return new Date(y, mo - 1, d, h, m, 0, 0).getTime();
}

function isFuture(dateStr: string, timeStr: string) {
  return parseDateTimeToMs(dateStr, timeStr) > Date.now();
}

function diffToStr(startMs: number, endMs: number): string {
  const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function addDurToTime(timeStr: string, durStr: string): string {
  const [th, tm] = timeStr.split(":").map(Number);
  const [dh, dm] = (durStr || "00:00").split(":").map(Number);
  const total = (th || 0) * 60 + (tm || 0) + (dh || 0) * 60 + (dm || 0);
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function overlapsExisting(
  startMs: number,
  endMs: number,
  entries: { startTime: Date; endTime: Date | null }[]
): boolean {
  return entries.some((e) => {
    const entryStart = e.startTime.getTime();
    // Una entrada aún en marcha (sin fichar salida) ocupa hasta ahora.
    const entryEnd = e.endTime ? e.endTime.getTime() : Date.now();
    return entryStart < endMs && entryEnd > startMs;
  });
}

function formatDateLabel(dateStr: string): string {
  if (!dateStr) return "";
  const [y, mo, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
}

// ─── component ──────────────────────────────────────────────────────────────

export function ManualEntrySheet({ categoryConfigs, estudiosContacts = [], existingEntries = [], onSavePast, onSaveFuture, onClose, t }: ManualEntrySheetProps) {
  const activeCategories = categoryConfigs.filter((c) => c.active);
  const { places: favoritePlaces } = useFavoritePlaces();

  const [date, setDate] = useState(todayStr);
  const [editingDate, setEditingDate] = useState(false);
  const [startTime, setStartTime] = useState(() => nowTimeStr(-60));
  const [endTime, setEndTime] = useState(() => nowTimeStr(0));
  const [duration, setDuration] = useState("01:00");
  const [category, setCategory] = useState<WorkCategory>(activeCategories[0]?.name ?? "Predi");
  const [contactId, setContactId] = useState(estudiosContacts[0]?.id ?? "");
  const [lesson, setLesson] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locLoading, setLocLoading] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const future = isFuture(date, startTime);
  const isEstudio = category === "Estudio";

  // ─── reactive time fields ─────────────────────────────────────────────────

  const onStartChange = useCallback((val: string) => {
    setStartTime(val);
    setEndTime(addDurToTime(val, duration));
  }, [duration]);

  const onDurationChange = useCallback((val: string) => {
    setDuration(val);
    if (/^\d{1,2}:\d{2}$/.test(val)) {
      setEndTime(addDurToTime(startTime, val));
    }
  }, [startTime]);

  const onEndChange = useCallback((val: string) => {
    setEndTime(val);
    const startMs = parseDateTimeToMs(date, startTime);
    const endMs = parseDateTimeToMs(date, val);
    setDuration(diffToStr(startMs, endMs));
  }, [date, startTime]);

  // ─── location ─────────────────────────────────────────────────────────────

  const captureGPS = useCallback(() => {
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocLoading(false); },
      () => setLocLoading(false)
    );
  }, []);

  // ─── save ─────────────────────────────────────────────────────────────────

  const handleSave = () => {
    setError(null);
    const startMs = parseDateTimeToMs(date, startTime);
    const start = new Date(startMs);

    if (future) {
      onSaveFuture({
        date: start,
        endTime,
        category,
        reminderMinutesBefore: 15,
        location: location ?? undefined,
        recurrence,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    const endMs = parseDateTimeToMs(date, endTime);
    const adjustedEnd = endMs <= startMs ? endMs + 24 * 3600 * 1000 : endMs;
    const diff = adjustedEnd - startMs;

    if (diff < 60000) {
      setError(t('manual_entry_error_duration'));
      return;
    }
    if (diff > 24 * 3600 * 1000) {
      setError(t('manual_entry_error_too_long'));
      return;
    }
    if (overlapsExisting(startMs, adjustedEnd, existingEntries)) {
      setError(t('manual_entry_error_overlap'));
      return;
    }

    const desc = [lesson, notes].filter(Boolean).join(" · ").trim();
    onSavePast(start, new Date(adjustedEnd), category, desc, location ?? undefined);
    onClose();
  };

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-card rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* handle */}
        <div className="flex-shrink-0 flex flex-col items-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-1 pb-3">
          <h2 className="text-base font-bold text-foreground">{t("manual_entry_title")}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 space-y-5 pb-4">

          {/* ── Category ── */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("manual_entry_category")}</p>
            <div className="flex flex-wrap gap-2">
              {activeCategories.map((c) => {
                const meta = getCategoryMeta(categoryConfigs, c.name);
                const selected = category === c.name;
                return (
                  <button
                    key={c.name}
                    onClick={() => { setCategory(c.name); if (c.name !== "Estudio") { setLesson(""); setContactId(""); } }}
                    className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold border transition-all active:scale-95 ${
                      selected ? "border-transparent text-white shadow-sm" : "border-border bg-muted/40 text-foreground"
                    }`}
                    style={selected ? { backgroundColor: c.color } : {}}
                  >
                    <CategoryIcon icon={meta.icon} className="text-base leading-none" />
                    {getCategoryLabel(c.name, t)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Estudio: contact + lesson */}
          {isEstudio && estudiosContacts.length > 0 && (
            <div className="rounded-2xl border border-border bg-muted/20 p-3 space-y-3">
              {estudiosContacts.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("studies_contact")}</p>
                  <div className="flex flex-wrap gap-2">
                    {estudiosContacts.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setContactId(c.id)}
                        className={`rounded-2xl px-3 py-1.5 text-sm font-semibold border transition-all ${
                          contactId === c.id ? "bg-primary text-primary-foreground border-transparent" : "border-border bg-muted/40 text-foreground"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("study_lesson")}</p>
                <input
                  type="text"
                  value={lesson}
                  onChange={(e) => setLesson(e.target.value)}
                  placeholder={t("studies_lesson_placeholder")}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
                />
              </div>
            </div>
          )}

          {/* ── Date ── */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("manual_entry_date")}</p>
            {editingDate ? (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => { setDate(e.target.value); setEndTime(addDurToTime(startTime, duration)); }}
                  className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  autoFocus
                />
                <button onClick={() => setEditingDate(false)} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingDate(true)}
                className="w-full flex items-center justify-between rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-foreground active:scale-[0.98] transition-transform"
              >
                <span className="font-medium capitalize">{formatDateLabel(date)}</span>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* ── Time row ── */}
          <div className={`grid gap-3 ${future ? "grid-cols-1" : "grid-cols-3"}`}>
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("manual_entry_start")}</p>
              <input
                type="time"
                value={startTime}
                onChange={(e) => onStartChange(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
              />
            </div>

            {!future && (
              <>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("manual_entry_duration")}</p>
                  <input
                    type="time"
                    value={duration}
                    onChange={(e) => onDurationChange(e.target.value)}
                    className="w-full rounded-2xl border border-primary/50 bg-primary/5 px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-center font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{t("manual_entry_end")}</p>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => onEndChange(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-3 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 text-center"
                  />
                </div>
              </>
            )}
          </div>

          {future && (
            <div className="rounded-2xl bg-blue-50 border border-blue-200 px-4 py-3 flex items-start gap-2">
              <span className="text-blue-500 text-base leading-none mt-0.5">📅</span>
              <p className="text-xs text-blue-700 font-medium">{t("manual_entry_future_hint")}</p>
            </div>
          )}

          {/* ── Extra options chips ── */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowNotes((v) => !v)}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold border transition-colors ${
                showNotes ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              <StickyNote className="w-3.5 h-3.5" />
              {t("timer_notes")}
            </button>

            <button
              onClick={() => setShowRepeat((v) => !v)}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold border transition-colors ${
                showRepeat ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("manual_entry_repeat")}
              {recurrence !== "none" && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary" />}
            </button>

            <button
              onClick={() => setShowLocation((v) => !v)}
              className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold border transition-colors ${
                (showLocation || location) ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border text-muted-foreground"
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              {location ? t("manual_entry_location_set") : t("manual_entry_location")}
            </button>
          </div>

          {/* Notes */}
          {showNotes && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("timer_notes_placeholder")}
              rows={3}
              className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/50"
            />
          )}

          {/* Repeat */}
          {showRepeat && (
            <div className="flex gap-2">
              {(["none", "weekly", "monthly"] as RecurrenceType[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRecurrence(r)}
                  className={`flex-1 rounded-2xl py-2.5 text-xs font-semibold border transition-colors ${
                    recurrence === r ? "bg-primary text-primary-foreground border-transparent" : "bg-muted/40 border-border text-foreground"
                  }`}
                >
                  {t(`manual_entry_recur_${r}`)}
                </button>
              ))}
            </div>
          )}

          {/* Location */}
          {showLocation && (
            <div className="space-y-2">
              {favoritePlaces.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {favoritePlaces.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setLocation(location?.lat === p.location.lat ? null : p.location)}
                      className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-xs font-semibold border transition-colors ${
                        location?.lat === p.location.lat ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted/40 border-border text-foreground"
                      }`}
                    >
                      <span>⭐</span> {p.name}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={captureGPS}
                disabled={locLoading}
                className="flex items-center gap-2 rounded-2xl border border-border bg-muted/40 px-4 py-2.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform disabled:opacity-60"
              >
                {locLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4 text-primary" />}
                {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : t("manual_entry_location")}
              </button>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-4 py-2.5 font-medium">{error}</p>
          )}
        </div>

        {/* ── Fixed save buttons — always visible ── */}
        <div className="flex-shrink-0 px-5 pt-3 pb-8 border-t border-border bg-card flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-2xl border border-border bg-muted/40 py-3.5 text-sm font-semibold text-foreground active:scale-[0.98] transition-transform"
          >
            {t("timer_cancel")}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/25 active:scale-[0.98] transition-transform"
          >
            {t("timer_save")}
          </button>
        </div>
      </div>
    </div>
  );
}

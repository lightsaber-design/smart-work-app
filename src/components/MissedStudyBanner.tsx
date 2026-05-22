import { useEffect, useState } from "react";
import { BookOpen, X, Calendar, Clock } from "lucide-react";
import { EstudioContact, EstudioSession, SessionFile } from "@/hooks/useEstudios";
import { localeForLang, useLang, useT } from "@/lib/LanguageContext";
import { formatDateLong } from "@/lib/dateFormat";

interface MissedStudyBannerProps {
  contacts: EstudioContact[];
  onComplete: (contactId: string, sessionId: string) => void;
  onReschedule: (
    contactId: string,
    sessionId: string,
    data: { date: string; time: string; lesson?: string; notes?: string; files: SessionFile[] }
  ) => void;
}

type MissedEntry = {
  contact: EstudioContact;
  session: EstudioSession;
};

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoToDateStr(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatMissedLabel(isoDate: string, locale: string): string {
  return formatDateLong(new Date(isoDate), locale);
}

export function MissedStudyBanner({ contacts, onComplete, onReschedule }: MissedStudyBannerProps) {
  const t = useT();
  const lang = useLang();
  const locale = localeForLang(lang);
  // IDs descartados en esta sesión para no repetir avisos sin recargar.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  // Sesión que se está reprogramando.
  const [rescheduling, setRescheduling] = useState<string | null>(null);
  const [newDate, setNewDate] = useState(todayDateStr());
  const [newTime, setNewTime] = useState("10:00");
  const [now, setNow] = useState(Date.now());

  // Refresca cada minuto para mostrar sesiones vencidas a tiempo.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Reúne sesiones pendientes vencidas por más de cinco minutos.
  const missed: MissedEntry[] = [];
  for (const contact of contacts) {
    if (!contact.active) continue;
    for (const session of (contact.sessions ?? [])) {
      if (!session.pending) continue;
      const sessionMs = new Date(session.date).getTime();
      // Vencida por más de cinco minutos.
      if (now - sessionMs > 5 * 60 * 1000 && !dismissed.has(session.id)) {
        missed.push({ contact, session });
      }
    }
  }

  // Muestra primero la sesión con mayor retraso.
  const current = missed.sort(
    (a, b) => new Date(a.session.date).getTime() - new Date(b.session.date).getTime()
  )[0] ?? null;

  if (!current) return null;

  const { contact, session } = current;
  const isRescheduling = rescheduling === session.id;

  const dismiss = () => setDismissed((prev) => new Set([...prev, session.id]));

  const handleComplete = () => {
    onComplete(contact.id, session.id);
    dismiss();
  };

  const handleReschedule = () => {
    onReschedule(contact.id, session.id, {
      date: newDate,
      time: newTime,
      lesson: session.lesson,
      notes: session.notes,
      files: session.files ?? [],
    });
    setRescheduling(null);
    dismiss();
  };

  const openReschedule = () => {
    setNewDate(isoToDateStr(session.date));
    setNewTime(session.time);
    setRescheduling(session.id);
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-orange-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <BookOpen className="w-4 h-4 text-orange-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-0.5">
              {t("missed_study_title")}
            </p>
            <p className="text-sm text-foreground leading-snug">
              {t("missed_study_question_prefix")}{" "}
              <span className="font-semibold">{contact.name}</span>
              {" "}{t("missed_study_question_day")}{" "}
              <span className="font-semibold capitalize">{formatMissedLabel(session.date, locale)}</span>?
            </p>
            {session.lesson && (
              <p className="text-xs text-muted-foreground mt-0.5">{session.lesson}</p>
            )}
          </div>
          <button onClick={dismiss} className="flex-shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Reschedule form */}
        {isRescheduling ? (
          <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">{t("missed_study_new_datetime")}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="w-3 h-3" /> {t("date_label")}
                </div>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Clock className="w-3 h-3" /> {t("time_label")}
                </div>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="w-full text-sm bg-muted border border-border rounded-lg px-3 py-2 text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleReschedule}
                className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
              >
                {t("common_confirm")}
              </button>
              <button
                onClick={() => setRescheduling(null)}
                className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-medium"
              >
                {t("common_cancel")}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2 px-4 pb-4">
            <button
              onClick={handleComplete}
              className="flex-1 py-2 rounded-xl bg-green-500 text-white text-sm font-semibold"
            >
              {t("missed_study_mark_done")}
            </button>
            <button
              onClick={openReschedule}
              className="flex-1 py-2 rounded-xl bg-muted text-foreground text-sm font-medium"
            >
              {t("missed_study_postpone")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { X, BookOpen, Clock, StickyNote, ChevronRight, Calendar } from "lucide-react";
import { isSessionDone, type EstudioContact, type EstudioSession } from "@/hooks/useEstudios";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface PrepModeProps {
  contact: EstudioContact;
  session: EstudioSession;
  locale: string;
  t: TranslateFn;
  onClose: () => void;
  onOpenFull: () => void;
}

function fmtDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(dateStr));
}

function studyDuration(contact: EstudioContact, t: TranslateFn) {
  const allDates = contact.sessions
    .filter(isSessionDone)
    .map((s) => new Date(s.date).getTime())
    .filter((ms) => !isNaN(ms));
  const firstMs = allDates.length > 0 ? Math.min(...allDates) : new Date(contact.createdAt).getTime();
  const diffDays = Math.floor((Date.now() - firstMs) / 86_400_000);
  if (diffDays >= 60) {
    const months = Math.round(diffDays / 30);
    return t("prep_mode_together_months", { n: months });
  }
  if (diffDays >= 14) {
    const weeks = Math.round(diffDays / 7);
    return t("prep_mode_together_weeks", { n: weeks });
  }
  return t("prep_mode_together_days", { n: Math.max(0, diffDays) });
}

export function PrepMode({ contact, session, locale, t, onClose, onOpenFull }: PrepModeProps) {
  const lastDone = [...contact.sessions]
    .filter(isSessionDone)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ?? null;

  const daysSinceLast = lastDone
    ? Math.floor((Date.now() - new Date(lastDone.date).getTime()) / 86_400_000)
    : null;

  // Initials avatar
  const initials = contact.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="fixed inset-0 z-[180] flex flex-col bg-muted/60 backdrop-blur-sm max-w-md mx-auto">
      {/* Draggable handle area */}
      <div className="flex-shrink-0 pt-4 pb-2 flex justify-center">
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {t("prep_mode_title")}
          </p>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm"
            aria-label={t("prep_mode_close")}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Contact identity */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-xl font-black text-primary-foreground">{initials}</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground leading-tight">{contact.name}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{studyDuration(contact, t)}</p>
          </div>
        </div>

        {/* Last session */}
        <div className="rounded-2xl bg-background border border-border p-4 mb-3 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {t("prep_mode_last_session")}
            </p>
          </div>

          {lastDone ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">{fmtDate(lastDone.date, locale)}</p>
                {daysSinceLast !== null && (
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {t("prep_mode_days_ago", { n: daysSinceLast })}
                  </span>
                )}
              </div>
              {lastDone.lesson && (
                <div className="flex items-start gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-foreground font-medium">{lastDone.lesson}</p>
                </div>
              )}
              {lastDone.notes && (
                <div className="flex items-start gap-2">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-muted-foreground line-clamp-3 leading-snug">{lastDone.notes}</p>
                </div>
              )}
              {!lastDone.lesson && !lastDone.notes && (
                <p className="text-sm text-muted-foreground italic">–</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">{t("prep_mode_no_history")}</p>
          )}
        </div>

        {/* Next session / today */}
        {session.lesson && (
          <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 mb-3">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-blue-500" />
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {t("prep_mode_next_lesson")}
              </p>
            </div>
            <p className="text-sm font-semibold text-foreground">{session.lesson}</p>
            {session.notes && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{session.notes}</p>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onOpenFull}
          className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-background border border-border text-sm font-semibold text-foreground shadow-sm active:scale-[0.98] transition-transform"
        >
          <span>{t("prep_mode_open_full")}</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useMemo } from "react";
import { Search, X, BookOpen, Calendar, User, Mic } from "lucide-react";
import { EstudioContact, EstudioSession, isSessionDone } from "@/hooks/useEstudios";
import { CalendarEvent } from "@/hooks/useCalendarEvents";

type ContactResult = { kind: "contact"; contact: EstudioContact };
type SessionResult = { kind: "session"; contact: EstudioContact; session: EstudioSession };
type EventResult = { kind: "event"; event: CalendarEvent };
type SearchResult = ContactResult | SessionResult | EventResult;

interface GlobalSearchProps {
  contacts: EstudioContact[];
  events: CalendarEvent[];
  onSelectContact: (contactId: string) => void;
  onSelectSession: (contactId: string, sessionId: string) => void;
  onSelectEvent: (eventId: string) => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: string;
}

export function GlobalSearch({
  contacts,
  events,
  onSelectContact,
  onSelectSession,
  onSelectEvent,
  onClose,
  t,
  locale,
}: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [listening, setListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<unknown>(null);

  // Web Speech API: solo disponible en algunos navegadores (no en el WebView de
  // Android por defecto). Si no existe, no mostramos el botón de voz.
  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined;
  const voiceSupported = Boolean(SpeechRecognitionCtor);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Limpia el reconocimiento al desmontar.
  useEffect(() => () => {
    try { (recognitionRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* nada */ }
  }, []);

  const startVoiceSearch = () => {
    if (!voiceSupported) return;
    if (listening) {
      try { (recognitionRef.current as { stop?: () => void } | null)?.stop?.(); } catch { /* nada */ }
      return;
    }
    try {
      const Ctor = SpeechRecognitionCtor as new () => {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        onerror: () => void;
        start: () => void;
        stop: () => void;
      };
      const rec = new Ctor();
      recognitionRef.current = rec;
      rec.lang = locale || "es-ES";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (e) => {
        const transcript = e.results?.[0]?.[0]?.transcript ?? "";
        if (transcript) setQuery(transcript);
      };
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
    }
  };

  const q = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (q.length < 2) return [];
    const out: SearchResult[] = [];

    for (const contact of contacts) {
      if (
        contact.name.toLowerCase().includes(q) ||
        contact.address?.toLowerCase().includes(q)
      ) {
        out.push({ kind: "contact", contact });
      }
      for (const session of contact.sessions) {
        if (!isSessionDone(session)) continue;
        if (
          session.lesson?.toLowerCase().includes(q) ||
          session.notes?.toLowerCase().includes(q)
        ) {
          out.push({ kind: "session", contact, session });
        }
      }
    }

    for (const event of events) {
      if (
        event.notes?.toLowerCase().includes(q) ||
        event.category?.toLowerCase().includes(q)
      ) {
        out.push({ kind: "event", event });
      }
    }

    return out.slice(0, 20);
  }, [q, contacts, events]);

  const grouped = useMemo(() => {
    const contactResults = results.filter((r): r is ContactResult => r.kind === "contact");
    const sessionResults = results.filter((r): r is SessionResult => r.kind === "session");
    const eventResults = results.filter((r): r is EventResult => r.kind === "event");
    return { contactResults, sessionResults, eventResults };
  }, [results]);

  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
        <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search_placeholder")}
          className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base outline-none"
        />
        {voiceSupported && (
          <button
            onClick={startVoiceSearch}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
              listening ? "bg-primary text-primary-foreground animate-pulse" : "bg-muted text-muted-foreground"
            }`}
            aria-label={t("search_voice")}
            title={t("search_voice")}
          >
            <Mic className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto py-2">
        {q.length < 2 ? (
          <p className="text-center text-muted-foreground text-sm mt-10">{t("search_type_more")}</p>
        ) : results.length === 0 ? (
          <p className="text-center text-muted-foreground text-sm mt-10">
            {t("search_no_results").replace("{q}", query.trim())}
          </p>
        ) : (
          <>
            {grouped.contactResults.length > 0 && (
              <section className="px-4 py-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                  {t("search_contacts")}
                </p>
                {grouped.contactResults.map(({ contact }) => (
                  <button
                    key={contact.id}
                    onClick={() => { onSelectContact(contact.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                      {contact.address && (
                        <p className="text-xs text-muted-foreground truncate">{contact.address}</p>
                      )}
                    </div>
                  </button>
                ))}
              </section>
            )}

            {grouped.sessionResults.length > 0 && (
              <section className="px-4 py-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                  {t("search_sessions")}
                </p>
                {grouped.sessionResults.map(({ contact, session }) => (
                  <button
                    key={session.id}
                    onClick={() => { onSelectSession(contact.id, session.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950/40 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{contact.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {fmt.format(new Date(session.date))}
                        {session.lesson ? ` · ${session.lesson}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </section>
            )}

            {grouped.eventResults.length > 0 && (
              <section className="px-4 py-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1.5">
                  {t("search_events")}
                </p>
                {grouped.eventResults.map(({ event }) => (
                  <button
                    key={event.id}
                    onClick={() => { onSelectEvent(event.id); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted active:bg-muted/80 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{event.category}</p>
                      {event.notes && (
                        <p className="text-xs text-muted-foreground truncate">{event.notes}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{fmt.format(event.date)}</p>
                    </div>
                  </button>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

import { ChevronLeft, Check, Pencil, Trash2 } from "lucide-react";
import { ClockButton } from "@/components/ClockButton";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { AppTab } from "@/components/BottomNav";
import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { TimeEntry } from "@/hooks/useTimeTracker";
import { useTimeTracker } from "@/hooks/useTimeTracker";
import { useCalendarEvents } from "@/hooks/useCalendarEvents";
import { useEstudios } from "@/hooks/useEstudios";
import type { SetupData } from "@/hooks/useSetup";
import { getCategoryLabel, getCategoryMeta, getCategoryStyle } from "@/lib/categories";
import { CurrentWeather, HourlyWeather, formatActivityWeather, formatDayWeatherSummary, weatherCodeToEmoji } from "@/lib/weatherUtils";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface TimerTabProps {
  timerBackground: string;
  greeting: string;
  userName: string;
  displayCityName: string;
  weather: CurrentWeather | null;
  // Summary sheet refs + state
  summarySheetRef: React.RefObject<HTMLDivElement>;
  timerContentRef: React.RefObject<HTMLDivElement>;
  summaryOpen: boolean;
  setSummaryOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  summaryDragOffset: number | null;
  activeSummaryOffset: number;
  toggleSummary: () => void;
  startDrag: (y: number) => void;
  moveDrag: (y: number) => void;
  endDrag: (y: number) => void;
  // Summary content
  summaryEvents: CalendarEvent[];
  groupedSummaryEvents: Array<{ key: string; label: string; events: CalendarEvent[] }>;
  showingUpcomingEvents: boolean;
  showAllEvents: boolean;
  setShowAllEvents: React.Dispatch<React.SetStateAction<boolean>>;
  hourlyWeather: HourlyWeather[];
  // Timer state
  activeEntry: TimeEntry | null;
  activeScheduledEvent: CalendarEvent | null;
  tracker: ReturnType<typeof useTimeTracker>;
  calendar: ReturnType<typeof useCalendarEvents>;
  estudios: ReturnType<typeof useEstudios>;
  setup: SetupData;
  // Callbacks
  requestClockOut: (customTime?: Date) => void;
  navigate: (tab: AppTab) => void;
  openCalendarEvent: (id: string) => void;
  setDeleteEventPromptId: (id: string) => void;
  setTimerDisplayCategory: (cat: string) => void;
  t: TranslateFn;
}

export function TimerTab({
  timerBackground,
  greeting,
  userName,
  displayCityName,
  weather,
  summarySheetRef,
  timerContentRef,
  summaryOpen,
  setSummaryOpen,
  summaryDragOffset,
  activeSummaryOffset,
  toggleSummary,
  startDrag,
  moveDrag,
  endDrag,
  summaryEvents,
  groupedSummaryEvents,
  showingUpcomingEvents,
  showAllEvents,
  setShowAllEvents,
  hourlyWeather,
  activeEntry,
  activeScheduledEvent,
  tracker,
  calendar,
  estudios,
  setup,
  requestClockOut,
  navigate,
  openCalendarEvent,
  setDeleteEventPromptId,
  setTimerDisplayCategory,
  t,
}: TimerTabProps) {
  const MAX_VISIBLE = 8;
  const allEvents = groupedSummaryEvents.flatMap((g) => g.events);
  const visibleEvents = showAllEvents ? allEvents : allEvents.slice(0, MAX_VISIBLE);
  const hiddenCount = allEvents.length - MAX_VISIBLE;
  const groupedVisible = groupedSummaryEvents
    .map((group) => ({ ...group, events: group.events.filter((e) => visibleEvents.includes(e)) }))
    .filter((g) => g.events.length > 0);

  return (
    <div className="h-screen flex flex-col relative pb-16 overflow-hidden" style={{ background: timerBackground }}>
      {/* Header */}
      <div className="px-5 pt-5 flex-shrink-0">
        <p className="text-sm text-slate-700 font-medium">{greeting}</p>
        <h1 className="text-xl font-bold text-slate-950 leading-tight">{userName}</h1>
        {setup.city && (
          <p className="text-[11px] text-slate-700">
            {displayCityName}
            {weather ? ` · ${weatherCodeToEmoji(weather.code)} ${weather.temp}°` : ""}
          </p>
        )}
      </div>

      <div className="absolute inset-x-0 top-0 h-[58vh] rounded-b-[42px] bg-[linear-gradient(180deg,rgba(255,255,255,0.32),rgba(255,255,255,0.06)_52%,transparent)] pointer-events-none" />

      {/* Backdrop when sheet is open */}
      <div
        className={`absolute top-0 left-0 right-0 bottom-16 z-20 bg-black/40 transition-opacity duration-300 ${
          summaryOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setSummaryOpen(false)}
      />

      {/* Draggable summary sheet */}
      <div
        ref={summarySheetRef}
        className={`absolute left-0 right-0 bottom-16 z-30 touch-none select-none ${summaryDragOffset === null ? "transition-transform duration-300 ease-out" : ""}`}
        style={{ transform: `translateY(${activeSummaryOffset}px)` }}
        onPointerDown={(e) => {
          startDrag(e.clientY);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => moveDrag(e.clientY)}
        onPointerUp={(e) => {
          endDrag(e.clientY);
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={(e) => endDrag(e.clientY)}
      >
        <div
          className="h-[62vh] overflow-hidden bg-card shadow-[0_-18px_55px_rgba(15,23,42,0.18)]"
          style={{ borderRadius: "34px 34px 0 0" }}
        >
          <button onClick={toggleSummary} className="w-full flex flex-col items-center pt-2.5 pb-1.5 gap-1">
            <div className="w-10 h-1 rounded-full bg-border" />
            {!summaryOpen && (
              <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <ChevronLeft className="w-3 h-3 rotate-90" />
                {showingUpcomingEvents ? t("home_upcoming_activities") : t("day_today")}
              </p>
            )}
          </button>

          {summaryOpen && (
            <div className="px-5 flex items-center justify-between mb-2 cursor-pointer" onClick={toggleSummary}>
              <p className="text-sm font-bold text-foreground">
                {showingUpcomingEvents ? t("home_upcoming_activities") : t("day_today")}
              </p>
            </div>
          )}

          {summaryEvents.length === 0 ? (
            <div className="px-5 pb-4 pt-1">
              <p className="text-sm font-semibold text-foreground">{t("home_nothing_today")}</p>
              {formatDayWeatherSummary(hourlyWeather, summaryEvents, t) && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDayWeatherSummary(hourlyWeather, summaryEvents, t)}
                </p>
              )}
            </div>
          ) : (
            <div className="px-5 pb-3 space-y-3">
              {formatDayWeatherSummary(hourlyWeather, summaryEvents, t) && (
                <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                  {formatDayWeatherSummary(hourlyWeather, summaryEvents, t)}
                </p>
              )}
              {showingUpcomingEvents && (
                <p className="text-sm font-semibold text-foreground">{t("home_nothing_today")}</p>
              )}
              {groupedVisible.map((group) => (
                <div key={group.key} className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  {group.events.map((event) => {
                    const style = getCategoryStyle(setup.categorySettings, event.category);
                    const meta = getCategoryMeta(setup.categorySettings, event.category);
                    const timeStr = `${String(event.date.getHours()).padStart(2, "0")}:${String(event.date.getMinutes()).padStart(2, "0")}`;
                    const forecast = formatActivityWeather(hourlyWeather, event.date, t);
                    const isOngoing = tracker.isRunning && activeScheduledEvent?.id === event.id;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => openCalendarEvent(event.id)}
                        className={`w-full flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left active:scale-[0.98] transition-transform ${style.card}`}
                        style={{ borderLeftWidth: 3, borderLeftColor: style.accent }}
                      >
                        <CategoryIcon
                          icon={meta.icon}
                          className={`text-lg leading-none flex-shrink-0 ${isOngoing ? "animate-pulse" : ""}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-[13px] font-semibold truncate ${
                              isOngoing
                                ? "text-primary"
                                : event.completed
                                  ? "line-through opacity-50 text-foreground"
                                  : "text-foreground"
                            }`}
                          >
                            {getCategoryLabel(event.category, t)}
                            {isOngoing && (
                              <span className="ml-1.5 text-[10px] font-medium text-primary/70">● en curso</span>
                            )}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {timeStr}
                            {event.endTime ? ` – ${event.endTime}` : ""}
                          </p>
                          {!event.completed && !isOngoing && forecast && (
                            <p className="text-[10px] text-muted-foreground truncate">{forecast}</p>
                          )}
                        </div>
                        {!isOngoing && event.completed && <Check className="w-4 h-4 text-green-500 flex-shrink-0" />}
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="w-7 h-7 rounded-full bg-background/70 border border-border flex items-center justify-center">
                            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteEventPromptId(event.id);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== "Enter" && e.key !== " ") return;
                              e.preventDefault();
                              e.stopPropagation();
                              setDeleteEventPromptId(event.id);
                            }}
                            className="w-7 h-7 rounded-full bg-background/70 border border-border flex items-center justify-center"
                            aria-label={t("home_delete_activity")}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {!showAllEvents && hiddenCount > 0 && (
                <button
                  onClick={() => setShowAllEvents(true)}
                  className="w-full py-2 text-xs font-semibold text-primary rounded-xl bg-primary/8 hover:bg-primary/12 transition-colors"
                >
                  + {hiddenCount} {hiddenCount === 1 ? "actividad más" : "actividades más"}
                </button>
              )}
            </div>
          )}

          <div className="px-5 pt-1 pb-6">
            <button
              onClick={() => navigate("calendar")}
              className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20"
            >
              {t("home_add_activity")}
            </button>
          </div>
        </div>
      </div>

      {/* Timer content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-start px-4 pt-6">
        <div ref={timerContentRef} className="w-full flex flex-col items-center">
          <ClockButton
            isRunning={tracker.isRunning}
            elapsed={tracker.elapsed}
            onClockIn={(cat, customTime) =>
              tracker.clockIn(
                cat,
                ({ date, category, location }) => calendar.addCompletedEventNow({ date, category, location }),
                customTime,
              )
            }
            onClockOut={requestClockOut}
            onUpdateCategory={(cat) => {
              if (!activeEntry) return;
              tracker.updateCategory(activeEntry.id, cat);
              if (activeEntry.linkedEventId) {
                calendar.updateEvent(activeEntry.linkedEventId, { category: cat });
              }
            }}
            onUpdateStartTime={(startTime) => {
              if (!activeEntry) return;
              tracker.updateStartTime(activeEntry.id, startTime);
              if (activeEntry.linkedEventId) {
                calendar.updateEvent(activeEntry.linkedEventId, { date: startTime });
              }
            }}
            calendarEvents={calendar.events}
            activeCategory={activeEntry?.category}
            activeEntryId={activeEntry?.id}
            activeEntryStartTime={activeEntry?.startTime}
            estudios={estudios.contacts.filter((c) => c.active)}
            onDisplayCategoryChange={setTimerDisplayCategory}
            onEstudioSession={estudios.addSession}
            categoryConfigs={setup.categorySettings}
            activityStartHour={setup.activityStartHour}
            activityEndHour={setup.activityEndHour}
          />
        </div>
      </div>
    </div>
  );
}

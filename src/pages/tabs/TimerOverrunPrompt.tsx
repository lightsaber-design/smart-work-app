import type { CalendarEvent } from "@/hooks/useCalendarEvents";
import type { SetupData } from "@/hooks/useSetup";
import { getCategoryLabel } from "@/lib/categories";
import { formatTime } from "@/lib/dateFormat";
import { clampTimeValueToHourRange } from "@/lib/activityHours";
import { getEventEndDate } from "@/lib/timerOverrun";

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

interface TimerOverrunPromptProps {
  activeScheduledEvent: CalendarEvent;
  timerOverrunSnoozeTime: string;
  setTimerOverrunSnoozeTime: (v: string) => void;
  setup: Pick<SetupData, "activityStartHour" | "activityEndHour">;
  postponeTimerOverrunPrompt: () => void;
  stopActiveTimer: () => void;
  setTimerOverrunDismissedId: (id: string) => void;
  t: TranslateFn;
  locale: string;
}

export function TimerOverrunPrompt({
  activeScheduledEvent,
  timerOverrunSnoozeTime,
  setTimerOverrunSnoozeTime,
  setup,
  postponeTimerOverrunPrompt,
  stopActiveTimer,
  setTimerOverrunDismissedId,
  t,
  locale,
}: TimerOverrunPromptProps) {
  const end = getEventEndDate(activeScheduledEvent);
  const endLabel = end ? formatTime(end, locale) : "";

  return (
    <div className="fixed bottom-24 left-0 right-0 px-4 max-w-md mx-auto z-50">
      <div className="rounded-2xl border border-amber-500/30 bg-card p-4 shadow-xl">
        <div className="mb-3">
          <p className="text-sm font-bold text-foreground">{t("timer_overrun_title")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("timer_overrun_body", {
              category: getCategoryLabel(activeScheduledEvent.category, t),
              time: endLabel,
            })}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 mb-2">
          <input
            type="time"
            value={timerOverrunSnoozeTime}
            min={`${String(setup.activityStartHour).padStart(2, "0")}:00`}
            max={`${String(setup.activityEndHour).padStart(2, "0")}:00`}
            onChange={(e) => setTimerOverrunSnoozeTime(e.target.value)}
            onBlur={() =>
              setTimerOverrunSnoozeTime(
                clampTimeValueToHourRange(timerOverrunSnoozeTime, setup.activityStartHour, setup.activityEndHour),
              )
            }
            className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            onClick={postponeTimerOverrunPrompt}
            className="rounded-xl bg-muted px-3 py-2 text-sm font-semibold text-foreground"
          >
            {t("timer_overrun_postpone")}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={stopActiveTimer}
            className="rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("timer_overrun_stop")}
          </button>
          <button
            onClick={() => setTimerOverrunDismissedId(activeScheduledEvent.id)}
            className="rounded-xl border border-border px-3 py-2 text-sm font-semibold text-foreground"
          >
            {t("timer_overrun_keep_running")}
          </button>
        </div>
      </div>
    </div>
  );
}

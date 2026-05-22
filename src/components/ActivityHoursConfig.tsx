import { Clock, Pencil, X } from "lucide-react";
import { useState } from "react";
import { TimeSelect } from "@/components/TimeSelect";
import { formatHourRange } from "@/lib/activityHours";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/LanguageContext";

interface ActivityHoursConfigProps {
  startHour: number;
  endHour: number;
  onChange: (value: { startHour: number; endHour: number }) => void;
}

function toHour(value: string): number {
  return Number(value.split(":")[0]);
}

export function ActivityHoursConfig({ startHour, endHour, onChange }: ActivityHoursConfigProps) {
  const t = useT();
  const [editing, setEditing] = useState(false);

  const updateStart = (value: string) => {
    const nextStart = toHour(value);
    const nextEnd = Math.max(nextStart + 1, endHour);
    onChange({ startHour: nextStart, endHour: nextEnd });
  };

  const updateEnd = (value: string) => {
    const nextEnd = toHour(value);
    const nextStart = Math.min(startHour, nextEnd - 1);
    onChange({ startHour: nextStart, endHour: nextEnd });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-1.5 text-sm text-foreground">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          {t("activity_hours_title")}
        </Label>
        <span className="text-xs font-medium text-muted-foreground">
          {formatHourRange(startHour, endHour)}
        </span>
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground active:opacity-70"
          aria-label={editing ? t("activity_hours_close") : t("activity_hours_edit")}
        >
          {editing ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
        </button>
      </div>

      {editing && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("activity_hours_start")}</Label>
            <TimeSelect value={`${String(startHour).padStart(2, "0")}:00`} onChange={updateStart} startHour={0} endHour={22} stepMinutes={60} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t("activity_hours_end")}</Label>
            <TimeSelect value={`${String(endHour).padStart(2, "0")}:00`} onChange={updateEnd} startHour={1} endHour={23} stepMinutes={60} />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {t("activity_hours_hint")}
      </p>
    </div>
  );
}

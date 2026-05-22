import { Clock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useT } from "@/lib/LanguageContext";

interface TravelTimeConfigProps {
  enabled: boolean;
  minutes: number;
  onChange: (value: { enabled: boolean; minutes: number }) => void;
}

function normalizeMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(180, Math.max(0, Math.round(value)));
}

export function TravelTimeConfig({ enabled, minutes, onChange }: TravelTimeConfigProps) {
  const t = useT();
  const normalizedMinutes = normalizeMinutes(minutes);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label className="flex items-center gap-2 text-sm text-foreground cursor-pointer" htmlFor="travel-time-toggle">
          <Clock className="w-4 h-4 text-primary" />
          {t("travel_time_title")}
        </Label>
        <Switch
          id="travel-time-toggle"
          checked={enabled}
          onCheckedChange={(checked) => onChange({ enabled: checked, minutes: normalizedMinutes || 30 })}
        />
      </div>
      {enabled && (
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground" htmlFor="travel-time-minutes">
            {t("travel_time_minutes")}
          </Label>
          <div className="flex items-center gap-2">
            <input
              id="travel-time-minutes"
              type="number"
              min={0}
              max={180}
              step={5}
              className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={normalizedMinutes}
              onChange={(event) => onChange({ enabled, minutes: normalizeMinutes(Number(event.target.value)) })}
            />
            <span className="text-sm text-muted-foreground">{t("travel_time_before")}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("travel_time_hint")}
          </p>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Input } from "@/components/ui/input";

interface PrecursorHoursConfigProps {
  value: number | null;
  onChange: (v: number | null) => void;
}

const PRESETS = [null, 30, 50] as const;
const MAX_CUSTOM = 999;

/**
 * Renders the four-button preset selector (No / 30h / 50h / Custom) plus
 * a number input that appears when a custom value is active.
 * Manages its own `customStr` state so the text field stays stable while typing.
 */
export function PrecursorHoursConfig({ value, onChange }: PrecursorHoursConfigProps) {
  const isCustom = value !== null && !PRESETS.some((p) => p === value);
  const [customStr, setCustomStr] = useState(isCustom ? String(value) : "");

  const applyCustomStr = (str: string) => {
    const parsed = parseInt(str, 10);
    onChange(!isNaN(parsed) && parsed > 0 ? Math.min(parsed, MAX_CUSTOM) : null);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {([...PRESETS, "custom"] as const).map((opt) => {
          const isOptCustom = opt === "custom";
          const active = isOptCustom ? isCustom : value === opt;
          const label = opt === null ? "No" : opt === 30 ? "30h" : opt === 50 ? "50h" : "Custom";
          return (
            <button
              key={String(opt)}
              type="button"
              onClick={() => {
                if (isOptCustom) {
                  applyCustomStr(customStr);
                } else {
                  setCustomStr("");
                  onChange(opt as number | null);
                }
              }}
              className={`rounded-lg py-2 text-sm font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary text-foreground border-transparent hover:border-border"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {(isCustom || customStr !== "") && (
        <Input
          type="number"
          min={1}
          max={MAX_CUSTOM}
          placeholder="Horas al mes"
          value={customStr}
          onChange={(e) => {
            setCustomStr(e.target.value);
            applyCustomStr(e.target.value);
          }}
        />
      )}
    </div>
  );
}

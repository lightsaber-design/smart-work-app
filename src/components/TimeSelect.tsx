import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { hourToTimeValue } from "@/lib/activityHours";

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  startHour: number;
  endHour: number;
  stepMinutes?: number;
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

function formatTimeLabel(value: string): string {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function buildTimeOptions(startHour: number, endHour: number, stepMinutes: number): string[] {
  const startMinutes = startHour * 60;
  const endMinutes = endHour * 60;
  const options: string[] = [];
  for (let minutes = startMinutes; minutes <= endMinutes; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    options.push(`${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`);
  }
  return options;
}

export function TimeSelect({
  value,
  onChange,
  startHour,
  endHour,
  stepMinutes = 15,
  placeholder = "Select time",
  allowEmpty = false,
  emptyLabel = "No end time",
}: TimeSelectProps) {
  const safeValue = value || (allowEmpty ? "__empty" : hourToTimeValue(startHour));
  const options = buildTimeOptions(startHour, endHour, stepMinutes);

  return (
    <Select
      value={safeValue}
      onValueChange={(next) => onChange(next === "__empty" ? "" : next)}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__empty">{emptyLabel}</SelectItem>}
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {formatTimeLabel(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

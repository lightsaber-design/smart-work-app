import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

interface CityResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

interface CitySearchProps {
  value?: { name: string; lat: number; lng: number };
  onChange: (city: { name: string; lat: number; lng: number }) => void;
  placeholder?: string;
}

function formatName(result: CityResult): string {
  const parts = result.display_name.split(",").map((s) => s.trim());
  return parts.slice(0, 3).join(", ");
}

export function CitySearch({ value, onChange, placeholder = "Buscar ciudad..." }: CitySearchProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<CityResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&addressdetails=1`
        );
        const data: CityResult[] = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch {
        setSuggestions([]);
      }
      setLoading(false);
    }, 400);
  };

  const handleSelect = (result: CityResult) => {
    const name = formatName(result);
    onChange({ name, lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    setQuery(name);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              onMouseDown={() => handleSelect(s)}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors border-b border-border last:border-0"
            >
              <span className="font-medium">{s.display_name.split(",")[0]}</span>
              <span className="text-muted-foreground text-xs ml-1">
                {s.display_name.split(",").slice(1, 3).join(",")}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

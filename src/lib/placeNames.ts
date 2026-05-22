type TranslateFn = (key: string) => string;

const PLACE_KEYS: Record<string, string> = {
  dublin: "place_dublin",
  "county dublin": "place_county_dublin",
  leinster: "place_leinster",
  ireland: "place_ireland",
  irlanda: "place_ireland",
  spain: "place_spain",
  espana: "place_spain",
  espanha: "place_spain",
  españa: "place_spain",
  portugal: "place_portugal",
  france: "place_france",
  francia: "place_france",
  frankreich: "place_france",
  italy: "place_italy",
  italia: "place_italy",
  deutschland: "place_germany",
  germany: "place_germany",
  alemania: "place_germany",
  "canary islands": "place_canary_islands",
  canarias: "place_canary_islands",
  "islas canarias": "place_canary_islands",
  "las palmas": "place_las_palmas",
  "santa cruz de tenerife": "place_santa_cruz_tenerife",
};

function normalizePlacePart(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function formatPlaceName(name: string, t: TranslateFn): string {
  return name
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const key = PLACE_KEYS[normalizePlacePart(trimmed)];
      return key ? t(key) : trimmed;
    })
    .filter(Boolean)
    .join(", ");
}

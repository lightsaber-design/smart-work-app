import { EventCategory } from "@/hooks/useCalendarEvents";

export type CategoryConfig = {
  name: EventCategory;
  color: string;
  active: boolean;
  support: boolean;
};

export const SUPPORT_CAP_HOURS = 55;

export const DEFAULT_CATEGORY_CONFIGS: CategoryConfig[] = [
  { name: "Predi", color: "#34B1AF", active: true, support: false },
  { name: "Carrito", color: "#7CC67E", active: true, support: false },
  { name: "LDC", color: "#9668A2", active: true, support: true },
  { name: "Visitas", color: "#F4CFA4", active: true, support: false },
  { name: "Estudio", color: "#D07D7D", active: true, support: false },
];

export const DEFAULT_CATEGORY_NAMES = DEFAULT_CATEGORY_CONFIGS.map((category) => category.name);

export function isDefaultCategoryName(name: string): boolean {
  return DEFAULT_CATEGORY_NAMES.some((categoryName) => categoryName === name);
}

export function getCategoryLabel(name: string, t: (key: string) => string): string {
  if (!isDefaultCategoryName(name)) return name;
  return t(`category_${name.toLowerCase()}`);
}

const DEFAULT_ICONS: Record<string, string> = {
  Predi: "🏠",
  Carrito: "cart-trolley",
  LDC: "🛠️",
  Visitas: "🚶",
  Estudio: "📖",
};

const FALLBACK_COLORS = ["#34B1AF", "#7CC67E", "#9668A2", "#F4CFA4", "#D07D7D", "#5B8DEF", "#E17A47", "#607D8B"];


function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function lightenColor(hex: string, amount = 0.34): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeCategoryConfigs(value: unknown): CategoryConfig[] {
  if (!Array.isArray(value)) return DEFAULT_CATEGORY_CONFIGS;
  const parsed = value
    .map((item, index): CategoryConfig | null => {
      if (typeof item !== "object" || item === null) return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === "string" ? record.name.trim() : "";
      if (!name) return null;
      return {
        name,
        color: isHexColor(record.color) ? record.color : FALLBACK_COLORS[index % FALLBACK_COLORS.length],
        active: typeof record.active === "boolean" ? record.active : true,
        support: typeof record.support === "boolean" ? record.support : name === "LDC",
      };
    })
    .filter((category): category is CategoryConfig => category !== null);

  const withDefaults = DEFAULT_CATEGORY_CONFIGS.map((category) => {
    const stored = parsed.find((item) => item.name === category.name);
    return stored ? { ...category, ...stored } : category;
  });
  const custom = parsed.filter((category) => !DEFAULT_CATEGORY_CONFIGS.some((item) => item.name === category.name));
  return [...withDefaults, ...custom];
}

export function getActiveCategoryConfigs(configs: CategoryConfig[]): CategoryConfig[] {
  return configs.filter((category) => category.active);
}

export function findCategoryConfig(configs: CategoryConfig[], name: EventCategory): CategoryConfig {
  return configs.find((category) => category.name === name) ?? {
    name,
    color: FALLBACK_COLORS[Math.abs(name.length) % FALLBACK_COLORS.length],
    active: true,
    support: false,
  };
}

export function getCategoryMeta(configs: CategoryConfig[], name: EventCategory): { icon: string; gradient: [string, string]; ring: string } {
  const config = findCategoryConfig(configs, name);
  const icon = DEFAULT_ICONS[config.name] ?? config.name.trim().charAt(0).toUpperCase();
  return { icon, gradient: [config.color, lightenColor(config.color)], ring: config.color };
}

export function getCategoryStyle(configs: CategoryConfig[], name: EventCategory) {
  const config = findCategoryConfig(configs, name);
  return {
    card: "bg-card border-border",
    border: "border-border",
    dot: "",
    dotColor: config.color,
    accent: config.color,
  };
}


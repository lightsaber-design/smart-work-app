import { EventCategory } from "@/hooks/useCalendarEvents";

export const CATEGORY_LIST: EventCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

/** Icon + gradient colours used in stats bars and timeline chips. */
export const CATEGORY_META: Record<EventCategory, { icon: string; gradient: [string, string] }> = {
  Predi:   { icon: "🏠", gradient: ["#60a5fa", "#818cf8"] },
  Carrito: { icon: "🪧", gradient: ["#4ade80", "#34d399"] },
  LDC:     { icon: "🛠️", gradient: ["#c084fc", "#818cf8"] },
  Visitas: { icon: "🚶", gradient: ["#fb923c", "#f59e0b"] },
  Estudio: { icon: "📖", gradient: ["#f472b6", "#e879f9"] },
};

/** Tailwind class sets used in calendar event cards. */
export const CATEGORY_STYLE: Record<
  EventCategory,
  { card: string; border: string; dot: string; dotColor: string; accent: string }
> = {
  Predi:   { card: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/50",    border: "border-blue-200 dark:border-blue-800/50",    dot: "bg-blue-500",   dotColor: "#3b82f6", accent: "#3b82f6" },
  Carrito: { card: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50",  border: "border-green-200 dark:border-green-800/50",  dot: "bg-green-500",  dotColor: "#22c55e", accent: "#22c55e" },
  LDC:     { card: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50", border: "border-purple-200 dark:border-purple-800/50", dot: "bg-purple-500", dotColor: "#a855f7", accent: "#a855f7" },
  Visitas: { card: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50", border: "border-orange-200 dark:border-orange-800/50", dot: "bg-orange-500", dotColor: "#f97316", accent: "#f97316" },
  Estudio: { card: "bg-pink-50 dark:bg-pink-950/30 border-pink-200 dark:border-pink-800/50",    border: "border-pink-200 dark:border-pink-800/50",    dot: "bg-pink-500",   dotColor: "#ec4899", accent: "#ec4899" },
};

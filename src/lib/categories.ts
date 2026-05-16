import { EventCategory } from "@/hooks/useCalendarEvents";

export const CATEGORY_LIST: EventCategory[] = ["Predi", "Carrito", "LDC", "Visitas", "Estudio"];

/** Icon + gradient colours used in stats bars and timeline chips. */
export const CATEGORY_META: Record<EventCategory, { icon: string; gradient: [string, string] }> = {
  Predi:   { icon: "🏠", gradient: ["#34B1AF", "#7BD4D2"] },
  Carrito: { icon: "🪧", gradient: ["#7CC67E", "#B3E0A4"] },
  LDC:     { icon: "🛠️", gradient: ["#9668A2", "#C29ACC"] },
  Visitas: { icon: "🚶", gradient: ["#F4CFA4", "#F7DFB8"] },
  Estudio: { icon: "📖", gradient: ["#D07D7D", "#E6A3A3"] },
};

/** Tailwind class sets used in calendar event cards. */
export const CATEGORY_STYLE: Record<
  EventCategory,
  { card: string; border: string; dot: string; dotColor: string; accent: string }
> = {
  Predi:   { card: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/50",       border: "border-cyan-200 dark:border-cyan-800/50",       dot: "bg-cyan-500",   dotColor: "#34B1AF", accent: "#34B1AF" },
  Carrito: { card: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800/50",    border: "border-green-200 dark:border-green-800/50",    dot: "bg-green-500",  dotColor: "#7CC67E", accent: "#7CC67E" },
  LDC:     { card: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800/50", border: "border-purple-200 dark:border-purple-800/50", dot: "bg-purple-500", dotColor: "#9668A2", accent: "#9668A2" },
  Visitas: { card: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800/50", border: "border-orange-200 dark:border-orange-800/50", dot: "bg-orange-500", dotColor: "#F4CFA4", accent: "#F4CFA4" },
  Estudio: { card: "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50",       border: "border-rose-200 dark:border-rose-800/50",       dot: "bg-rose-500",   dotColor: "#D07D7D", accent: "#D07D7D" },
};

import { cn } from "@/lib/utils";

interface CategoryIconProps {
  icon: string;
  className?: string;
}

function TrolleyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("inline-block h-[1em] w-[1em]", className)} fill="none">
      <path d="M12 4.5h9.2l2 19H9.8l2.2-19Z" fill="#1f2937" />
      <path d="M13.3 6.2h6.6l.4 3.7h-7.4l.4-3.7Z" fill="#e0f2fe" />
      <path d="M12.4 11.5h8.4l.5 4.2h-9.4l.5-4.2Z" fill="#f8fafc" />
      <path d="M11.7 17.4h10.1l.5 4.3H11.2l.5-4.3Z" fill="#f8fafc" />
      <path d="M14 7.1h4.9M13.4 13.2h6.6M13 19.1h7.8" stroke="#0f172a" strokeWidth="1" strokeLinecap="round" />
      <path d="M9.7 24.1h13.7M11 24.1l-2.4 3.1M22 24.1l2.4 3.1" stroke="#111827" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="27" r="2.2" fill="#111827" />
      <circle cx="23.7" cy="27" r="2.2" fill="#111827" />
      <path d="M8.5 29.3h15.7" stroke="#111827" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M13.1 9.9h7.2M11.9 15.7h9.4M11.2 21.7h11.1" stroke="#94a3b8" strokeWidth=".8" />
    </svg>
  );
}

export function CategoryIcon({ icon, className }: CategoryIconProps) {
  if (icon === "cart-trolley") return <TrolleyIcon className={className} />;
  return <span className={className}>{icon}</span>;
}

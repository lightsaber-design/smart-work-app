import { Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageFlagProps {
  lang: Lang;
  className?: string;
}

export function LanguageFlag({ lang, className }: LanguageFlagProps) {
  return (
    <svg
      viewBox="0 0 36 24"
      aria-hidden="true"
      className={cn("inline-block h-5 w-7 overflow-hidden rounded-[4px] shadow-sm ring-1 ring-black/10", className)}
    >
      {lang === "es" && (
        <>
          <rect width="36" height="24" fill="#AA151B" />
          <rect y="6" width="36" height="12" fill="#F1BF00" />
        </>
      )}
      {lang === "en" && (
        <>
          <rect width="36" height="24" fill="#012169" />
          <path d="M0 0l36 24M36 0L0 24" stroke="#fff" strokeWidth="5" />
          <path d="M0 0l36 24M36 0L0 24" stroke="#C8102E" strokeWidth="2.4" />
          <path d="M18 0v24M0 12h36" stroke="#fff" strokeWidth="8" />
          <path d="M18 0v24M0 12h36" stroke="#C8102E" strokeWidth="4.4" />
        </>
      )}
      {lang === "pt" && (
        <>
          <rect width="14.5" height="24" fill="#046A38" />
          <rect x="14.5" width="21.5" height="24" fill="#DA291C" />
          <circle cx="14.5" cy="12" r="4.4" fill="#FFCD00" />
        </>
      )}
      {lang === "fr" && (
        <>
          <rect width="12" height="24" fill="#0055A4" />
          <rect x="12" width="12" height="24" fill="#fff" />
          <rect x="24" width="12" height="24" fill="#EF4135" />
        </>
      )}
      {lang === "it" && (
        <>
          <rect width="12" height="24" fill="#009246" />
          <rect x="12" width="12" height="24" fill="#fff" />
          <rect x="24" width="12" height="24" fill="#CE2B37" />
        </>
      )}
      {lang === "de" && (
        <>
          <rect width="36" height="8" fill="#000" />
          <rect y="8" width="36" height="8" fill="#DD0000" />
          <rect y="16" width="36" height="8" fill="#FFCE00" />
        </>
      )}
    </svg>
  );
}

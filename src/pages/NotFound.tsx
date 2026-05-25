import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { detectLanguage, Lang, translate } from "@/lib/i18n";
import { MinistryMark, MinistryWordmark } from "@/components/MinistryMark";

const SUPPORTED_LANGS: Lang[] = ["es", "en", "pt", "fr", "it", "de"];

function getStoredLanguage(): Lang {
  try {
    const setup = JSON.parse(localStorage.getItem("setup") ?? "null") as { language?: string } | null;
    if (setup?.language && SUPPORTED_LANGS.includes(setup.language as Lang)) return setup.language as Lang;
  } catch {
    // Si el perfil no se puede leer, se usa el idioma del navegador.
  }
  return detectLanguage();
}

const NotFound = () => {
  const location = useLocation();
  const lang = getStoredLanguage();
  const t = (key: string) => translate(lang, key);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center flex flex-col items-center gap-3">
        <MinistryMark size={64} />
        <MinistryWordmark size={18} showUnderline />
        <h1 className="mt-4 text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">{t("not_found_title")}</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          {t("not_found_home")}
        </a>
      </div>
    </div>
  );
};

export default NotFound;

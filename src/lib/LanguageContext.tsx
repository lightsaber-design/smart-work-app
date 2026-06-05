import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Lang, TranslationKey, loadLanguage, subscribeLanguageLoad, translate } from './i18n';

type TFn = (key: TranslationKey | (string & {}), vars?: Record<string, string | number>) => string;

const LanguageContext = createContext<TFn>((k) => k);
const CurrentLanguageContext = createContext<Lang>('es');

export function localeForLang(lang: Lang): string {
  const locales: Record<Lang, string> = {
    es: 'es-ES',
    en: 'en-GB',
    pt: 'pt-PT',
    fr: 'fr-FR',
    it: 'it-IT',
    de: 'de-DE',
  };
  return locales[lang];
}

export function LanguageProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // Fuerza un nuevo valor de contexto cuando termina de cargar un idioma.
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    if (lang === 'es') return;
    // Suscribe antes de cargar para no perder el callback del chunk.
    const unsub = subscribeLanguageLoad(() => setLoadCount((n) => n + 1));
    void loadLanguage(lang);
    return unsub;
  }, [lang]);

  // Identidad estable entre renders normales; cambia solo al cambiar de idioma
  // o cuando termina de cargar un chunk (loadCount), para propagar traducciones.
  const t: TFn = useCallback(
    (key, vars) => translate(lang, key, vars),
    // loadCount se incluye a propósito: re-memoiza al cargar un chunk de idioma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lang, loadCount]
  );

  return (
    <CurrentLanguageContext.Provider value={lang}>
      <LanguageContext.Provider value={t}>{children}</LanguageContext.Provider>
    </CurrentLanguageContext.Provider>
  );
}

export const useT = () => useContext(LanguageContext);
export const useLang = () => useContext(CurrentLanguageContext);

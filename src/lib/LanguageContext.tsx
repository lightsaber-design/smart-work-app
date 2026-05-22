import { createContext, useContext } from 'react';
import { Lang, translate } from './i18n';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

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
  const t: TFn = (key, vars) => translate(lang, key, vars);
  return (
    <CurrentLanguageContext.Provider value={lang}>
      <LanguageContext.Provider value={t}>{children}</LanguageContext.Provider>
    </CurrentLanguageContext.Provider>
  );
}

export const useT = () => useContext(LanguageContext);
export const useLang = () => useContext(CurrentLanguageContext);

import { createContext, useContext } from 'react';
import { Lang, translate } from './i18n';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const LanguageContext = createContext<TFn>((k) => k);

export function LanguageProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const t: TFn = (key, vars) => translate(lang, key, vars);
  return <LanguageContext.Provider value={t}>{children}</LanguageContext.Provider>;
}

export const useT = () => useContext(LanguageContext);

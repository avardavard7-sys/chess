'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { ru, type TranslationKey } from './i18n/ru';
import { kk } from './i18n/kk';

export type Lang = 'ru' | 'kk';

const translations = { ru, kk };

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'ru',
  setLang: () => {},
  t: (key) => ru[key] || key,
});

const STORAGE_KEY = 'hodkonem-lang';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ru');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang;
    if (saved && (saved === 'ru' || saved === 'kk')) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  };

  const t = (key: TranslationKey): string => {
    return translations[lang]?.[key] || translations.ru[key] || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  return useContext(I18nContext);
}

export { type TranslationKey };

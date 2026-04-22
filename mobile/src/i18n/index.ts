import { useMemo } from 'react';
import { useLanguageStore, type Language } from '../stores/language';
import ko, { type TranslationKeys } from './ko';
import en from './en';
import ja from './ja';
import zh from './zh';

const translations: Record<string, TranslationKeys> = {
  ko,
  en,
  ja,
  zh,
};

/** Get the full translation object for a language code */
export function getTranslations(lang: Language): TranslationKeys {
  return translations[lang] || ko;
}

/** React hook — returns the translation object for the current language */
export function useT(): TranslationKeys {
  const language = useLanguageStore((s) => s.language);
  return useMemo(() => getTranslations(language), [language]);
}

export type { TranslationKeys };
export { ko, en, ja, zh };

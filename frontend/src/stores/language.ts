import { create } from "zustand";
import { persist } from "zustand/middleware";

import ko from "@/i18n/messages/ko.json";
import en from "@/i18n/messages/en.json";
import ja from "@/i18n/messages/ja.json";
import zh from "@/i18n/messages/zh.json";

export type Language = "ko" | "en" | "ja" | "zh";

const messages: Record<Language, any> = { ko, en, ja, zh };

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: "ko", label: "\uD55C\uAD6D\uC5B4", flag: "\uD83C\uDDF0\uD83C\uDDF7" },
  { code: "en", label: "English", flag: "\uD83C\uDDFA\uD83C\uDDF8" },
  { code: "ja", label: "\u65E5\u672C\u8A9E", flag: "\uD83C\uDDEF\uD83C\uDDF5" },
  { code: "zh", label: "\u4E2D\u6587", flag: "\uD83C\uDDE8\uD83C\uDDF3" },
];

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "ko",
      setLanguage: (language) => set({ language }),
    }),
    { name: "moru-language" }
  )
);

// Translation hook
export function useT() {
  const { language } = useLanguageStore();
  const t = (key: string): string => {
    const keys = key.split(".");
    let value: any = messages[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return typeof value === "string" ? value : key;
  };
  return { t, language };
}

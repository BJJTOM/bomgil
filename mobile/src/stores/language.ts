import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Language = 'ko' | 'en' | 'ja' | 'zh';

export const LANGUAGES: { code: Language; label: string; flag: string }[] = [
  { code: 'ko', label: '한국어', flag: '\uD83C\uDDF0\uD83C\uDDF7' },
  { code: 'en', label: 'English', flag: '\uD83C\uDDFA\uD83C\uDDF8' },
  { code: 'ja', label: '日本語', flag: '\uD83C\uDDEF\uD83C\uDDF5' },
  { code: 'zh', label: '中文', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
];

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: 'ko',
      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'moru-language',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

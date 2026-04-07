import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'system',
      isDark: Appearance.getColorScheme() === 'dark',
      setMode: (mode) => {
        const isDark = mode === 'system'
          ? Appearance.getColorScheme() === 'dark'
          : mode === 'dark';
        set({ mode, isDark });
      },
    }),
    {
      name: 'moru-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

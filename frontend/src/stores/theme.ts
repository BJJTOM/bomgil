import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Theme store for the web frontend — persists the user's choice and lets
 * a tiny bootstrap script in layout.tsx read it synchronously to avoid
 * a light-mode flash on first paint.
 *
 * Resolution order:
 *   "system" → matches prefers-color-scheme
 *   "light" / "dark" → explicit override
 *
 * The actual DOM class toggling lives in ThemeInit.tsx, which subscribes
 * to the store and writes `document.documentElement.classList.toggle("dark", ...)`.
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: "light",
      setMode: (mode) => set({ mode }),
    }),
    { name: "moru-theme" },
  ),
);

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "dark") return "dark";
  if (mode === "light") return "light";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

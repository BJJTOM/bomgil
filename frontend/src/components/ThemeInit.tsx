"use client";

import { useEffect } from "react";
import { resolveTheme, useThemeStore } from "@/stores/theme";

/**
 * Keeps <html class="dark"> in sync with the theme store. The initial
 * paint is handled by an inline bootstrap script in layout.tsx so there
 * is no FOUC; this component takes over once React hydrates and also
 * listens to OS-level changes when mode === "system".
 */
export function ThemeInit() {
  const mode = useThemeStore((s) => s.mode);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const resolved = resolveTheme(mode);
      root.classList.toggle("dark", resolved === "dark");
    };
    apply();

    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply();
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, [mode]);

  return null;
}

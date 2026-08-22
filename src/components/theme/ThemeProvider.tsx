"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_ACCENT, DEFAULT_THEME, ACCENTS, THEMES } from "@/lib/themes";

interface ThemeContextValue {
  theme: string;
  accent: string;
  setTheme: (t: string) => void;
  setAccent: (a: string) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  accent: DEFAULT_ACCENT,
  setTheme: () => {},
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Bootstrap from <html data-theme/data-accent> attributes set by the
  // inline bootstrap script in layout.tsx. This way the persisted choice
  // survives reloads without a flash.
  const [theme, setThemeState] = useState<string>(() => {
    if (typeof document === "undefined") return DEFAULT_THEME;
    return document.documentElement.dataset.theme ?? DEFAULT_THEME;
  });
  const [accent, setAccentState] = useState<string>(() => {
    if (typeof document === "undefined") return DEFAULT_ACCENT;
    return document.documentElement.dataset.accent ?? DEFAULT_ACCENT;
  });

  // Re-sync if another tab updates the persisted choice.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "lucian-theme" && e.newValue) {
        setThemeState(e.newValue);
      } else if (e.key === "lucian-accent" && e.newValue) {
        setAccentState(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTheme = (t: string) => {
    setThemeState(t);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = t;
    }
  };

  const setAccent = (a: string) => {
    setAccentState(a);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.accent = a;
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { THEMES, ACCENTS };

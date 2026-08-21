"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  LEGACY_ACCENT_STORAGE_KEY,
  LEGACY_THEME_STORAGE_KEY,
  THEME_IDS,
  THEME_STORAGE_KEY,
  type AccentId,
  type ThemeId,
} from "@/lib/themes";

interface ThemeContextValue {
  theme: ThemeId;
  accent: AccentId;
  setTheme: (theme: ThemeId) => void;
  setAccent: (accent: AccentId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredWithFallback<T extends string>(
  key: string,
  legacyKey: string,
  valid: readonly string[],
  fallback: T
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value && valid.includes(value)) return value as T;
    const legacy = window.localStorage.getItem(legacyKey);
    if (legacy && valid.includes(legacy)) {
      // migrate legacy to new key
      try {
        window.localStorage.setItem(key, legacy);
      } catch {}
      return legacy as T;
    }
  } catch {
    /* storage unavailable */
  }
  return fallback;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [accent, setAccentState] = useState<AccentId>(DEFAULT_ACCENT);

  // Sync React state with what the inline bootstrap script already applied.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(readStoredWithFallback(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEY, THEME_IDS, DEFAULT_THEME));
    setAccentState(readStoredWithFallback(ACCENT_STORAGE_KEY, LEGACY_ACCENT_STORAGE_KEY, ACCENT_IDS, DEFAULT_ACCENT));
  }, []);

  const setTheme = useCallback((next: ThemeId) => {
    setThemeState(next);
    document.documentElement.dataset.theme = next;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    document.documentElement.dataset.accent = next;
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}

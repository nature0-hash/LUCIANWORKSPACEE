"use client";

import { useCallback, useEffect, useState } from "react";

const FAVORITES_KEY = "lucian-markets-favorites";

/** Hook: load + persist favorites as a Set<string> of symbols.
    Shared between the InstrumentsPanel and the per-pane Change Instrument
    popover so both read/write the same localStorage-backed set. */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        setFavorites(new Set(arr));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggle = useCallback(
    (symbol: string) => {
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(symbol)) next.delete(symbol);
        else next.add(symbol);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { favorites, toggle };
}

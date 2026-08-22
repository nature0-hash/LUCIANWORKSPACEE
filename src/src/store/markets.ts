"use client";

// LUCIAN Market Terminal — state management.
//
// Holds: selected instrument, current timeframe, watchlist, live prices,
// paper account state, risk rules, and the current trading mode (PAPER/REAL).

import { create } from "zustand";
import type {
  AccountState,
  Instrument,
  PriceUpdate,
  RiskRules,
  Ticker,
  Timeframe,
  WatchlistEntry,
} from "@/lib/markets/types";
import { loadRiskRules, saveRiskRules, DEFAULT_RISK_RULES } from "@/lib/markets/risk-engine";
import { getAccountState } from "@/lib/markets/paper-trading";
import { registerProvider, getProvider } from "@/lib/markets/provider";
import { BinanceProvider } from "@/lib/markets/binance-provider";

const WATCHLIST_KEY = "lucian-markets-watchlist";

function loadWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function saveWatchlist(list: WatchlistEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

interface MarketsState {
  // Trading mode
  mode: "paper" | "real";
  setMode: (m: "paper" | "real") => void;

  // Instruments
  instruments: Instrument[];
  loadingInstruments: boolean;
  refreshInstruments: () => Promise<void>;

  // Selected instrument
  selectedSymbol: string | null;
  selectSymbol: (symbol: string) => void;

  // Timeframe
  timeframe: Timeframe;
  setTimeframe: (t: Timeframe) => void;

  // Live prices (symbol → price)
  prices: Map<string, number>;
  updatePrice: (update: PriceUpdate) => void;

  // Tickers (symbol → 24h stats)
  tickers: Map<string, Ticker>;
  updateTicker: (symbol: string, ticker: Ticker) => void;

  // Watchlist
  watchlist: WatchlistEntry[];
  addToWatchlist: (entry: WatchlistEntry) => void;
  removeFromWatchlist: (symbol: string) => void;

  // Risk rules
  riskRules: RiskRules;
  updateRiskRules: (rules: RiskRules) => void;

  // Account (paper)
  account: AccountState | null;
  refreshAccount: () => void;

  // Provider initialized
  initialized: boolean;
  initialize: () => void;
}

// Register the Binance provider on module load (client-side only).
if (typeof window !== "undefined") {
  registerProvider(BinanceProvider);
}

export const useMarketsStore = create<MarketsState>((set, get) => ({
  mode: "paper",
  setMode: (m) => set({ mode: m }),

  instruments: [],
  loadingInstruments: false,

  refreshInstruments: async () => {
    set({ loadingInstruments: true });
    try {
      const provider = getProvider("crypto");
      if (!provider) {
        set({ loadingInstruments: false });
        return;
      }
      const instruments = await provider.listInstruments();
      set({ instruments, loadingInstruments: false });
      // Auto-select the first instrument if none is selected.
      if (!get().selectedSymbol && instruments.length > 0) {
        set({ selectedSymbol: instruments[0].symbol });
      }
    } catch (err) {
      console.error("Failed to load instruments:", err);
      set({ loadingInstruments: false });
    }
  },

  selectedSymbol: null,
  selectSymbol: (symbol) => set({ selectedSymbol: symbol }),

  timeframe: "1h",
  setTimeframe: (t) => set({ timeframe: t }),

  prices: new Map(),
  updatePrice: (update) => {
    set((s) => {
      const next = new Map(s.prices);
      next.set(update.symbol, update.price);
      return { prices: next };
    });
  },

  tickers: new Map(),
  updateTicker: (symbol, ticker) => {
    set((s) => {
      const next = new Map(s.tickers);
      next.set(symbol, ticker);
      return { tickers: next };
    });
  },

  watchlist: loadWatchlist(),
  addToWatchlist: (entry) => {
    set((s) => {
      if (s.watchlist.some((w) => w.symbol === entry.symbol)) return s;
      const next = [...s.watchlist, entry];
      saveWatchlist(next);
      return { watchlist: next };
    });
  },
  removeFromWatchlist: (symbol) => {
    set((s) => {
      const next = s.watchlist.filter((w) => w.symbol !== symbol);
      saveWatchlist(next);
      return { watchlist: next };
    });
  },

  riskRules: typeof window !== "undefined" ? loadRiskRules() : DEFAULT_RISK_RULES,
  updateRiskRules: (rules) => {
    saveRiskRules(rules);
    set({ riskRules: rules });
  },

  account: null,
  refreshAccount: () => {
    const prices = get().prices;
    const account = getAccountState(prices);
    set({ account });
  },

  initialized: false,
  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });
    // Load instruments on first use.
    void get().refreshInstruments();
  },
}));

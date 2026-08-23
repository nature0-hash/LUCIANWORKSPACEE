"use client";

// LUCIAN Market Terminal — state management.
//
// Holds: selected instrument, current timeframe, watchlist, live prices,
// paper account state, risk rules, and the current trading mode (PAPER/REAL).

import { create } from "zustand";
import type {
  AccountState,
  ClosedPosition,
  Instrument,
  PendingOrder,
  Position,
  PriceUpdate,
  RiskRules,
  Ticker,
  Timeframe,
  WatchlistEntry,
} from "@/lib/markets/types";
import { loadRiskRules, saveRiskRules, DEFAULT_RISK_RULES } from "@/lib/markets/risk-engine";
import {
  getAccountState,
  getOpenPositions,
  getClosedPositions,
  getPendingOrders,
  openPosition,
  placePendingOrder,
  closePositionsByIds,
  cancelPendingOrder,
} from "@/lib/markets/paper-trading";
import { registerProvider, getProvider } from "@/lib/markets/provider";
import { BinanceProvider } from "@/lib/markets/binance-provider";
import type { OrderSide } from "@/lib/markets/types";

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

  // Open positions / pending orders / closed history (from paper-trading)
  positions: Position[];
  pendingOrders: PendingOrder[];
  closedPositions: ClosedPosition[];
  refreshTrading: () => void;

  // Place a market order via the Virtual engine.
  placeMarketOrder: (
    symbol: string,
    side: OrderSide,
    entryPrice: number,
    quantity: number,
    stopLoss?: number,
    takeProfit?: number,
  ) => { success: boolean; error?: string };

  // Place a pending order via the Virtual engine.
  placePending: (
    symbol: string,
    side: OrderSide,
    type: PendingOrder["type"],
    price: number,
    quantity: number,
    stopLoss?: number,
    takeProfit?: number,
  ) => { success: boolean; error?: string };

  // Close positions matching a given filter, using the current bid/ask
  // prices for the symbol of each position as the exit price.
  closeMatching: (
    filter: "all" | "profitable" | "losing" | "long" | "short",
  ) => { closed: number; realizedPnl: number };

  // Cancel a single pending order.
  cancelPending: (orderId: string) => void;

  // Provider initialized
  initialized: boolean;
  initialize: () => void;

  // ── Left contextual panel mode (Instruments | OrderDetails) ──
  // Controls which view occupies the left contextual panel beside the
  // Markets rail. Defaults to "instruments". The "New order" button in
  // the chart toolbar switches this to "order"; the X inside the order
  // details panel switches it back.
  leftPanelMode: "instruments" | "order";
  setLeftPanelMode: (m: "instruments" | "order") => void;
  // Toggle the Instruments panel's visibility from the chart toolbar.
  // Implemented at the MarketsFrame level (sets panelOpen state), but
  // exposed here so the chart toolbar can call it without prop drilling.
  onToggleInstruments?: () => void;
  setToggleInstrumentsHandler: (fn: (() => void) | undefined) => void;
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

  selectedSymbol: "EURUSD",
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

  // ── Trading state (positions / pending / closed) ─────────────────
  // Loaded synchronously from the paper-trading localStorage layer on
  // the client. SSR-safe defaults (empty arrays).
  positions: typeof window !== "undefined" ? getOpenPositions() : [],
  pendingOrders: typeof window !== "undefined" ? getPendingOrders() : [],
  closedPositions: typeof window !== "undefined" ? getClosedPositions() : [],

  refreshTrading: () => {
    set({
      positions: getOpenPositions(),
      pendingOrders: getPendingOrders(),
      closedPositions: getClosedPositions(),
      account: getAccountState(get().prices),
    });
  },

  placeMarketOrder: (symbol, side, entryPrice, quantity, stopLoss = 0, takeProfit = 0) => {
    const rules = get().riskRules;
    const result = openPosition(
      symbol,
      side,
      entryPrice,
      quantity,
      stopLoss,
      takeProfit,
      rules,
    );
    // After open, refresh trading + account state so the bottom panel
    // and top metrics reflect the new position immediately.
    get().refreshTrading();
    return result.success
      ? { success: true }
      : { success: false, error: result.error };
  },

  placePending: (symbol, side, type, price, quantity, stopLoss = 0, takeProfit = 0) => {
    const rules = get().riskRules;
    const result = placePendingOrder(
      symbol,
      side,
      type,
      price,
      quantity,
      stopLoss,
      takeProfit,
      rules,
    );
    get().refreshTrading();
    return result.success
      ? { success: true }
      : { success: false, error: result.error };
  },

  closeMatching: (filter) => {
    const prices = get().prices;
    // Build exit-price map: for each open position's symbol, use the
    // last known price. If no live price is available, skip that symbol.
    const exitBySymbol = new Map<string, number>();
    for (const pos of get().positions) {
      if (!exitBySymbol.has(pos.symbol)) {
        const p = prices.get(pos.symbol);
        if (p !== undefined) exitBySymbol.set(pos.symbol, p);
      }
    }
    // Apply filter to current positions.
    const matching = get().positions.filter((p) => {
      switch (filter) {
        case "all":
          return true;
        case "profitable":
          return p.unrealizedPnl > 0;
        case "losing":
          return p.unrealizedPnl < 0;
        case "long":
          return p.side === "buy";
        case "short":
          return p.side === "sell";
        default:
          return false;
      }
    });
    const ids = matching.map((p) => p.id);
    const result = closePositionsByIds(ids, exitBySymbol);
    get().refreshTrading();
    return result;
  },

  cancelPending: (orderId) => {
    cancelPendingOrder(orderId);
    get().refreshTrading();
  },

  // ── Left contextual panel mode ──
  leftPanelMode: "instruments",
  setLeftPanelMode: (m) => set({ leftPanelMode: m }),
  setToggleInstrumentsHandler: (fn) => set({ onToggleInstruments: fn }),

  initialized: false,
  initialize: () => {
    if (get().initialized) return;
    set({ initialized: true });
    // Load instruments on first use.
    void get().refreshInstruments();
  },
}));

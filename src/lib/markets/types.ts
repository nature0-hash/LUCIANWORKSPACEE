// Markets type stubs — minimal type surface so the markets store compiles.
// (The actual market UI is intentionally cleared per the user request —
// the workspace shows a blank slate for the Markets section.)

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export interface Instrument {
  symbol: string;
  base: string;
  quote: string;
  name: string;
  exchange: string;
  kind: "crypto" | "stock" | "forex" | "futures";
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  ts: number;
}

export interface Ticker {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  high: number;
  low: number;
  volume: number;
}

export interface WatchlistEntry {
  symbol: string;
  note?: string;
  addedAt: number;
}

export interface AccountState {
  balance: number;
  margin: number;
  freeMargin: number;
  marginLevel: number;
  equity: number;
  floatingPnl: number;
  openPositions: unknown[];
}

export interface RiskRules {
  maxRiskPerTrade: number;
  maxDailyLoss: number;
  maxOpenPositions: number;
}

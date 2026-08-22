// LUCIAN Market Terminal — core domain types.
//
// These types describe market instruments, candle data, ticker data,
// and the provider-adapter architecture that lets LUCIAN connect to
// multiple data sources (Binance for crypto, future providers for
// forex/stocks/indices) without being permanently tied to one.

/** Asset class / market category. */
export type AssetClass =
  | "crypto"
  | "forex"
  | "stocks"
  | "indices"
  | "metals"
  | "energies"
  | "commodities";

/** A tradeable instrument. */
export interface Instrument {
  /** Stable symbol, e.g. "BTCUSDT" or "EUR/USD". */
  symbol: string;
  /** Display name, e.g. "Bitcoin / Tether". */
  name: string;
  /** Asset class. */
  assetClass: AssetClass;
  /** Base asset, e.g. "BTC". */
  base: string;
  /** Quote asset, e.g. "USDT". */
  quote: string;
  /** Price precision (decimal places). */
  pricePrecision: number;
  /** Quantity precision (decimal places). */
  quantityPrecision: number;
}

/** OHLCV candle. */
export interface Candle {
  /** Open time as a UTC timestamp in seconds (for lightweight-charts). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** 24-hour ticker statistics. */
export interface Ticker {
  symbol: string;
  /** Last traded price. */
  lastPrice: number;
  /** Price change over 24h (absolute). */
  priceChange: number;
  /** Price change percent over 24h. */
  priceChangePercent: number;
  /** Highest price in 24h. */
  highPrice: number;
  /** Lowest price in 24h. */
  lowPrice: number;
  /** Total traded volume in base asset. */
  volume: number;
  /** Total traded volume in quote asset. */
  quoteVolume: number;
  /** Best bid price. */
  bidPrice: number;
  /** Best ask price. */
  askPrice: number;
}

/** Real-time price update (from WebSocket). */
export interface PriceUpdate {
  symbol: string;
  price: number;
  /** Timestamp in seconds. */
  time: number;
}

/** Supported chart timeframes. */
export type Timeframe = "1m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d" | "1w";

/** Data connection status — always tells the truth. */
export type DataStatus = "live" | "delayed" | "disconnected" | "setup-required";

/** Order side. */
export type OrderSide = "buy" | "sell";

/** Order type. */
export type OrderType = "market" | "limit" | "stop";

/** An open position in paper trading. */
export interface Position {
  id: string;
  symbol: string;
  side: OrderSide;
  /** Entry price. */
  entryPrice: number;
  /** Position size in base asset. */
  quantity: number;
  /** Stop-loss price (0 = not set). */
  stopLoss: number;
  /** Take-profit price (0 = not set). */
  takeProfit: number;
  /** Open timestamp (ms). */
  openedAt: number;
  /** Current unrealized P/L (updated live from market data). */
  unrealizedPnl: number;
  /** Position value at entry (entryPrice * quantity). */
  entryValue: number;
}

/** A closed position with realized P/L. */
export interface ClosedPosition {
  id: string;
  symbol: string;
  side: OrderSide;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  realizedPnl: number;
  openedAt: number;
  closedAt: number;
}

/** A pending order. */
export interface PendingOrder {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  /** Limit/stop price (0 for market). */
  price: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  createdAt: number;
}

/** Account state. */
export interface AccountState {
  /** PAPER or REAL. */
  mode: "paper" | "real";
  /** Starting balance. */
  startingBalance: number;
  /** Current balance (cash, not including open positions). */
  balance: number;
  /** Equity = balance + floating P/L. */
  equity: number;
  /** Margin used by open positions. */
  margin: number;
  /** Free margin = equity - margin. */
  freeMargin: number;
  /** Margin level = (equity / margin) * 100, or 0 if no margin. */
  marginLevel: number;
  /** Total floating P/L (sum of unrealized P/L across positions). */
  floatingPnl: number;
}

/** Risk rule configuration. */
export interface RiskRules {
  /** Max risk per trade as % of equity (0 = disabled). */
  maxRiskPerTrade: number;
  /** Max position size in quote currency (0 = disabled). */
  maxPositionSize: number;
  /** Max daily loss as % of equity (0 = disabled). */
  maxDailyLoss: number;
  /** Max weekly loss as % of equity (0 = disabled). */
  maxWeeklyLoss: number;
  /** Max simultaneous open positions (0 = unlimited). */
  maxOpenPositions: number;
  /** Max leverage (0 = disabled / 1x only). */
  maxLeverage: number;
  /** Allowed asset classes (empty = all). */
  allowedAssetClasses: AssetClass[];
  /** Trading cooldown in minutes after a loss (0 = disabled). */
  tradingCooldownMin: number;
  /** Loss-streak protection: pause after N consecutive losses (0 = disabled). */
  lossStreakProtection: number;
}

/** Result of a risk check. */
export interface RiskCheckResult {
  passed: boolean;
  /** Why it failed (when passed=false). */
  reason?: string;
  /** Which rule was violated. */
  rule?: string;
}

/** Watchlist entry. */
export interface WatchlistEntry {
  symbol: string;
  name: string;
  assetClass: AssetClass;
}

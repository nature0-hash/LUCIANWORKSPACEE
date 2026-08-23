// LUCIAN Markets — static instruments catalog.
//
// The reference terminal shows a mix of forex, crypto, indices, metals,
// energies, and intraday (CFD stocks) instruments. We mirror that exact
// visible selection here as a static catalog. Live prices from the
// Binance provider will overlay on the crypto symbols when available; all
// other symbols show "Market closed" status honestly (no fake data).

import type { AssetClass, Instrument } from "./types";

/** Extra category used by the reference terminal — Intraday is a CFD
    stock selection that uses the same underlying `stocks` AssetClass. */
export type InstrumentCategory =
  | "all"
  | "forex"
  | "crypto"
  | "indices"
  | "metals"
  | "energies"
  | "intraday";

export interface CatalogInstrument extends Instrument {
  /** UI category shown in the filter chips.
      NOTE: a stock can be `intraday` for filtering while still reporting
      assetClass `stocks` to the underlying provider system. */
  category: Exclude<InstrumentCategory, "all">;
  /** Optional small icon glyph shown to the left of the row.
      We use short text badges (BTC, EUR, XAU, …) instead of logo PNGs —
      keeps the build self-contained and visually clean. */
  badge: string;
  /** Whether the market is currently open (affects status text shown). */
  marketOpen: boolean;
}

export const INSTRUMENT_CATALOG: CatalogInstrument[] = [
  // ── Forex ───────────────────────────────────────────────────────────
  { symbol: "EURUSD", name: "Euro / US Dollar", assetClass: "forex", base: "EUR", quote: "USD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "EUR", marketOpen: false },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", assetClass: "forex", base: "GBP", quote: "USD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "GBP", marketOpen: false },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", assetClass: "forex", base: "USD", quote: "JPY", pricePrecision: 3, quantityPrecision: 2, category: "forex", badge: "JPY", marketOpen: false },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen", assetClass: "forex", base: "GBP", quote: "JPY", pricePrecision: 3, quantityPrecision: 2, category: "forex", badge: "JPY", marketOpen: false },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", assetClass: "forex", base: "AUD", quote: "USD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "AUD", marketOpen: false },
  { symbol: "USDCAD", name: "US Dollar / Canadian Dollar", assetClass: "forex", base: "USD", quote: "CAD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "CAD", marketOpen: false },
  { symbol: "USDCHF", name: "US Dollar / Swiss Franc", assetClass: "forex", base: "USD", quote: "CHF", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "CHF", marketOpen: false },
  { symbol: "EURJPY", name: "Euro / Japanese Yen", assetClass: "forex", base: "EUR", quote: "JPY", pricePrecision: 3, quantityPrecision: 2, category: "forex", badge: "JPY", marketOpen: false },
  { symbol: "EURGBP", name: "Euro / British Pound", assetClass: "forex", base: "EUR", quote: "GBP", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "EUR", marketOpen: false },
  { symbol: "AUDJPY", name: "Australian Dollar / Japanese Yen", assetClass: "forex", base: "AUD", quote: "JPY", pricePrecision: 3, quantityPrecision: 2, category: "forex", badge: "JPY", marketOpen: false },
  { symbol: "EURAUD", name: "Euro / Australian Dollar", assetClass: "forex", base: "EUR", quote: "AUD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "EUR", marketOpen: false },
  { symbol: "NZDUSD", name: "New Zealand Dollar / US Dollar", assetClass: "forex", base: "NZD", quote: "USD", pricePrecision: 5, quantityPrecision: 2, category: "forex", badge: "NZD", marketOpen: false },

  // ── Crypto ──────────────────────────────────────────────────────────
  { symbol: "BTCUSD", name: "Bitcoin / US Dollar", assetClass: "crypto", base: "BTC", quote: "USD", pricePrecision: 2, quantityPrecision: 6, category: "crypto", badge: "₿", marketOpen: true },
  { symbol: "ETHUSD", name: "Ethereum / US Dollar", assetClass: "crypto", base: "ETH", quote: "USD", pricePrecision: 2, quantityPrecision: 5, category: "crypto", badge: "Ξ", marketOpen: true },
  { symbol: "XRPUSD", name: "Ripple / US Dollar", assetClass: "crypto", base: "XRP", quote: "USD", pricePrecision: 4, quantityPrecision: 2, category: "crypto", badge: "XRP", marketOpen: true },
  { symbol: "SOLUSD", name: "Solana / US Dollar", assetClass: "crypto", base: "SOL", quote: "USD", pricePrecision: 2, quantityPrecision: 3, category: "crypto", badge: "SOL", marketOpen: true },
  { symbol: "BCHUSD", name: "Bitcoin Cash / US Dollar", assetClass: "crypto", base: "BCH", quote: "USD", pricePrecision: 2, quantityPrecision: 4, category: "crypto", badge: "BCH", marketOpen: true },
  { symbol: "LTCUSD", name: "Litecoin / US Dollar", assetClass: "crypto", base: "LTC", quote: "USD", pricePrecision: 2, quantityPrecision: 4, category: "crypto", badge: "LTC", marketOpen: true },
  { symbol: "DOGEUSD", name: "Dogecoin / US Dollar", assetClass: "crypto", base: "DOGE", quote: "USD", pricePrecision: 5, quantityPrecision: 2, category: "crypto", badge: "DGE", marketOpen: true },
  { symbol: "BNBUSD", name: "BNB / US Dollar", assetClass: "crypto", base: "BNB", quote: "USD", pricePrecision: 2, quantityPrecision: 3, category: "crypto", badge: "BNB", marketOpen: true },
  { symbol: "ADAUSD", name: "Cardano / US Dollar", assetClass: "crypto", base: "ADA", quote: "USD", pricePrecision: 4, quantityPrecision: 2, category: "crypto", badge: "ADA", marketOpen: true },
  { symbol: "LINKUSD", name: "Chainlink / US Dollar", assetClass: "crypto", base: "LINK", quote: "USD", pricePrecision: 3, quantityPrecision: 2, category: "crypto", badge: "LNK", marketOpen: true },
  { symbol: "GRTUSD", name: "The Graph / US Dollar", assetClass: "crypto", base: "GRT", quote: "USD", pricePrecision: 4, quantityPrecision: 2, category: "crypto", badge: "GRT", marketOpen: true },
  { symbol: "FILUSD", name: "Filecoin / US Dollar", assetClass: "crypto", base: "FIL", quote: "USD", pricePrecision: 3, quantityPrecision: 2, category: "crypto", badge: "FIL", marketOpen: true },
  { symbol: "DASHUSD", name: "Dash / US Dollar", assetClass: "crypto", base: "DASH", quote: "USD", pricePrecision: 2, quantityPrecision: 3, category: "crypto", badge: "DSH", marketOpen: true },
  { symbol: "BTCUSD.Daily", name: "Bitcoin Daily", assetClass: "crypto", base: "BTC", quote: "USD", pricePrecision: 2, quantityPrecision: 6, category: "crypto", badge: "₿", marketOpen: true },

  // ── Indices ─────────────────────────────────────────────────────────
  { symbol: "NAS100", name: "US Nasdaq 100", assetClass: "indices", base: "NAS100", quote: "USD", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "NDX", marketOpen: false },
  { symbol: "US30", name: "Dow Jones 30", assetClass: "indices", base: "US30", quote: "USD", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "DJI", marketOpen: false },
  { symbol: "SPX500", name: "S&P 500", assetClass: "indices", base: "SPX500", quote: "USD", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "SPX", marketOpen: false },
  { symbol: "FRA40", name: "CAC 40", assetClass: "indices", base: "FRA40", quote: "EUR", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "CAC", marketOpen: false },
  { symbol: "EUSTX50", name: "Euro Stoxx 50", assetClass: "indices", base: "EUSTX50", quote: "EUR", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "SX5E", marketOpen: false },
  { symbol: "ESP35", name: "IBEX 35", assetClass: "indices", base: "ESP35", quote: "EUR", pricePrecision: 1, quantityPrecision: 2, category: "indices", badge: "IBX", marketOpen: false },

  // ── Metals ─────────────────────────────────────────────────────────
  { symbol: "XAUUSD", name: "Gold / US Dollar", assetClass: "metals", base: "XAU", quote: "USD", pricePrecision: 2, quantityPrecision: 3, category: "metals", badge: "Au", marketOpen: false },
  { symbol: "XAGUSD", name: "Silver / US Dollar", assetClass: "metals", base: "XAG", quote: "USD", pricePrecision: 3, quantityPrecision: 3, category: "metals", badge: "Ag", marketOpen: false },

  // ── Energies ───────────────────────────────────────────────────────
  { symbol: "XTIUSD", name: "WTI Crude Oil", assetClass: "energies", base: "XTI", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "energies", badge: "WTI", marketOpen: false },
  { symbol: "XBRUSD", name: "Brent Crude Oil", assetClass: "energies", base: "XBR", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "energies", badge: "BRT", marketOpen: false },

  // ── Intraday (CFD / daily stocks) ──────────────────────────────────
  { symbol: "TSLA.Daily", name: "Tesla Inc. (Daily)", assetClass: "stocks", base: "TSLA", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "TSL", marketOpen: false },
  { symbol: "NVDA.Daily", name: "NVIDIA Corp. (Daily)", assetClass: "stocks", base: "NVDA", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "NVD", marketOpen: false },
  { symbol: "NFLX.Daily", name: "Netflix Inc. (Daily)", assetClass: "stocks", base: "NFLX", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "NFL", marketOpen: false },
  { symbol: "AMZN.Daily", name: "Amazon.com (Daily)", assetClass: "stocks", base: "AMZN", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "AMZ", marketOpen: false },
  { symbol: "AAPL.Daily", name: "Apple Inc. (Daily)", assetClass: "stocks", base: "AAPL", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "AAP", marketOpen: false },
  { symbol: "GOOGL.Daily", name: "Alphabet Inc. (Daily)", assetClass: "stocks", base: "GOOGL", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "GGL", marketOpen: false },
  { symbol: "META.Daily", name: "Meta Platforms (Daily)", assetClass: "stocks", base: "META", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "MTA", marketOpen: false },
  { symbol: "BABA.Daily", name: "Alibaba Group (Daily)", assetClass: "stocks", base: "BABA", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "BAB", marketOpen: false },
  { symbol: "MSFT.Daily", name: "Microsoft Corp. (Daily)", assetClass: "stocks", base: "MSFT", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "MSF", marketOpen: false },
  { symbol: "AMD.Daily", name: "Adv. Micro Devices (Daily)", assetClass: "stocks", base: "AMD", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "AMD", marketOpen: false },
  { symbol: "SHOP.Daily", name: "Shopify Inc. (Daily)", assetClass: "stocks", base: "SHOP", quote: "USD", pricePrecision: 2, quantityPrecision: 2, category: "intraday", badge: "SHP", marketOpen: false },
];

/** Filter the catalog by UI category. "all" returns everything. */
export function filterByCategory(
  category: InstrumentCategory,
): CatalogInstrument[] {
  if (category === "all") return INSTRUMENT_CATALOG;
  return INSTRUMENT_CATALOG.filter((i) => i.category === category);
}

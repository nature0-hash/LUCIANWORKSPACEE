"use client";

// Binance public API provider — REAL live crypto market data.
//
// Binance's public REST + WebSocket APIs are free and require NO
// authentication for market data (candles, tickers, trades). This gives
// us genuinely live, real-time data for hundreds of crypto pairs.
//
// API documentation:
//   REST: https://binance-docs.github.io/apidocs/spot/en/
//   WS:   wss://stream.binance.com:9443/ws/<stream>
//
// Rate limits (public, IP-based):
//   1200 requests/min for REST
//   No limit on WebSocket connections
//
// This provider is registered on app start via `registerProvider()`.

import type {
  AssetClass,
  Candle,
  DataStatus,
  Instrument,
  PriceUpdate,
  Ticker,
  Timeframe,
} from "./types";
import type { MarketDataProvider } from "./provider";
import { BINANCE_INTERVAL_MAP } from "./provider";

const REST_BASE = "https://api.binance.com";
const WS_BASE = "wss://stream.binance.com:9443/ws";

/** Connection status events emitted by the provider's live streams. */
export type BinanceConnectionStatus =
  | { kind: "connecting" }
  | { kind: "open" }
  | { kind: "closed" }
  | { kind: "error"; message: string };

/**
 * Optional status callback that subscribers can register alongside a price
 * or kline stream so they observe the WebSocket connection lifecycle
 * (open / closed / error). Used by the markets store to flip a symbol's
 * DataStatus between `live` and `disconnected`.
 */
export type StatusCallback = (status: BinanceConnectionStatus) => void;

/** Popular crypto instruments on Binance (USDT pairs). */
const POPULAR_SYMBOLS: { symbol: string; base: string; name: string }[] = [
  { symbol: "BTCUSDT", base: "BTC", name: "Bitcoin / Tether" },
  { symbol: "ETHUSDT", base: "ETH", name: "Ethereum / Tether" },
  { symbol: "BNBUSDT", base: "BNB", name: "BNB / Tether" },
  { symbol: "SOLUSDT", base: "SOL", name: "Solana / Tether" },
  { symbol: "XRPUSDT", base: "XRP", name: "Ripple / Tether" },
  { symbol: "ADAUSDT", base: "ADA", name: "Cardano / Tether" },
  { symbol: "DOGEUSDT", base: "DOGE", name: "Dogecoin / Tether" },
  { symbol: "AVAXUSDT", base: "AVAX", name: "Avalanche / Tether" },
  { symbol: "DOTUSDT", base: "DOT", name: "Polkadot / Tether" },
  { symbol: "LINKUSDT", base: "LINK", name: "Chainlink / Tether" },
  { symbol: "LTCUSDT", base: "LTC", name: "Litecoin / Tether" },
  { symbol: "TRXUSDT", base: "TRX", name: "TRON / Tether" },
  { symbol: "ATOMUSDT", base: "ATOM", name: "Cosmos / Tether" },
  { symbol: "NEARUSDT", base: "NEAR", name: "NEAR / Tether" },
  { symbol: "MATICUSDT", base: "MATIC", name: "Polygon / Tether" },
  { symbol: "APTUSDT", base: "APT", name: "Aptos / Tether" },
  { symbol: "FILUSDT", base: "FIL", name: "Filecoin / Tether" },
  { symbol: "ARBUSDT", base: "ARB", name: "Arbitrum / Tether" },
  { symbol: "OPUSDT", base: "OP", name: "Optimism / Tether" },
  { symbol: "INJUSDT", base: "INJ", name: "Injective / Tether" },
];

export const BinanceProvider: MarketDataProvider = {
  id: "binance",
  label: "Binance (Crypto)",
  assetClass: "crypto" as AssetClass,
  configured: true,
  status: "live" as DataStatus,
  statusLabel: "Live",

  async listInstruments(): Promise<Instrument[]> {
    return POPULAR_SYMBOLS.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      assetClass: "crypto" as AssetClass,
      base: s.base,
      quote: "USDT",
      pricePrecision: 2,
      quantityPrecision: 6,
    }));
  },

  async getCandles(
    symbol: string,
    timeframe: Timeframe,
    limit: number,
  ): Promise<Candle[]> {
    const interval = BINANCE_INTERVAL_MAP[timeframe];
    const url = `${REST_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
    }
    const raw = (await res.json()) as (string | number)[][];
    return raw.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }));
  },

  async getTicker(symbol: string): Promise<Ticker | null> {
    const url = `${REST_BASE}/api/v3/ticker/24hr?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const d = await res.json();
    return {
      symbol: d.symbol,
      lastPrice: parseFloat(d.lastPrice),
      priceChange: parseFloat(d.priceChange),
      priceChangePercent: parseFloat(d.priceChangePercent),
      highPrice: parseFloat(d.highPrice),
      lowPrice: parseFloat(d.lowPrice),
      volume: parseFloat(d.volume),
      quoteVolume: parseFloat(d.quoteVolume),
      bidPrice: parseFloat(d.bidPrice),
      askPrice: parseFloat(d.askPrice),
    };
  },

  subscribePrice(
    symbol: string,
    callback: (update: PriceUpdate) => void,
    onStatus?: StatusCallback,
  ): () => void {
    const stream = symbol.toLowerCase() + "@trade";
    onStatus?.({ kind: "connecting" });
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WS_BASE}/${stream}`);
    } catch (err) {
      onStatus?.({ kind: "error", message: err instanceof Error ? err.message : "WebSocket construction failed" });
      return () => {};
    }

    ws.onopen = () => onStatus?.({ kind: "open" });
    ws.onclose = () => onStatus?.({ kind: "closed" });
    ws.onerror = () =>
      onStatus?.({ kind: "error", message: "WebSocket error" });
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.p && data.T) {
          callback({
            symbol,
            price: parseFloat(data.p),
            time: Math.floor(data.T / 1000),
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };
    return () => {
      // Detach handlers so cleanup doesn't fire spurious status events
      // after the consumer has already torn down.
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  },

  subscribeKline(
    symbol: string,
    timeframe: Timeframe,
    callback: (candle: Candle) => void,
    onStatus?: StatusCallback,
  ): () => void {
    const interval = BINANCE_INTERVAL_MAP[timeframe];
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;
    onStatus?.({ kind: "connecting" });
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${WS_BASE}/${stream}`);
    } catch (err) {
      onStatus?.({ kind: "error", message: err instanceof Error ? err.message : "WebSocket construction failed" });
      return () => {};
    }

    ws.onopen = () => onStatus?.({ kind: "open" });
    ws.onclose = () => onStatus?.({ kind: "closed" });
    ws.onerror = () =>
      onStatus?.({ kind: "error", message: "WebSocket error" });
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const k = data.k;
        if (k) {
          callback({
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v),
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };
    return () => {
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  },
};

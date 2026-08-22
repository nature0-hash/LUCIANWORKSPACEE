// Binance provider stub — registered into the provider registry but
// returns no instruments (the market section is intentionally cleared
// to a blank slate).

import type { Instrument, Ticker } from "./types";
import { type MarketProvider, registerProvider } from "./provider";

export const BinanceProvider: MarketProvider = {
  id: "crypto",
  label: "Binance (offline)",
  status: "offline",
  statusLabel: "Offline",
  listInstruments: async () => [] as Instrument[],
  subscribeTicker: (_symbol: string, _cb: (t: Ticker) => void) => () => {},
};

// Self-register on module load.
if (typeof window !== "undefined") {
  registerProvider(BinanceProvider);
}

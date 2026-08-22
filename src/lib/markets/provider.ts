// Market data provider registry stub.

import type { Instrument, Ticker } from "./types";

export interface MarketProvider {
  id: string;
  label: string;
  status: "live" | "delayed" | "offline";
  statusLabel: string;
  listInstruments: () => Promise<Instrument[]>;
  subscribeTicker: (symbol: string, cb: (t: Ticker) => void) => () => void;
}

const registry = new Map<string, MarketProvider>();

export function registerProvider(provider: MarketProvider | undefined): void {
  if (!provider) return;
  registry.set(provider.id, provider);
}

export function getProvider(id: string): MarketProvider | undefined {
  return registry.get(id);
}

"use client";

import dynamic from "next/dynamic";

// The Market Terminal uses lightweight-charts which references `window`
// during chart creation. We load the terminal client-side only (no SSR) to
// avoid hydration mismatches and to keep the Binance WebSocket / REST
// calls off the server.
const MarketTerminal = dynamic(
  () =>
    import("@/components/markets/market-terminal").then(
      (m) => m.MarketTerminal,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="themed flex h-full w-full items-center justify-center bg-canvas text-fg-muted">
        <div className="flex flex-col items-center gap-2">
          <div className="size-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          <span className="text-xs">Booting LUCIAN Market Terminal…</span>
        </div>
      </div>
    ),
  },
);

export default function HomePage() {
  return <MarketTerminal />;
}

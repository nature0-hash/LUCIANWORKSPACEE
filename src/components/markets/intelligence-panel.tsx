"use client";

import { useState } from "react";
import { Bot, Calendar, Newspaper, Info } from "lucide-react";
import { useMarketsStore } from "@/store/markets";
import { AgentPanel } from "@/components/devspace/agent/agent-panel";
import { cn } from "@/lib/utils";

type Tab = "agent" | "news" | "instrument";

export function IntelligencePanel() {
  const [tab, setTab] = useState<Tab>("agent");
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const instruments = useMarketsStore((s) => s.instruments);
  const prices = useMarketsStore((s) => s.prices);
  const tickers = useMarketsStore((s) => s.tickers);

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const price = selectedSymbol ? prices.get(selectedSymbol) : undefined;
  const ticker = selectedSymbol ? tickers.get(selectedSymbol) : undefined;

  return (
    <div className="themed flex h-full flex-col bg-surface">
      {/* Tab strip */}
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line-muted px-1">
        <TabBtn active={tab === "agent"} onClick={() => setTab("agent")} icon={Bot} label="Agent" />
        <TabBtn active={tab === "news"} onClick={() => setTab("news")} icon={Newspaper} label="News" />
        <TabBtn active={tab === "instrument"} onClick={() => setTab("instrument")} icon={Info} label="Info" />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "agent" ? (
          <AgentPanel />
        ) : tab === "news" ? (
          <div className="flex h-full flex-col items-center justify-center p-4 text-center">
            <Newspaper className="mb-2 h-6 w-6 text-fg-faint" />
            <p className="text-[11px] font-medium text-fg-muted">News source required</p>
            <p className="mt-1 text-[10px] text-fg-faint">
              A legitimate news API (e.g. NewsAPI, Benzinga) needs to be connected. No fake stories are shown.
            </p>
          </div>
        ) : (
          /* Instrument info — shows genuine available market data */
          <div className="overflow-y-auto p-3">
            {instrument ? (
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-fg-faint">Instrument</p>
                  <p className="font-mono font-medium text-fg">{instrument.symbol}</p>
                  <p className="text-[11px] text-fg-muted">{instrument.name}</p>
                </div>
                {price !== undefined && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-fg-faint">Last Price</p>
                    <p className="font-mono text-fg">{price.toFixed(instrument.pricePrecision)}</p>
                  </div>
                )}
                {ticker && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-fg-faint">Bid</p>
                        <p className="font-mono text-fg">{ticker.bidPrice.toFixed(instrument.pricePrecision)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-fg-faint">Ask</p>
                        <p className="font-mono text-fg">{ticker.askPrice.toFixed(instrument.pricePrecision)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[10px] text-fg-faint">24h High</p>
                        <p className="font-mono text-fg">{ticker.highPrice.toFixed(instrument.pricePrecision)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-fg-faint">24h Low</p>
                        <p className="font-mono text-fg">{ticker.lowPrice.toFixed(instrument.pricePrecision)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-fg-faint">24h Change</p>
                      <p className={cn("font-mono", ticker.priceChangePercent >= 0 ? "text-green-500" : "text-red-500")}>
                        {ticker.priceChange >= 0 ? "+" : ""}{ticker.priceChange.toFixed(2)} ({ticker.priceChangePercent.toFixed(2)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-fg-faint">24h Volume</p>
                      <p className="font-mono text-fg">{ticker.volume.toLocaleString("en-US", { maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-fg-faint">24h Quote Volume</p>
                      <p className="font-mono text-fg">${ticker.quoteVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>
                    </div>
                  </>
                )}
                <div>
                  <p className="text-[10px] text-fg-faint">Asset Class</p>
                  <p className="font-mono text-fg capitalize">{instrument.assetClass}</p>
                </div>
              </div>
            ) : (
              <p className="text-center text-[11px] text-fg-faint">No instrument selected.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Bot;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors",
        active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

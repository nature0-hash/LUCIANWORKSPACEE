"use client";

import { useState } from "react";
import { Filter, Newspaper, MessageCircle, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useMarketsStore } from "@/store/markets";
import { cn } from "@/lib/utils";

type Tab = "chat" | "feed";

export function IntelligencePanel() {
  const [tab, setTab] = useState<Tab>("feed");
  const [filter, setFilter] = useState<string>("all");
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const instruments = useMarketsStore((s) => s.instruments);
  const prices = useMarketsStore((s) => s.prices);
  const tickers = useMarketsStore((s) => s.tickers);

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const price = selectedSymbol ? prices.get(selectedSymbol) : undefined;
  const ticker = selectedSymbol ? tickers.get(selectedSymbol) : undefined;

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "analysis", label: "Analysis" },
    { id: "ideas", label: "Ideas" },
    { id: "news", label: "News" },
  ];

  return (
    <div className="flex h-full flex-col bg-[#181b21]">
      {/* Tab strip */}
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-[#1f2329] px-1">
        <TabBtn
          active={tab === "chat"}
          onClick={() => setTab("chat")}
          icon={MessageCircle}
          label="Chat"
        />
        <TabBtn
          active={tab === "feed"}
          onClick={() => setTab("feed")}
          icon={Newspaper}
          label="Feed"
        />
      </div>

      {/* Feed filters */}
      {tab === "feed" && (
        <div className="flex h-6 shrink-0 items-center gap-0.5 border-b border-[#1f2329] px-2">
          <Filter className="h-2.5 w-2.5 text-[#565c66]" />
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors",
                filter === f.id
                  ? "bg-[#3b82f6] text-white"
                  : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "chat" ? (
          <ChatPanel
            instrument={instrument}
            price={price}
            ticker={ticker}
          />
        ) : (
          <FeedPanel
            instrument={instrument}
            price={price}
            ticker={ticker}
            filter={filter}
          />
        )}
      </div>
    </div>
  );
}

function ChatPanel({
  instrument,
  price,
  ticker,
}: {
  instrument: import("@/lib/markets/types").Instrument | undefined;
  price: number | undefined;
  ticker: import("@/lib/markets/types").Ticker | undefined;
}) {
  return (
    <div className="flex h-full flex-col p-3">
      {/* Market context */}
      {instrument && (
        <div className="mb-2 rounded border border-[#1f2329] bg-[#1a1d23] p-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] font-medium text-white">
              {instrument.symbol}
            </span>
            {price !== undefined && (
              <span className="font-mono text-[11px] text-white">
                {price.toFixed(instrument.pricePrecision)}
              </span>
            )}
          </div>
          {ticker && (
            <div className="mt-1 flex items-center gap-2 text-[9px]">
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  ticker.priceChangePercent >= 0
                    ? "text-[#00c087]"
                    : "text-[#ff4757]",
                )}
              >
                {ticker.priceChangePercent >= 0 ? (
                  <TrendingUp className="h-2.5 w-2.5" />
                ) : (
                  <TrendingDown className="h-2.5 w-2.5" />
                )}
                {ticker.priceChangePercent >= 0 ? "+" : ""}
                {ticker.priceChangePercent.toFixed(2)}%
              </span>
              <span className="text-[#565c66]">
                H: {ticker.highPrice.toFixed(2)}
              </span>
              <span className="text-[#565c66]">
                L: {ticker.lowPrice.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        <div className="rounded border border-[#1f2329] bg-[#1a1d23] p-2.5 text-[11px]">
          <p className="font-medium text-white">LUCIAN Market Assistant</p>
          <p className="mt-1 text-[10px] text-[#8b949e]">
            This is LUCIAN&apos;s market conversation area. Connect a model
            provider to enable AI-powered market analysis.
          </p>
        </div>

        {/* Quick prompts */}
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-wide text-[#565c66]">
            Quick prompts
          </p>
          {[
            `Analyze ${instrument?.symbol ?? "BTCUSDT"} price action`,
            `What's the market sentiment on ${instrument?.base ?? "BTC"}?`,
            "Show me today's biggest movers",
            "Compare crypto vs forex performance",
          ].map((prompt) => (
            <button
              key={prompt}
              className="w-full rounded border border-[#1f2329] bg-[#1a1d23] px-2 py-1.5 text-left text-[10px] text-[#8b949e] transition-colors hover:border-[#2d333b] hover:bg-[#22262f]"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="mt-2">
          <textarea
            placeholder="Ask about markets, instruments, or analysis…"
            rows={2}
            className="w-full resize-none rounded border border-[#2d333b] bg-[#13161c] px-2 py-1.5 text-[11px] text-white placeholder:text-[#565c66] focus:outline-none"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[9px] text-[#565c66]">
              Model provider required for AI responses.
            </span>
            <button
              className="rounded bg-[#3b82f6] px-2 py-0.5 text-[10px] font-medium text-white disabled:opacity-50"
              disabled
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedPanel({
  instrument,
  price,
  ticker,
  filter,
}: {
  instrument: import("@/lib/markets/types").Instrument | undefined;
  price: number | undefined;
  ticker: import("@/lib/markets/types").Ticker | undefined;
  filter: string;
}) {
  const feedItems = generateFeedItems(instrument, price, ticker, filter);

  return (
    <div className="space-y-2 p-2">
      {/* Market summary card */}
      {instrument && ticker && (
        <div className="rounded border border-[#1f2329] bg-[#1a1d23] p-2.5">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3 text-[#3b82f6]" />
            <span className="text-[11px] font-medium text-white">
              Market Summary
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
            <FeedRow
              label="Last"
              value={
                price !== undefined
                  ? price.toFixed(instrument.pricePrecision)
                  : "—"
              }
            />
            <FeedRow
              label="Change"
              value={`${ticker.priceChange >= 0 ? "+" : ""}${ticker.priceChangePercent.toFixed(2)}%`}
              color={
                ticker.priceChangePercent >= 0
                  ? "text-[#00c087]"
                  : "text-[#ff4757]"
              }
            />
            <FeedRow
              label="24h High"
              value={ticker.highPrice.toFixed(instrument.pricePrecision)}
            />
            <FeedRow
              label="24h Low"
              value={ticker.lowPrice.toFixed(instrument.pricePrecision)}
            />
            <FeedRow
              label="Volume"
              value={ticker.volume.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            />
            <FeedRow
              label="Bid / Ask"
              value={`${ticker.bidPrice.toFixed(2)} / ${ticker.askPrice.toFixed(2)}`}
            />
          </div>
        </div>
      )}

      {/* Feed items */}
      {feedItems.length > 0 ? (
        feedItems.map((item, i) => (
          <div
            key={i}
            className="rounded border border-[#1f2329] bg-[#1a1d23] p-2.5"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[8px] font-bold uppercase",
                  item.type === "analysis" && "bg-[#3b82f6]/15 text-[#3b82f6]",
                  item.type === "ideas" && "bg-[#8b5cf6]/15 text-[#8b5cf6]",
                  item.type === "news" && "bg-amber-500/15 text-amber-500",
                )}
              >
                {item.type}
              </span>
              <span className="text-[9px] text-[#565c66]">{item.timestamp}</span>
            </div>
            <p className="mt-1 text-[11px] text-white">{item.title}</p>
            <p className="mt-0.5 text-[10px] text-[#8b949e]">{item.body}</p>
          </div>
        ))
      ) : (
        <div className="rounded border border-dashed border-[#1f2329] p-4 text-center">
          <p className="text-[11px] text-[#8b949e]">No feed items for this filter.</p>
          <p className="mt-0.5 text-[10px] text-[#565c66]">
            Feed items are generated from live market data.
          </p>
        </div>
      )}
    </div>
  );
}

function generateFeedItems(
  instrument: import("@/lib/markets/types").Instrument | undefined,
  price: number | undefined,
  ticker: import("@/lib/markets/types").Ticker | undefined,
  filter: string,
): { type: string; title: string; body: string; timestamp: string }[] {
  if (!instrument || !ticker || price === undefined) return [];

  const items: { type: string; title: string; body: string; timestamp: string }[] =
    [];
  const changePct = ticker.priceChangePercent;
  const range = ticker.highPrice - ticker.lowPrice;
  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (filter === "all" || filter === "analysis") {
    const direction = changePct >= 0 ? "bullish" : "bearish";
    const strength =
      Math.abs(changePct) > 5 ? "strong" : Math.abs(changePct) > 2 ? "moderate" : "mild";
    items.push({
      type: "analysis",
      title: `${instrument.symbol} shows ${strength} ${direction} momentum`,
      body: `Price moved ${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}% in 24h, ranging from ${ticker.lowPrice.toFixed(2)} to ${ticker.highPrice.toFixed(2)}. Current: ${price.toFixed(instrument.pricePrecision)}.`,
      timestamp: now,
    });

    if (ticker.volume > 0) {
      items.push({
        type: "analysis",
        title: `Volume: ${ticker.volume.toLocaleString("en-US", { maximumFractionDigits: 0 })} ${instrument.base}`,
        body: `Quote volume: $${ticker.quoteVolume.toLocaleString("en-US", { maximumFractionDigits: 0 })}. ${ticker.quoteVolume > 1000000 ? "High" : ticker.quoteVolume > 100000 ? "Moderate" : "Low"} liquidity.`,
        timestamp: now,
      });
    }
  }

  if (filter === "all" || filter === "ideas") {
    const spread = ticker.askPrice - ticker.bidPrice;
    items.push({
      type: "ideas",
      title: `Spread: ${spread.toFixed(2)} (${((spread / price) * 100).toFixed(3)}%)`,
      body: `Bid: ${ticker.bidPrice.toFixed(2)}, Ask: ${ticker.askPrice.toFixed(2)}. ${spread / price < 0.001 ? "Tight spread." : "Wider spread — consider limit orders."}`,
      timestamp: now,
    });

    const rangePct = (range / ticker.lowPrice) * 100;
    items.push({
      type: "ideas",
      title: `24h range: ${rangePct.toFixed(1)}%`,
      body: `${rangePct > 10 ? "High volatility — wider stops recommended." : rangePct > 5 ? "Moderate volatility." : "Low volatility."}`,
      timestamp: now,
    });
  }

  if (filter === "all" || filter === "news") {
    items.push({
      type: "news",
      title: `${instrument.name} — Live via ${instrument.assetClass} provider`,
      body: `Real-time price data streaming. Symbol: ${instrument.symbol}.`,
      timestamp: now,
    });
  }

  return items;
}

function FeedRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#565c66]">{label}</span>
      <span className={cn("font-mono tabular-nums", color ?? "text-white")}>
        {value}
      </span>
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
  icon: typeof MessageCircle;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-[#3b82f6] text-white"
          : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

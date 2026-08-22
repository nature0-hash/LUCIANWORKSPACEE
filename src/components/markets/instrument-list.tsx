"use client";

import { useState } from "react";
import { Search, Star, StarOff, X } from "lucide-react";
import { useMarketsStore } from "@/store/markets";
import { getProvider, UNCONFIGURED_PROVIDERS } from "@/lib/markets/provider";
import type { AssetClass } from "@/lib/markets/types";
import { cn } from "@/lib/utils";

type Category = AssetClass | "watchlist" | "all";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "watchlist", label: "★" },
  { id: "crypto", label: "Crypto" },
  { id: "forex", label: "Forex" },
  { id: "stocks", label: "Stocks" },
  { id: "indices", label: "Indices" },
  { id: "metals", label: "Metals" },
  { id: "energies", label: "Energy" },
];

export function InstrumentList() {
  const instruments = useMarketsStore((s) => s.instruments);
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const selectSymbol = useMarketsStore((s) => s.selectSymbol);
  const prices = useMarketsStore((s) => s.prices);
  const tickers = useMarketsStore((s) => s.tickers);
  const watchlist = useMarketsStore((s) => s.watchlist);
  const addToWatchlist = useMarketsStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useMarketsStore((s) => s.removeFromWatchlist);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("crypto");

  let displayList = instruments;
  if (category === "watchlist") {
    displayList = instruments.filter((i) =>
      watchlist.some((w) => w.symbol === i.symbol),
    );
  } else {
    displayList = instruments.filter((i) => i.assetClass === category);
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    displayList = displayList.filter(
      (i) =>
        i.symbol.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q),
    );
  }

  const selectedProvider =
    category === "watchlist" || category === "all"
      ? null
      : getProvider(category as AssetClass);
  const unconfiguredProvider = UNCONFIGURED_PROVIDERS.find(
    (p) => p.assetClass === category,
  );
  const isUnconfigured = !selectedProvider && !!unconfiguredProvider;

  return (
    <div className="flex h-full flex-col bg-[#1a1d23]">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-bold text-white">Instruments</span>
        <button className="text-[#565c66] hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 pb-1">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#565c66]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments"
            className="h-7 w-full rounded bg-[#22262f] pl-7 pr-2 text-[11px] text-white placeholder:text-[#565c66] focus:outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex shrink-0 flex-wrap gap-0.5 px-2 pb-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              category === cat.id
                ? "bg-[#2d3748] text-white"
                : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {isUnconfigured ? (
          <div className="p-4 text-center">
            <p className="text-[11px] font-medium text-[#8b949e]">Setup Required</p>
            <p className="mt-1 text-[10px] text-[#565c66]">
              {unconfiguredProvider!.reason}
            </p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-[#565c66]">
            {category === "watchlist"
              ? "No favorites yet. Click ★ to add."
              : "No instruments found."}
          </div>
        ) : (
          <div className="space-y-0">
            {displayList.map((inst) => {
              const price = prices.get(inst.symbol);
              const ticker = tickers.get(inst.symbol);
              const isFav = watchlist.some((w) => w.symbol === inst.symbol);
              const chg = ticker?.priceChangePercent ?? 0;
              const bid = ticker?.bidPrice ?? price;
              const ask = ticker?.askPrice ?? price;
              const high = ticker?.highPrice;
              const low = ticker?.lowPrice;
              const isSelected = selectedSymbol === inst.symbol;
              const chgColor =
                chg > 0
                  ? "text-[#00c087]"
                  : chg < 0
                  ? "text-[#ff4757]"
                  : "text-[#565c66]";

              return (
                <div
                  key={inst.symbol}
                  onClick={() => selectSymbol(inst.symbol)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 border-b border-[#22262f] px-2 py-1.5 transition-colors hover:bg-[#22262f]",
                    isSelected && "bg-[#2d3748]",
                  )}
                >
                  {/* Symbol + status */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[11px] font-bold text-white">
                        {inst.base}
                      </span>
                      <span className="text-[9px] text-[#565c66]">
                        /{inst.quote}
                      </span>
                    </div>
                    <div className="text-[9px] text-[#565c66]">
                      {chg !== 0 ? (
                        <span className={chgColor}>
                          {chg > 0 ? "+" : ""}
                          {chg.toFixed(2)}%
                        </span>
                      ) : (
                        "Market open"
                      )}
                    </div>
                  </div>

                  {/* Bid / Ask */}
                  <div className="flex shrink-0 gap-2 text-right">
                    <div>
                      <div className="font-mono text-[11px] tabular-nums text-[#ff4757]">
                        {bid !== undefined
                          ? bid.toFixed(inst.pricePrecision)
                          : "—"}
                      </div>
                      {high !== undefined && (
                        <div className="text-[8px] text-[#565c66]">
                          H:{high.toFixed(0)}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="font-mono text-[11px] tabular-nums text-[#00c087]">
                        {ask !== undefined
                          ? ask.toFixed(inst.pricePrecision)
                          : "—"}
                      </div>
                      {low !== undefined && (
                        <div className="text-[8px] text-[#565c66]">
                          L:{low.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Star */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isFav) {
                        removeFromWatchlist(inst.symbol);
                      } else {
                        addToWatchlist({
                          symbol: inst.symbol,
                          name: inst.name,
                          assetClass: inst.assetClass,
                        });
                      }
                    }}
                    className="shrink-0 text-[#565c66] hover:text-white"
                  >
                    {isFav ? (
                      <Star className="h-3 w-3 fill-[#3b82f6] text-[#3b82f6]" />
                    ) : (
                      <StarOff className="h-3 w-3" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

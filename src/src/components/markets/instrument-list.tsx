"use client";

import { useState, useEffect } from "react";
import { Search, Star, StarOff } from "lucide-react";
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

  // Filter instruments by category + search.
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

  // Check if the selected category has a configured provider.
  const selectedProvider =
    category === "watchlist" || category === "all"
      ? null
      : getProvider(category as AssetClass);
  const unconfiguredProvider = UNCONFIGURED_PROVIDERS.find(
    (p) => p.assetClass === category,
  );
  const isUnconfigured = !selectedProvider && !!unconfiguredProvider;

  return (
    <div className="themed flex h-full flex-col bg-surface">
      {/* Search */}
      <div className="shrink-0 border-b border-line-muted p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments…"
            className="focus-ring themed h-7 w-full rounded-md border border-line bg-inset pl-7 pr-2 text-xs text-fg placeholder:text-fg-faint"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-line-muted px-1 py-1 overflow-x-auto">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              category === cat.id
                ? "bg-accent text-accent-fg"
                : "text-fg-muted hover:bg-hover hover:text-fg",
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
            <p className="text-[11px] font-medium text-fg-muted">Setup Required</p>
            <p className="mt-1 text-[10px] text-fg-faint">{unconfiguredProvider!.reason}</p>
          </div>
        ) : displayList.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-fg-faint">
            {category === "watchlist"
              ? "No favorites yet. Click ★ to add."
              : "No instruments found."}
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-line-muted text-fg-faint">
                <th className="px-2 py-1 text-left font-medium">Symbol</th>
                <th className="px-2 py-1 text-right font-medium">Bid</th>
                <th className="px-2 py-1 text-right font-medium">Ask</th>
                <th className="px-2 py-1 text-right font-medium">Chg%</th>
                <th className="w-4" />
              </tr>
            </thead>
            <tbody>
              {displayList.map((inst) => {
                const price = prices.get(inst.symbol);
                const ticker = tickers.get(inst.symbol);
                const isFav = watchlist.some((w) => w.symbol === inst.symbol);
                const chg = ticker?.priceChangePercent ?? 0;
                const bid = ticker?.bidPrice ?? price;
                const ask = ticker?.askPrice ?? price;
                return (
                  <tr
                    key={inst.symbol}
                    onClick={() => selectSymbol(inst.symbol)}
                    className={cn(
                      "cursor-pointer border-b border-line-muted/50 transition-colors hover:bg-hover",
                      selectedSymbol === inst.symbol && "bg-active",
                    )}
                  >
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1">
                        <span className="font-mono font-medium text-fg">{inst.base}</span>
                        <span className="text-[9px] text-fg-faint">/{inst.quote}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-red-400">
                      {bid !== undefined ? bid.toFixed(inst.pricePrecision) : "—"}
                    </td>
                    <td className="px-2 py-1 text-right font-mono tabular-nums text-green-400">
                      {ask !== undefined ? ask.toFixed(inst.pricePrecision) : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-1 text-right font-mono tabular-nums",
                        chg > 0 ? "text-green-500" : chg < 0 ? "text-red-500" : "text-fg-faint",
                      )}
                    >
                      {chg !== 0 ? `${chg > 0 ? "+" : ""}${chg.toFixed(2)}%` : "—"}
                    </td>
                    <td className="px-1 py-1">
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
                        className="text-fg-faint hover:text-accent"
                      >
                        {isFav ? (
                          <Star className="h-3 w-3 fill-accent text-accent" />
                        ) : (
                          <StarOff className="h-3 w-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

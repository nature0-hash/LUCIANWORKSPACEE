"use client";

/* LUCIAN Markets — Instruments panel (left sidebar inside Markets page).
 *
 * Matches the reference trading-terminal layout:
 *   ┌────────────────────────────────────┐
 *   │ Instruments                    X   │  header
 *   ├────────────────────────────────────┤
 *   │ 🔍 Search instruments               │  search input
 *   ├────────────────────────────────────┤
 *   │ All  Forex  Crypto  Indices  Metals │  chip row 1
 *   │ Energies  Intraday                  │  chip row 2
 *   ├────────────────────────────────────┤
 *   │ [icon] LINKUSD           11.612 11.700  │
 *   │        +0.08% S:8.8   L:11.588 H:11.678 │
 *   │   ⋮                                    │
 *   └────────────────────────────────────┘
 *
 * Behaviors:
 *  - search filters the visible list by symbol or name
 *  - chips filter by UI category (All/Forex/Crypto/Indices/Metals/Energies/Intraday)
 *  - list scrolls smoothly
 *  - clicking a row selects it (highlight persists)
 */

import { useMemo, useState } from "react";
import { Search, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSTRUMENT_CATALOG,
  filterByCategory,
  type CatalogInstrument,
  type InstrumentCategory,
} from "@/lib/markets/catalog";

/* The reference terminal uses these chips in two rows:
   Row 1: All · Forex · Crypto · Indices · Metals
   Row 2: Energies · Intraday */
const CHIP_ROW_1: InstrumentCategory[] = [
  "all",
  "forex",
  "crypto",
  "indices",
  "metals",
];
const CHIP_ROW_2: InstrumentCategory[] = ["energies", "intraday"];

interface DemoTicker {
  bid: number;
  ask: number;
  low: number;
  high: number;
  changePct: number;
  spread: number;
}

/** Anchor prices so demo prices look reasonable instead of starting near zero. */
function anchorPrice(inst: CatalogInstrument): number {
  switch (inst.assetClass) {
    case "crypto":
      if (inst.symbol.startsWith("BTC")) return 60000;
      if (inst.symbol.startsWith("ETH")) return 3000;
      if (inst.symbol.startsWith("SOL")) return 150;
      if (inst.symbol.startsWith("XRP")) return 0.6;
      if (inst.symbol.startsWith("DOGE")) return 0.15;
      if (inst.symbol.startsWith("LINK")) return 11.6;
      if (inst.symbol.startsWith("GRT")) return 0.015;
      if (inst.symbol.startsWith("FIL")) return 0.7;
      if (inst.symbol.startsWith("LTC")) return 80;
      if (inst.symbol.startsWith("BCH")) return 400;
      if (inst.symbol.startsWith("BNB")) return 600;
      if (inst.symbol.startsWith("ADA")) return 0.45;
      if (inst.symbol.startsWith("DASH")) return 30;
      return 100;
    case "forex":
      return 1.1;
    case "metals":
      return inst.symbol.startsWith("XAU") ? 2400 : 30;
    case "indices":
      return 15000;
    case "energies":
      return 80;
    case "stocks":
      if (inst.symbol.startsWith("TSLA")) return 250;
      if (inst.symbol.startsWith("NVDA")) return 120;
      if (inst.symbol.startsWith("NFLX")) return 600;
      if (inst.symbol.startsWith("AMZN")) return 180;
      if (inst.symbol.startsWith("AAPL")) return 220;
      if (inst.symbol.startsWith("GOOGL")) return 175;
      if (inst.symbol.startsWith("META")) return 500;
      if (inst.symbol.startsWith("BABA")) return 80;
      if (inst.symbol.startsWith("MSFT")) return 420;
      if (inst.symbol.startsWith("AMD")) return 160;
      if (inst.symbol.startsWith("SHOP")) return 80;
      return 300;
    default:
      return 100;
  }
}

/** Deterministic pseudo-prices based on symbol hash so the panel looks
    populated and stable across renders. */
function demoTickerFor(inst: CatalogInstrument): DemoTicker {
  let h = 0;
  for (let i = 0; i < inst.symbol.length; i++) {
    h = (h * 31 + inst.symbol.charCodeAt(i)) >>> 0;
  }
  const anchor = anchorPrice(inst);
  const jitter = ((h % 1000) / 1000 - 0.5) * anchor * 0.02; // ±1% jitter
  const mid = anchor + jitter;
  const spread = mid * 0.0002 + 0.01;
  const changePct = (((h >> 8) % 2000) - 1000) / 1000; // ±1.0
  return {
    bid: mid - spread / 2,
    ask: mid + spread / 2,
    low: mid * (1 - 0.004),
    high: mid * (1 + 0.004),
    changePct,
    spread: Math.max(0.1, Math.round(spread * 10) / 10),
  };
}

const UP = "#4bfa8f";
const DOWN = "#ff5b5b";
const NEUTRAL = "#9ea3ab";

interface Props {
  /** Optional callback when an instrument is selected. */
  onSelect?: (symbol: string) => void;
  /** Optional close handler — if omitted, the X icon is decorative. */
  onClose?: () => void;
  /** Initially selected symbol. */
  initialSelected?: string;
}

export function InstrumentsPanel({
  onSelect,
  onClose,
  initialSelected,
}: Props) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<InstrumentCategory>("all");
  const [selected, setSelected] = useState<string | null>(
    initialSelected ?? null,
  );

  const visible = useMemo(() => {
    let list = filterByCategory(category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.symbol.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q),
      );
    }
    return list;
  }, [category, search]);

  const handleSelect = (sym: string) => {
    setSelected(sym);
    onSelect?.(sym);
  };

  return (
    <div className="themed flex h-full w-full flex-col bg-surface text-fg">
      {/* ── Header ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <span className="text-[12px] font-semibold tracking-wide text-fg">
          Instruments
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close instruments panel"
          title="Close"
          className="text-fg-faint transition-colors hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Search ── */}
      <div className="shrink-0 px-2.5 pt-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instruments"
            className="h-7 w-full rounded bg-surface-2 pl-7 pr-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
          />
        </div>
      </div>

      {/* ── Filter chips (two rows) ── */}
      <div className="shrink-0 space-y-1 px-2.5 py-2">
        <div className="flex flex-wrap gap-1">
          {CHIP_ROW_1.map((cat) => (
            <Chip
              key={cat}
              label={cat === "all" ? "All" : cap(cat)}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {CHIP_ROW_2.map((cat) => (
            <Chip
              key={cat}
              label={cap(cat)}
              active={category === cat}
              onClick={() => setCategory(cat)}
            />
          ))}
        </div>
      </div>

      {/* ── List (scrollable) ── */}
      <div className="min-h-0 flex-1 overflow-y-auto themed">
        {visible.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-fg-faint">
            No instruments match &quot;{search}&quot;.
          </div>
        ) : (
          <ul className="m-0 list-none p-0">
            {visible.map((inst) => {
              const t = demoTickerFor(inst);
              const isSel = selected === inst.symbol;
              const chgColor = !inst.marketOpen
                ? NEUTRAL
                : t.changePct > 0
                ? UP
                : t.changePct < 0
                ? DOWN
                : NEUTRAL;
              const priceColor = !inst.marketOpen
                ? "var(--fg)"
                : t.changePct > 0
                ? UP
                : t.changePct < 0
                ? DOWN
                : "var(--fg)";
              return (
                <li key={inst.symbol} className="relative">
                  <button
                    type="button"
                    onClick={() => handleSelect(inst.symbol)}
                    className={cn(
                      "relative flex w-full items-stretch gap-2 border-b border-line-muted/60 px-2.5 py-2 text-left transition-colors themed",
                      isSel ? "bg-active" : "hover:bg-hover",
                    )}
                  >
                    {/* Selected left-bar accent */}
                    {isSel && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 h-full w-[2px] bg-[var(--accent)]"
                      />
                    )}

                    {/* Icon badge */}
                    <span
                      className={cn(
                        "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
                        inst.category === "crypto"
                          ? "bg-[#3a3a4f] text-fg"
                          : inst.category === "forex"
                          ? "bg-[#1f3a4a] text-[#7fb6cf]"
                          : inst.category === "metals"
                          ? "bg-[#3a2f1a] text-[#e0b870]"
                          : inst.category === "indices"
                          ? "bg-[#1a3a2a] text-[#7fcf9b]"
                          : inst.category === "energies"
                          ? "bg-[#3a1f1a] text-[#cf8b7f]"
                          : "bg-[#2a2a3a] text-[#a5a5cf]",
                      )}
                    >
                      {inst.badge}
                    </span>

                    {/* Symbol + status */}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-semibold text-fg">
                        {inst.symbol}
                      </div>
                      <div className="truncate text-[9px] leading-tight">
                        {!inst.marketOpen ? (
                          <span style={{ color: NEUTRAL }}>Market closed</span>
                        ) : (
                          <span style={{ color: chgColor }}>
                            {t.changePct >= 0 ? "+" : ""}
                            {t.changePct.toFixed(2)}%{" "}
                            <span style={{ color: NEUTRAL }}>
                              S: {t.spread.toFixed(1)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bid / Ask columns */}
                    <div className="flex shrink-0 gap-2 text-right">
                      <PriceCol
                        label="L"
                        price={t.bid}
                        precision={inst.pricePrecision}
                        color={priceColor}
                        subValue={t.low}
                        subPrecision={inst.pricePrecision}
                        marketOpen={inst.marketOpen}
                      />
                      <PriceCol
                        label="H"
                        price={t.ask}
                        precision={inst.pricePrecision}
                        color={priceColor}
                        subValue={t.high}
                        subPrecision={inst.pricePrecision}
                        marketOpen={inst.marketOpen}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Footer status ── */}
      <div className="flex h-6 shrink-0 items-center justify-between border-t border-line-muted px-3 text-[9px] text-fg-faint themed">
        <span>{visible.length} instruments</span>
        <span className="flex items-center gap-1">
          <Star className="h-2.5 w-2.5" />
          {INSTRUMENT_CATALOG.filter((i) => i.marketOpen).length} live
        </span>
      </div>
    </div>
  );
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-medium transition-colors themed",
        active
          ? "bg-active text-fg"
          : "bg-surface-2 text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function PriceCol({
  label,
  price,
  precision,
  color,
  subValue,
  subPrecision,
  marketOpen,
}: {
  label: string;
  price: number;
  precision: number;
  color: string;
  subValue: number;
  subPrecision: number;
  marketOpen: boolean;
}) {
  return (
    <div className="leading-tight">
      <div
        className="font-mono text-[11px] tabular-nums"
        style={{ color }}
      >
        {marketOpen ? price.toFixed(precision) : "—"}
      </div>
      <div className="font-mono text-[8px] tabular-nums text-fg-faint">
        {marketOpen ? (
          <>
            {label}: {subValue.toFixed(subPrecision)}
          </>
        ) : (
          <>
            {label}: —
          </>
        )}
      </div>
    </div>
  );
}

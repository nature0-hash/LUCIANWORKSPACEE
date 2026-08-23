"use client";

/* LUCIAN Markets — Order Details panel.
 *
 * Replaces the Instruments panel in the left contextual area when the
 * user clicks "New order" in the chart toolbar. Shows market/pending
 * order flows for the currently selected instrument.
 *
 *   ┌────────────────────────────────────┐
 *   │ {SYMBOL} order details         X   │  header
 *   ├────────────────────────────────────┤
 *   │ Market order  |  Pending order      │  tabs
 *   ├────────────────────────────────────┤
 *   │ Sell          |          Buy        │
 *   │ SELL_PRICE    |        BUY_PRICE    │
 *   ├────────────────────────────────────┤
 *   │ Order volume     0.01  [−] [+]      │
 *   │ Monetary equivalent    $X.XX        │
 *   │ Take Profit              +          │
 *   │ Stop Loss                 +         │
 *   │ Required / Free margin   $X / $Y     │
 *   ├────────────────────────────────────┤
 *   │ [        Open order        ]        │
 *   └────────────────────────────────────┘
 *
 * Behavior:
 *  - "Open order" / "Place order" wires into the Virtual (paper) trading
 *    engine via useMarketsStore.placeMarketOrder / placePending.
 *  - Pending entry price stepper also propagates a price line on the chart
 *    via onPendingPriceChange (so the user sees where their pending order
 *    will trigger).
 *  - X closes Order Details and returns the left panel to Instruments.
 */

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketsStore } from "@/store/markets";
import { getInstrumentBySymbol } from "@/lib/markets/catalog";

type OrderTab = "market" | "pending";

interface Props {
  onClose: () => void;
  onPendingPriceChange: (price: number | null) => void;
}

export function OrderDetailsPanel({
  onClose,
  onPendingPriceChange,
}: Props) {
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const [tab, setTab] = useState<OrderTab>("market");

  // Look up the instrument's bid/ask/changePct from the catalog.
  // Falls back to EURUSD if nothing is selected yet.
  const inst = useMemo(
    () =>
      (selectedSymbol ? getInstrumentBySymbol(selectedSymbol) : null) ??
      getInstrumentBySymbol("EURUSD")!,
    [selectedSymbol],
  );

  const SELL_PRICE = inst.bid;
  const BUY_PRICE = inst.ask;

  return (
    <div className="themed flex h-full w-full flex-col bg-surface text-fg">
      {/* ── Header ── */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <span className="text-[12px] font-semibold tracking-wide text-fg">
          {inst.symbol} order details
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close order details"
          title="Close"
          className="text-fg-faint transition-colors hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Tab strip ── */}
      <div className="flex shrink-0 border-b border-line-muted">
        <TabBtn
          label="Market order"
          active={tab === "market"}
          onClick={() => setTab("market")}
        />
        <TabBtn
          label="Pending order"
          active={tab === "pending"}
          onClick={() => setTab("pending")}
        />
      </div>

      {/* ── Body ── */}
      <div className="min-h-0 flex-1 overflow-y-auto themed">
        {tab === "market" ? (
          <MarketOrderBody
            sellPrice={SELL_PRICE}
            buyPrice={BUY_PRICE}
            symbol={inst.symbol}
          />
        ) : (
          <PendingOrderBody
            sellPrice={SELL_PRICE}
            buyPrice={BUY_PRICE}
            symbol={inst.symbol}
            precision={inst.pricePrecision}
            onPendingPriceChange={onPendingPriceChange}
          />
        )}
      </div>
    </div>
  );
}

/* ── Market order body ── */

function MarketOrderBody({
  sellPrice,
  buyPrice,
  symbol,
}: {
  sellPrice: number;
  buyPrice: number;
  symbol: string;
}) {
  const [volume, setVolume] = useState(0.01);
  const [tpOpen, setTpOpen] = useState(false);
  const [slOpen, setSlOpen] = useState(false);
  const [tpValue, setTpValue] = useState(0);
  const [slValue, setSlValue] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const placeMarketOrder = useMarketsStore((s) => s.placeMarketOrder);
  const account = useMarketsStore((s) => s.account);

  // Monetary equivalent = volume × midPrice (USD value of the trade).
  const mid = (sellPrice + buyPrice) / 2;
  const monetaryEquiv = volume * mid;
  // Required margin ≈ entry value (1x leverage for this paper mode).
  const requiredMargin = monetaryEquiv;
  const freeMargin = account?.freeMargin ?? 0;

  const handleSell = () => {
    const r = placeMarketOrder(
      symbol,
      "sell",
      sellPrice,
      volume,
      slValue,
      tpValue,
    );
    setResult(r.success ? "Sell order opened" : r.error ?? "Order failed");
    setTimeout(() => setResult(null), 2000);
  };
  const handleBuy = () => {
    const r = placeMarketOrder(
      symbol,
      "buy",
      buyPrice,
      volume,
      slValue,
      tpValue,
    );
    setResult(r.success ? "Buy order opened" : r.error ?? "Order failed");
    setTimeout(() => setResult(null), 2000);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Sell / Buy price cards */}
      <div className="grid grid-cols-2 gap-2">
        <PriceCard label="Sell" price={sellPrice} color="#f23645" onClick={handleSell} />
        <PriceCard label="Buy" price={buyPrice} color="#089981" onClick={handleBuy} />
      </div>

      {/* Order volume stepper */}
      <Field label="Order volume">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-white">
            {volume.toFixed(2)}
          </span>
          <div className="ml-auto flex gap-1">
            <StepBtn
              onClick={() => setVolume((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
              label="−"
            />
            <StepBtn
              onClick={() => setVolume((v) => +(v + 0.01).toFixed(2))}
              label="+"
            />
          </div>
        </div>
      </Field>

      <Field label="Monetary equivalent">
        <span className="font-mono text-[12px] tabular-nums text-white">
          ${monetaryEquiv.toFixed(2)}
        </span>
      </Field>

      {/* Expandable Take Profit */}
      <Expandable
        label="Take Profit"
        open={tpOpen}
        onToggle={() => setTpOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 pb-2">
          <input
            type="number"
            value={tpValue || ""}
            onChange={(e) => setTpValue(+e.target.value)}
            placeholder="0.00"
            className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
          />
        </div>
      </Expandable>

      {/* Expandable Stop Loss */}
      <Expandable
        label="Stop Loss"
        open={slOpen}
        onToggle={() => setSlOpen((v) => !v)}
      >
        <div className="flex items-center gap-2 pb-2">
          <input
            type="number"
            value={slValue || ""}
            onChange={(e) => setSlValue(+e.target.value)}
            placeholder="0.00"
            className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
          />
        </div>
      </Expandable>

      {/* Required / Free margin */}
      <Field label="Required / Free margin">
        <span className="font-mono text-[12px] tabular-nums text-white">
          ${requiredMargin.toFixed(2)} / ${freeMargin.toFixed(2)}
        </span>
      </Field>

      {/* Submit + result message */}
      {result && (
        <div className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 text-[10px] text-fg">
          {result}
        </div>
      )}
    </div>
  );
}

/* ── Pending order body ── */

function PendingOrderBody({
  sellPrice,
  buyPrice,
  symbol,
  precision,
  onPendingPriceChange,
}: {
  sellPrice: number;
  buyPrice: number;
  symbol: string;
  precision: number;
  onPendingPriceChange: (price: number | null) => void;
}) {
  // Sell Stop and Buy Limit start at the current sell/buy prices respectively.
  const [entryPrice, setEntryPrice] = useState<number>(buyPrice);
  const [volume, setVolume] = useState(0.01);
  const [tpOpen, setTpOpen] = useState(false);
  const [slOpen, setSlOpen] = useState(false);
  const [trailingOpen, setTrailingOpen] = useState(false);
  const [breakEvenOpen, setBreakEvenOpen] = useState(false);
  const [expirationOpen, setExpirationOpen] = useState(false);
  const [tpValue, setTpValue] = useState(0);
  const [slValue, setSlValue] = useState(0);
  const [result, setResult] = useState<string | null>(null);

  const placePending = useMarketsStore((s) => s.placePending);

  // Distance from current mid → entry price (in points).
  const mid = (sellPrice + buyPrice) / 2;
  const distance = Math.abs(entryPrice - mid) * Math.pow(10, precision);

  // Propagate the entry price to the chart's pending-order line.
  useEffect(() => {
    onPendingPriceChange(entryPrice);
    return () => onPendingPriceChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryPrice]);

  const handlePlace = (side: "buy" | "sell") => {
    const r = placePending(
      symbol,
      side,
      "limit",
      entryPrice,
      volume,
      slValue,
      tpValue,
    );
    setResult(r.success ? "Pending order placed" : r.error ?? "Order failed");
    setTimeout(() => setResult(null), 2000);
  };

  return (
    <div className="flex flex-col gap-2 p-3">
      {/* Sell Stop / Buy Limit cards */}
      <div className="grid grid-cols-2 gap-2">
        <PriceCard
          label="Sell Stop"
          price={sellPrice}
          color="#f23645"
          onClick={() => handlePlace("sell")}
        />
        <PriceCard
          label="Buy Limit"
          price={buyPrice}
          color="#089981"
          onClick={() => handlePlace("buy")}
        />
      </div>

      {/* Create pending order caption */}
      <div className="pt-1 text-[10px] text-fg-muted">Create pending order</div>

      {/* Entry price stepper */}
      <Field label="Entry price">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-white">
            {entryPrice.toFixed(precision)}
          </span>
          <div className="ml-auto flex gap-1">
            <StepBtn
              onClick={() =>
                setEntryPrice((p) => +(p - Math.pow(10, -precision)).toFixed(precision))
              }
              label="−"
            />
            <StepBtn
              onClick={() =>
                setEntryPrice((p) => +(p + Math.pow(10, -precision)).toFixed(precision))
              }
              label="+"
            />
          </div>
        </div>
      </Field>

      {/* Distance */}
      <Field label="Distance">
        <span className="font-mono text-[12px] tabular-nums text-white">
          {distance.toFixed(1)} points
        </span>
      </Field>

      {/* Order volume */}
      <Field label="Order volume">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12px] tabular-nums text-white">
            {volume.toFixed(2)}
          </span>
          <div className="ml-auto flex gap-1">
            <StepBtn
              onClick={() => setVolume((v) => Math.max(0.01, +(v - 0.01).toFixed(2)))}
              label="−"
            />
            <StepBtn
              onClick={() => setVolume((v) => +(v + 0.01).toFixed(2))}
              label="+"
            />
          </div>
        </div>
      </Field>

      <Field label="Monetary equivalent">
        <span className="font-mono text-[12px] tabular-nums text-white">
          ${(volume * entryPrice).toFixed(2)}
        </span>
      </Field>

      {/* Expandable rows */}
      <Expandable label="Take Profit" open={tpOpen} onToggle={() => setTpOpen((v) => !v)}>
        <input
          type="number"
          value={tpValue || ""}
          onChange={(e) => setTpValue(+e.target.value)}
          placeholder="0.00"
          className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
      </Expandable>
      <Expandable label="Stop Loss" open={slOpen} onToggle={() => setSlOpen((v) => !v)}>
        <input
          type="number"
          value={slValue || ""}
          onChange={(e) => setSlValue(+e.target.value)}
          placeholder="0.00"
          className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
      </Expandable>
      <Expandable
        label="Trailing Stop"
        open={trailingOpen}
        onToggle={() => setTrailingOpen((v) => !v)}
      >
        <input
          type="number"
          placeholder="points"
          className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
      </Expandable>
      <Expandable
        label="Break Even"
        open={breakEvenOpen}
        onToggle={() => setBreakEvenOpen((v) => !v)}
      >
        <input
          type="number"
          placeholder="points"
          className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
      </Expandable>
      <Expandable
        label="Order expiration"
        open={expirationOpen}
        onToggle={() => setExpirationOpen((v) => !v)}
      >
        <select className="w-full rounded bg-surface-2 px-2 py-1 text-[11px] text-fg focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed">
          <option>Today</option>
          <option>1 week</option>
          <option>1 month</option>
          <option>Custom</option>
        </select>
      </Expandable>

      {/* Submit + result */}
      {result && (
        <div className="rounded border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-1 text-[10px] text-fg">
          {result}
        </div>
      )}

      {/* Place order button */}
      <button
        type="button"
        onClick={() => handlePlace("buy")}
        className="mt-1 rounded bg-[#2962ff] py-2 text-[12px] font-semibold text-white transition-opacity hover:opacity-90"
      >
        Place order
      </button>
    </div>
  );
}

/* ── Sub-components ── */

function TabBtn({
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
        "flex-1 py-2 text-[11px] font-medium transition-colors themed",
        active
          ? "border-b-2 border-[var(--accent)] text-fg"
          : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}

function PriceCard({
  label,
  price,
  color,
  onClick,
}: {
  label: string;
  price: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center rounded px-3 py-2 text-white transition-opacity hover:opacity-90"
      style={{ background: color }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-90">
        {label}
      </span>
      <span className="font-mono text-[13px] tabular-nums font-bold">
        {price.toFixed(5)}
      </span>
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded bg-surface-2/60 px-2 py-1.5 themed">
      <span className="text-[10px] text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

function StepBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded bg-surface-2 text-[12px] font-bold text-fg-muted transition-colors hover:bg-hover hover:text-fg"
    >
      {label}
    </button>
  );
}

function Expandable({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded bg-surface-2/60 themed">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-2 py-1.5 text-left text-[10px] text-fg-muted hover:text-fg"
      >
        <span>{label}</span>
        <Plus
          className={cn(
            "h-3 w-3 transition-transform",
            open && "rotate-45",
          )}
        />
      </button>
      {open && <div className="px-2 pb-1">{children}</div>}
    </div>
  );
}

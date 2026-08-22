"use client";

import { useState, useCallback } from "react";
import { useMarketsStore } from "@/store/markets";
import { openPosition, closePosition, getOpenPositions, getClosedPositions } from "@/lib/markets/paper-trading";
import type { OrderSide, OrderType } from "@/lib/markets/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type BottomTab = "positions" | "pending" | "history";

export function TradingPanel() {
  const mode = useMarketsStore((s) => s.mode);
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const prices = useMarketsStore((s) => s.prices);
  const instruments = useMarketsStore((s) => s.instruments);
  const riskRules = useMarketsStore((s) => s.riskRules);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);
  const account = useMarketsStore((s) => s.account);

  const [orderType, setOrderType] = useState<OrderType>("market");
  const [side, setSide] = useState<OrderSide>("buy");
  const [quantity, setQuantity] = useState("0.01");
  const [limitPrice, setLimitPrice] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");
  const [positions, setPositions] = useState(getOpenPositions());
  const [closed, setClosed] = useState(getClosedPositions());

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const price = selectedSymbol ? prices.get(selectedSymbol) : undefined;
  const entryPrice = orderType === "limit" && limitPrice ? parseFloat(limitPrice) : price ?? 0;
  const qty = parseFloat(quantity) || 0;
  const value = entryPrice * qty;

  // Spread display
  const ticker = useMarketsStore((s) => s.tickers.get(selectedSymbol ?? ""));
  const bid = ticker?.bidPrice ?? price;
  const ask = ticker?.askPrice ?? price;
  const spread = bid !== undefined && ask !== undefined ? ask - bid : 0;
  const spreadPct = price ? (spread / price) * 100 : 0;

  const handleTrade = useCallback(() => {
    if (!selectedSymbol || !price || qty <= 0) return;
    if (mode === "real") {
      toast({ title: "Broker connection required", description: "Real trading requires a connected broker.", variant: "destructive" });
      return;
    }
    const result = openPosition(
      selectedSymbol,
      side,
      entryPrice,
      qty,
      stopLoss ? parseFloat(stopLoss) : 0,
      takeProfit ? parseFloat(takeProfit) : 0,
      riskRules,
    );
    if (result.success) {
      toast({ title: `${side.toUpperCase()} order filled`, description: `${qty} ${instrument?.base ?? selectedSymbol} @ ${entryPrice.toFixed(2)}` });
      setPositions(getOpenPositions());
      setClosed(getClosedPositions());
      refreshAccount();
    } else {
      toast({ title: "Order rejected", description: result.error, variant: "destructive" });
    }
  }, [selectedSymbol, price, qty, mode, side, entryPrice, stopLoss, takeProfit, riskRules, instrument, refreshAccount]);

  const handleClose = useCallback((id: string) => {
    if (!price) return;
    closePosition(id, price);
    setPositions(getOpenPositions());
    setClosed(getClosedPositions());
    refreshAccount();
    toast({ title: "Position closed" });
  }, [price, refreshAccount]);

  return (
    <div className="themed border-t border-line-muted bg-surface">
      <div className="flex">
        {/* Order entry */}
        <div className="w-56 shrink-0 border-r border-line-muted p-2">
          {/* Mode badge */}
          <div className="mb-2 flex items-center justify-between">
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold",
              mode === "paper" ? "bg-accent/15 text-accent" : "bg-red-500/20 text-red-500",
            )}>
              {mode === "paper" ? "VIRTUAL" : "REAL"}
            </span>
            {mode === "real" && (
              <span className="text-[9px] text-red-500">No broker</span>
            )}
          </div>

          {/* Instrument info */}
          {instrument && (
            <div className="mb-2 rounded-md border border-line-muted bg-surface-2/40 p-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-medium text-fg">{instrument.symbol}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-x-2 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-fg-faint">Bid</span>
                  <span className="font-mono text-red-400">{bid !== undefined ? bid.toFixed(instrument.pricePrecision) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-fg-faint">Ask</span>
                  <span className="font-mono text-green-400">{ask !== undefined ? ask.toFixed(instrument.pricePrecision) : "—"}</span>
                </div>
              </div>
              {spread > 0 && (
                <div className="mt-0.5 flex justify-between text-[9px]">
                  <span className="text-fg-faint">Spread</span>
                  <span className="font-mono text-fg-muted">{spread.toFixed(2)} ({spreadPct.toFixed(3)}%)</span>
                </div>
              )}
            </div>
          )}

          {/* Side toggle */}
          <div className="mb-2 flex gap-1">
            <button
              onClick={() => setSide("buy")}
              className={cn(
                "flex-1 rounded py-1 text-[11px] font-bold transition-colors",
                side === "buy" ? "bg-green-600 text-white" : "bg-surface-2 text-fg-muted hover:bg-hover",
              )}
            >
              BUY
            </button>
            <button
              onClick={() => setSide("sell")}
              className={cn(
                "flex-1 rounded py-1 text-[11px] font-bold transition-colors",
                side === "sell" ? "bg-red-600 text-white" : "bg-surface-2 text-fg-muted hover:bg-hover",
              )}
            >
              SELL
            </button>
          </div>

          {/* Order type */}
          <div className="mb-2 flex gap-1">
            {(["market", "limit", "stop"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "flex-1 rounded py-0.5 text-[9px] font-medium capitalize transition-colors",
                  orderType === t ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Quantity */}
          <Field label="Volume (lots)">
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              step="0.01"
              className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
            />
          </Field>

          {/* Limit price */}
          {orderType !== "market" && (
            <Field label="Price">
              <input
                type="number"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                placeholder={price?.toString() ?? ""}
                className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
              />
            </Field>
          )}

          {/* SL / TP */}
          <div className="flex gap-1">
            <Field label="Stop Loss">
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="—"
                className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
              />
            </Field>
            <Field label="Take Profit">
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="—"
                className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
              />
            </Field>
          </div>

          {/* Estimated value + risk */}
          <div className="mt-2 space-y-0.5 border-t border-line-muted pt-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-fg-faint">Contract value</span>
              <span className="font-mono tabular-nums text-fg-muted">${value.toFixed(2)}</span>
            </div>
            {stopLoss && price && (
              <div className="flex justify-between text-[10px]">
                <span className="text-fg-faint">Risk amount</span>
                <span className="font-mono tabular-nums text-red-400">${Math.abs(entryPrice - parseFloat(stopLoss)) * qty}</span>
              </div>
            )}
            {takeProfit && price && (
              <div className="flex justify-between text-[10px]">
                <span className="text-fg-faint">Reward potential</span>
                <span className="font-mono tabular-nums text-green-400">${Math.abs(parseFloat(takeProfit) - entryPrice) * qty}</span>
              </div>
            )}
            {account && (
              <div className="flex justify-between text-[10px]">
                <span className="text-fg-faint">Required margin</span>
                <span className="font-mono tabular-nums text-fg-muted">${(value * 0.1).toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Execute */}
          <button
            onClick={handleTrade}
            disabled={!selectedSymbol || !price || qty <= 0}
            className={cn(
              "mt-2 w-full rounded py-1.5 text-[11px] font-bold transition-colors disabled:opacity-50",
              side === "buy"
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-red-600 text-white hover:bg-red-700",
            )}
          >
            {mode === "real" ? "BROKER REQUIRED" : `${side.toUpperCase()} ${instrument?.base ?? ""} @ ${orderType === "market" ? "Market" : entryPrice.toFixed(2)}`}
          </button>
        </div>

        {/* Positions / Pending / History */}
        <div className="min-w-0 flex-1">
          <div className="flex h-6 shrink-0 items-center gap-2 border-b border-line-muted px-2">
            <TabBtn active={bottomTab === "positions"} onClick={() => { setBottomTab("positions"); setPositions(getOpenPositions()); }} label="Open Positions" count={positions.length} />
            <TabBtn active={bottomTab === "pending"} onClick={() => setBottomTab("pending")} label="Pending Orders" count={0} />
            <TabBtn active={bottomTab === "history"} onClick={() => { setBottomTab("history"); setClosed(getClosedPositions()); }} label="History" count={closed.length} />
          </div>
          <div className="max-h-36 overflow-y-auto">
            {bottomTab === "positions" ? (
              <PositionsTable positions={positions} prices={prices} onClose={handleClose} />
            ) : bottomTab === "pending" ? (
              <PendingOrdersTable />
            ) : (
              <HistoryTable positions={closed} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-1 text-[10px] font-medium transition-colors", active ? "text-fg" : "text-fg-muted hover:text-fg")}
    >
      {label}
      {count > 0 && <span className="rounded bg-surface-2 px-1 text-[9px] tabular-nums">{count}</span>}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-1.5">
      <label className="mb-0.5 block text-[9px] text-fg-faint">{label}</label>
      {children}
    </div>
  );
}

function PositionsTable({
  positions,
  prices,
  onClose,
}: {
  positions: ReturnType<typeof getOpenPositions>;
  prices: Map<string, number>;
  onClose: (id: string) => void;
}) {
  if (positions.length === 0) {
    return <div className="p-4 text-center text-[10px] text-fg-faint">No open positions.</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead className="text-fg-faint">
        <tr className="border-b border-line-muted">
          <th className="px-2 py-0.5 text-left font-medium">Symbol</th>
          <th className="px-2 py-0.5 text-left font-medium">Type</th>
          <th className="px-2 py-0.5 text-right font-medium">Volume</th>
          <th className="px-2 py-0.5 text-right font-medium">Entry</th>
          <th className="px-2 py-0.5 text-right font-medium">Current</th>
          <th className="px-2 py-0.5 text-right font-medium">S/L</th>
          <th className="px-2 py-0.5 text-right font-medium">T/P</th>
          <th className="px-2 py-0.5 text-right font-medium">P/L</th>
          <th className="w-8" />
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => {
          const price = prices.get(p.symbol);
          const pnl = price
            ? p.side === "buy"
              ? (price - p.entryPrice) * p.quantity
              : (p.entryPrice - price) * p.quantity
            : p.unrealizedPnl;
          return (
            <tr key={p.id} className="border-b border-line-muted/50 hover:bg-hover">
              <td className="px-2 py-0.5 font-mono text-fg">{p.symbol}</td>
              <td className={cn("px-2 py-0.5 font-medium", p.side === "buy" ? "text-green-500" : "text-red-500")}>
                {p.side === "buy" ? "Buy" : "Sell"}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.quantity}</td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.entryPrice.toFixed(2)}</td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{price?.toFixed(2) ?? "—"}</td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-faint">{p.stopLoss > 0 ? p.stopLoss.toFixed(2) : "—"}</td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-faint">{p.takeProfit > 0 ? p.takeProfit.toFixed(2) : "—"}</td>
              <td className={cn("px-2 py-0.5 text-right font-mono tabular-nums", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </td>
              <td className="px-1 py-0.5">
                <button onClick={() => onClose(p.id)} className="text-[9px] text-fg-faint hover:text-fg">✕</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function PendingOrdersTable() {
  return (
    <div className="p-4 text-center text-[10px] text-fg-faint">
      No pending orders. Pending orders (limit/stop) will appear here when placed.
    </div>
  );
}

function HistoryTable({ positions }: { positions: ReturnType<typeof getClosedPositions> }) {
  if (positions.length === 0) {
    return <div className="p-4 text-center text-[10px] text-fg-faint">No closed positions.</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead className="text-fg-faint">
        <tr className="border-b border-line-muted">
          <th className="px-2 py-0.5 text-left font-medium">Symbol</th>
          <th className="px-2 py-0.5 text-left font-medium">Type</th>
          <th className="px-2 py-0.5 text-right font-medium">Volume</th>
          <th className="px-2 py-0.5 text-right font-medium">Entry</th>
          <th className="px-2 py-0.5 text-right font-medium">Exit</th>
          <th className="px-2 py-0.5 text-right font-medium">P/L</th>
          <th className="px-2 py-0.5 text-right font-medium">Time</th>
        </tr>
      </thead>
      <tbody>
        {positions.slice(0, 50).map((p) => (
          <tr key={p.id} className="border-b border-line-muted/50 hover:bg-hover">
            <td className="px-2 py-0.5 font-mono text-fg">{p.symbol}</td>
            <td className={cn("px-2 py-0.5 font-medium", p.side === "buy" ? "text-green-500" : "text-red-500")}>
              {p.side === "buy" ? "Buy" : "Sell"}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.quantity}</td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.entryPrice.toFixed(2)}</td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.exitPrice.toFixed(2)}</td>
            <td className={cn("px-2 py-0.5 text-right font-mono tabular-nums", p.realizedPnl >= 0 ? "text-green-500" : "text-red-500")}>
              {p.realizedPnl >= 0 ? "+" : ""}{p.realizedPnl.toFixed(2)}
            </td>
            <td className="px-2 py-0.5 text-right text-[9px] text-fg-faint">{new Date(p.closedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

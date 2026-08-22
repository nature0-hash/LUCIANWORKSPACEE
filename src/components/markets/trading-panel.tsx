"use client";

import { useState, useCallback } from "react";
import { useMarketsStore } from "@/store/markets";
import { getProvider } from "@/lib/markets/provider";
import { openPosition, closePosition, getOpenPositions, getClosedPositions } from "@/lib/markets/paper-trading";
import type { OrderSide, OrderType } from "@/lib/markets/types";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
  const [activeTab, setActiveTab] = useState<"positions" | "history">("positions");
  const [positions, setPositions] = useState(getOpenPositions());
  const [closed, setClosed] = useState(getClosedPositions());

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const price = selectedSymbol ? prices.get(selectedSymbol) : undefined;
  const entryPrice = orderType === "limit" && limitPrice ? parseFloat(limitPrice) : price ?? 0;
  const qty = parseFloat(quantity) || 0;
  const value = entryPrice * qty;

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
      {/* Order entry + positions side by side */}
      <div className="flex">
        {/* Order entry */}
        <div className="w-56 shrink-0 border-r border-line-muted p-2">
          {/* Mode badge */}
          <div className="mb-2 flex items-center justify-between">
            <span className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold",
              mode === "paper" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-red-500/20 text-red-500",
            )}>
              {mode.toUpperCase()}
            </span>
            {mode === "real" && (
              <span className="text-[9px] text-red-500">No broker</span>
            )}
          </div>

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
          <Field label="Quantity" >
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
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
            <Field label="SL">
              <input
                type="number"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                placeholder="—"
                className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
              />
            </Field>
            <Field label="TP">
              <input
                type="number"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="—"
                className="focus-ring themed h-6 w-full rounded border border-line bg-inset px-1.5 text-[11px] text-fg"
              />
            </Field>
          </div>

          {/* Estimated value */}
          <div className="mt-2 flex justify-between text-[10px] text-fg-faint">
            <span>Value</span>
            <span className="font-mono tabular-nums">${value.toFixed(2)}</span>
          </div>
          {stopLoss && price && (
            <div className="flex justify-between text-[10px] text-fg-faint">
              <span>Risk</span>
              <span className="font-mono tabular-nums">${Math.abs(entryPrice - parseFloat(stopLoss)) * qty}</span>
            </div>
          )}

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
            {mode === "real" ? "BROKER REQUIRED" : `${side.toUpperCase()} ${instrument?.base ?? ""}`}
          </button>
        </div>

        {/* Positions / History */}
        <div className="min-w-0 flex-1">
          <div className="flex h-6 shrink-0 items-center gap-1 border-b border-line-muted px-2">
            <button
              onClick={() => { setActiveTab("positions"); setPositions(getOpenPositions()); }}
              className={cn("text-[10px] font-medium", activeTab === "positions" ? "text-fg" : "text-fg-muted hover:text-fg")}
            >
              Open ({positions.length})
            </button>
            <button
              onClick={() => { setActiveTab("history"); setClosed(getClosedPositions()); }}
              className={cn("text-[10px] font-medium", activeTab === "history" ? "text-fg" : "text-fg-muted hover:text-fg")}
            >
              History ({closed.length})
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto">
            {activeTab === "positions" ? (
              <PositionsTable positions={positions} prices={prices} onClose={handleClose} />
            ) : (
              <HistoryTable positions={closed} />
            )}
          </div>
        </div>
      </div>
    </div>
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
    return <div className="p-3 text-center text-[10px] text-fg-faint">No open positions.</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead className="text-fg-faint">
        <tr className="border-b border-line-muted">
          <th className="px-2 py-0.5 text-left font-medium">Symbol</th>
          <th className="px-2 py-0.5 text-left font-medium">Side</th>
          <th className="px-2 py-0.5 text-right font-medium">Entry</th>
          <th className="px-2 py-0.5 text-right font-medium">Qty</th>
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
                {p.side.toUpperCase()}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.entryPrice.toFixed(2)}</td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.quantity}</td>
              <td className={cn("px-2 py-0.5 text-right font-mono tabular-nums", pnl >= 0 ? "text-green-500" : "text-red-500")}>
                {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
              </td>
              <td className="px-1 py-0.5">
                <button
                  onClick={() => onClose(p.id)}
                  className="text-[9px] text-fg-faint hover:text-fg"
                >
                  ✕
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function HistoryTable({ positions }: { positions: ReturnType<typeof getClosedPositions> }) {
  if (positions.length === 0) {
    return <div className="p-3 text-center text-[10px] text-fg-faint">No closed positions.</div>;
  }
  return (
    <table className="w-full text-[10px]">
      <thead className="text-fg-faint">
        <tr className="border-b border-line-muted">
          <th className="px-2 py-0.5 text-left font-medium">Symbol</th>
          <th className="px-2 py-0.5 text-left font-medium">Side</th>
          <th className="px-2 py-0.5 text-right font-medium">Entry</th>
          <th className="px-2 py-0.5 text-right font-medium">Exit</th>
          <th className="px-2 py-0.5 text-right font-medium">P/L</th>
        </tr>
      </thead>
      <tbody>
        {positions.slice(0, 50).map((p) => (
          <tr key={p.id} className="border-b border-line-muted/50 hover:bg-hover">
            <td className="px-2 py-0.5 font-mono text-fg">{p.symbol}</td>
            <td className={cn("px-2 py-0.5 font-medium", p.side === "buy" ? "text-green-500" : "text-red-500")}>
              {p.side.toUpperCase()}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.entryPrice.toFixed(2)}</td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">{p.exitPrice.toFixed(2)}</td>
            <td className={cn("px-2 py-0.5 text-right font-mono tabular-nums", p.realizedPnl >= 0 ? "text-green-500" : "text-red-500")}>
              {p.realizedPnl >= 0 ? "+" : ""}{p.realizedPnl.toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

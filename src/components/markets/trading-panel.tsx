"use client";

import { useState, useCallback } from "react";
import { useMarketsStore } from "@/store/markets";
import {
  openPosition,
  closePosition,
  getOpenPositions,
  getClosedPositions,
} from "@/lib/markets/paper-trading";
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
  const entryPrice =
    orderType === "limit" && limitPrice ? parseFloat(limitPrice) : price ?? 0;
  const qty = parseFloat(quantity) || 0;
  const value = entryPrice * qty;

  const handleTrade = useCallback(() => {
    if (!selectedSymbol || !price || qty <= 0) return;
    if (mode === "real") {
      toast({
        title: "Broker connection required",
        description: "Real trading requires a connected broker.",
        variant: "destructive",
      });
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
      toast({
        title: `${side.toUpperCase()} order filled`,
        description: `${qty} ${instrument?.base ?? selectedSymbol} @ ${entryPrice.toFixed(2)}`,
      });
      setPositions(getOpenPositions());
      setClosed(getClosedPositions());
      refreshAccount();
    } else {
      toast({ title: "Order rejected", description: result.error, variant: "destructive" });
    }
  }, [
    selectedSymbol,
    price,
    qty,
    mode,
    side,
    entryPrice,
    stopLoss,
    takeProfit,
    riskRules,
    instrument,
    refreshAccount,
  ]);

  const handleClose = useCallback(
    (id: string) => {
      if (!price) return;
      closePosition(id, price);
      setPositions(getOpenPositions());
      setClosed(getClosedPositions());
      refreshAccount();
      toast({ title: "Position closed" });
    },
    [price, refreshAccount],
  );

  return (
    <div className="themed flex h-full flex-col border-t border-line-muted bg-surface">
      {/* Bottom panel tabs */}
      <div className="flex h-7 shrink-0 items-center gap-1 border-b border-line-muted px-2">
        <TabBtn
          active={bottomTab === "positions"}
          onClick={() => {
            setBottomTab("positions");
            setPositions(getOpenPositions());
          }}
          label="Market / Positions"
          count={positions.length}
        />
        <TabBtn
          active={bottomTab === "pending"}
          onClick={() => setBottomTab("pending")}
          label="Pending"
          count={0}
        />
        <TabBtn
          active={bottomTab === "history"}
          onClick={() => {
            setBottomTab("history");
            setClosed(getClosedPositions());
          }}
          label="Closed"
          count={closed.length}
        />

        {/* Order entry inline on the right */}
        <div className="ml-auto flex items-center gap-1">
          {/* Order type */}
          <div className="flex gap-0.5">
            {(["market", "limit", "stop"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium capitalize transition-colors",
                  orderType === t
                    ? "bg-accent text-accent-fg"
                    : "text-fg-muted hover:bg-hover",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Side */}
          <button
            onClick={() => setSide("buy")}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors",
              side === "buy"
                ? "bg-green-600 text-white"
                : "bg-surface-2 text-fg-muted hover:bg-hover",
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={cn(
              "rounded px-1.5 py-0.5 text-[9px] font-bold transition-colors",
              side === "sell"
                ? "bg-red-600 text-white"
                : "bg-surface-2 text-fg-muted hover:bg-hover",
            )}
          >
            Sell
          </button>

          {/* Volume */}
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            step="0.01"
            className="h-5 w-14 rounded border border-line bg-inset px-1 text-center font-mono text-[10px] text-fg"
            placeholder="0.01"
          />

          {/* SL */}
          <input
            type="number"
            value={stopLoss}
            onChange={(e) => setStopLoss(e.target.value)}
            placeholder="SL"
            className="h-5 w-16 rounded border border-line bg-inset px-1 text-center font-mono text-[10px] text-fg"
          />

          {/* TP */}
          <input
            type="number"
            value={takeProfit}
            onChange={(e) => setTakeProfit(e.target.value)}
            placeholder="TP"
            className="h-5 w-16 rounded border border-line bg-inset px-1 text-center font-mono text-[10px] text-fg"
          />

          {/* Execute */}
          <button
            onClick={handleTrade}
            disabled={!selectedSymbol || !price || qty <= 0}
            className={cn(
              "rounded px-2 py-0.5 text-[9px] font-bold text-white transition-colors disabled:opacity-50",
              side === "buy"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-red-600 hover:bg-red-700",
            )}
          >
            {mode === "real" ? "Broker" : "Place"}
          </button>
        </div>
      </div>

      {/* Table area */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {bottomTab === "positions" ? (
          <PositionsTable
            positions={positions}
            prices={prices}
            onClose={handleClose}
          />
        ) : bottomTab === "pending" ? (
          <PendingOrdersTable />
        ) : (
          <HistoryTable positions={closed} />
        )}
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium transition-colors",
        active ? "text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      {label}
      {count > 0 && (
        <span className="rounded bg-surface-2 px-1 text-[9px] tabular-nums">
          {count}
        </span>
      )}
    </button>
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
    return (
      <div className="p-4 text-center text-[10px] text-fg-faint">
        No open positions.
      </div>
    );
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
            <tr
              key={p.id}
              className="border-b border-line-muted/50 hover:bg-hover"
            >
              <td className="px-2 py-0.5 font-mono text-fg">{p.symbol}</td>
              <td
                className={cn(
                  "px-2 py-0.5 font-medium",
                  p.side === "buy" ? "text-green-500" : "text-red-500",
                )}
              >
                {p.side === "buy" ? "Buy" : "Sell"}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
                {p.quantity}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
                {p.entryPrice.toFixed(2)}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
                {price?.toFixed(2) ?? "—"}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-faint">
                {p.stopLoss > 0 ? p.stopLoss.toFixed(2) : "—"}
              </td>
              <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-faint">
                {p.takeProfit > 0 ? p.takeProfit.toFixed(2) : "—"}
              </td>
              <td
                className={cn(
                  "px-2 py-0.5 text-right font-mono tabular-nums",
                  pnl >= 0 ? "text-green-500" : "text-red-500",
                )}
              >
                {pnl >= 0 ? "+" : ""}
                {pnl.toFixed(2)}
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

function PendingOrdersTable() {
  return (
    <div className="p-4 text-center text-[10px] text-fg-faint">
      No pending orders.
    </div>
  );
}

function HistoryTable({
  positions,
}: {
  positions: ReturnType<typeof getClosedPositions>;
}) {
  if (positions.length === 0) {
    return (
      <div className="p-4 text-center text-[10px] text-fg-faint">
        No closed positions.
      </div>
    );
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
          <tr
            key={p.id}
            className="border-b border-line-muted/50 hover:bg-hover"
          >
            <td className="px-2 py-0.5 font-mono text-fg">{p.symbol}</td>
            <td
              className={cn(
                "px-2 py-0.5 font-medium",
                p.side === "buy" ? "text-green-500" : "text-red-500",
              )}
            >
              {p.side === "buy" ? "Buy" : "Sell"}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
              {p.quantity}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
              {p.entryPrice.toFixed(2)}
            </td>
            <td className="px-2 py-0.5 text-right font-mono tabular-nums text-fg-muted">
              {p.exitPrice.toFixed(2)}
            </td>
            <td
              className={cn(
                "px-2 py-0.5 text-right font-mono tabular-nums",
                p.realizedPnl >= 0 ? "text-green-500" : "text-red-500",
              )}
            >
              {p.realizedPnl >= 0 ? "+" : ""}
              {p.realizedPnl.toFixed(2)}
            </td>
            <td className="px-2 py-0.5 text-right text-[9px] text-fg-faint">
              {new Date(p.closedAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

"use client";

// LUCIAN Market Terminal — positions tables.
//
// Renders the Open Positions, Closed Positions, and Order History tables.
// All three use the same dense, monospaced financial table styling.
//
// Reads from the paper trading engine via the store. The store doesn't
// keep positions in its state (they live in localStorage via the engine),
// so we read them on each render and refresh from the parent via
// `refreshTick` (a counter that bumps whenever the account is refreshed).

import { useMemo } from "react";
import { X, History, Layers, Inbox } from "lucide-react";
import type {
  ClosedPosition,
  PendingOrder,
  Position,
} from "@/lib/markets/types";
import {
  getOpenPositions,
  getClosedPositions,
} from "@/lib/markets/paper-trading";
import { cn } from "@/lib/utils";
import {
  formatPrice,
  formatUsd,
  formatSignedUsd,
  formatQty,
  formatDateTime,
  pricePrecisionFor,
  pnlColorClass,
} from "./format";

interface PositionsTableProps {
  /** Bumped by the parent to force a re-read of the paper-trading engine. */
  refreshTick: number;
  /** Live prices (so we can compute unrealized P/L for open positions). */
  prices: Map<string, number>;
  /** Called when the user clicks the close button on an open position. */
  onClose?: (positionId: string) => void;
}

type Tab = "open" | "closed" | "history";

export type PositionsTab = Tab;

export function PositionsTable({
  refreshTick,
  prices,
  onClose,
  activeTab,
}: PositionsTableProps & { activeTab: Tab }) {
  if (activeTab === "open") {
    return <OpenPositionsTable refreshTick={refreshTick} prices={prices} onClose={onClose} />;
  }
  if (activeTab === "closed") {
    return <ClosedPositionsTable refreshTick={refreshTick} />;
  }
  return <OrderHistoryTable refreshTick={refreshTick} />;
}

/** Open positions table. */
function OpenPositionsTable({
  refreshTick,
  prices,
  onClose,
}: {
  refreshTick: number;
  prices: Map<string, number>;
  onClose?: (positionId: string) => void;
}) {
  // Re-read from paper-trading engine on every refresh tick. Live prices
  // are applied here (not in the engine) so the unrealized P/L reflects
  // the most recent WebSocket tick.
  const positions = useMemo(() => {
    void refreshTick;
    return getOpenPositions();
  }, [refreshTick]);

  if (positions.length === 0) {
    return (
      <EmptyTableState
        icon={Layers}
        title="No open positions"
        subtitle="Use the trade panel to open a paper position."
      />
    );
  }

  return (
    <div className="themed h-full overflow-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line text-fg-faint">
            <Th>Symbol</Th>
            <Th>Side</Th>
            <Th align="right">Qty</Th>
            <Th align="right">Entry</Th>
            <Th align="right">Current</Th>
            <Th align="right">SL / TP</Th>
            <Th align="right">Value</Th>
            <Th align="right">P/L</Th>
            <Th align="right">Opened</Th>
            <Th align="right">·</Th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const current = prices.get(p.symbol) ?? p.entryPrice;
            const precision = pricePrecisionFor(current || p.entryPrice);
            const pnl =
              p.side === "buy"
                ? (current - p.entryPrice) * p.quantity
                : (p.entryPrice - current) * p.quantity;
            const value = current * p.quantity;
            return (
              <tr
                key={p.id}
                className="border-b border-line-muted hover:bg-hover-bg"
              >
                <Td className="font-mono font-semibold text-fg">{p.symbol}</Td>
                <Td>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      p.side === "buy"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400",
                    )}
                  >
                    {p.side}
                  </span>
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatQty(p.quantity)}
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatPrice(p.entryPrice, precision)}
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatPrice(current, precision)}
                </Td>
                <Td align="right" className="font-mono tabular-nums text-fg-muted">
                  {p.stopLoss > 0 ? formatPrice(p.stopLoss, precision) : "—"}
                  {" / "}
                  {p.takeProfit > 0 ? formatPrice(p.takeProfit, precision) : "—"}
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatUsd(value)}
                </Td>
                <Td
                  align="right"
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    pnlColorClass(pnl),
                  )}
                >
                  {formatSignedUsd(pnl)}
                </Td>
                <Td align="right" className="font-mono tabular-nums text-fg-faint">
                  {formatDateTime(p.openedAt)}
                </Td>
                <Td align="right">
                  <button
                    type="button"
                    onClick={() => onClose?.(p.id)}
                    className="themed inline-flex size-5 items-center justify-center rounded text-fg-faint transition-colors hover:bg-rose-500/15 hover:text-rose-400"
                    title="Close position"
                    aria-label="Close position"
                  >
                    <X className="size-3" />
                  </button>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Closed positions table. */
function ClosedPositionsTable({ refreshTick }: { refreshTick: number }) {
  const closed = useMemo(() => {
    void refreshTick;
    return getClosedPositions();
  }, [refreshTick]);

  if (closed.length === 0) {
    return (
      <EmptyTableState
        icon={History}
        title="No closed positions yet"
        subtitle="Closed paper trades will appear here with their realized P/L."
      />
    );
  }

  return (
    <div className="themed h-full overflow-auto">
      <table className="w-full border-collapse text-[11px]">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-line text-fg-faint">
            <Th>Symbol</Th>
            <Th>Side</Th>
            <Th align="right">Qty</Th>
            <Th align="right">Entry</Th>
            <Th align="right">Exit</Th>
            <Th align="right">Realized P/L</Th>
            <Th align="right">Opened</Th>
            <Th align="right">Closed</Th>
          </tr>
        </thead>
        <tbody>
          {closed.map((p: ClosedPosition) => {
            const precision = pricePrecisionFor(
              p.entryPrice || p.exitPrice,
            );
            return (
              <tr
                key={p.id}
                className="border-b border-line-muted hover:bg-hover-bg"
              >
                <Td className="font-mono font-semibold text-fg">{p.symbol}</Td>
                <Td>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase",
                      p.side === "buy"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-rose-500/15 text-rose-400",
                    )}
                  >
                    {p.side}
                  </span>
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatQty(p.quantity)}
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatPrice(p.entryPrice, precision)}
                </Td>
                <Td align="right" className="font-mono tabular-nums">
                  {formatPrice(p.exitPrice, precision)}
                </Td>
                <Td
                  align="right"
                  className={cn(
                    "font-mono font-semibold tabular-nums",
                    pnlColorClass(p.realizedPnl),
                  )}
                >
                  {formatSignedUsd(p.realizedPnl)}
                </Td>
                <Td align="right" className="font-mono tabular-nums text-fg-faint">
                  {formatDateTime(p.openedAt)}
                </Td>
                <Td align="right" className="font-mono tabular-nums text-fg-faint">
                  {formatDateTime(p.closedAt)}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Order history table (placeholder — pending orders aren't persisted yet). */
function OrderHistoryTable({ refreshTick }: { refreshTick: number }) {
  void refreshTick;
  const orders: PendingOrder[] = [];
  if (orders.length === 0) {
    return (
      <EmptyTableState
        icon={Inbox}
        title="No order history"
        subtitle="Pending orders (limit / stop) will be listed here once supported."
      />
    );
  }
  return null;
}

// --- table primitives --------------------------------------------------------

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-2.5 py-1.5 text-[10px] font-medium uppercase tracking-wider",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-2.5 py-1.5",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
    >
      {children}
    </td>
  );
}

function EmptyTableState({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Layers;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <Icon className="size-5 text-fg-faint" />
      <p className="text-xs font-semibold text-fg-muted">{title}</p>
      <p className="max-w-xs text-[11px] text-fg-faint">{subtitle}</p>
    </div>
  );
}

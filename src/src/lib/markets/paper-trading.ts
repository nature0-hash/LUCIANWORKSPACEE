// Paper Trading Engine.
//
// Uses REAL market data (from the provider) but VIRTUAL money. No real
// financial consequences. Positions, orders, and P/L are persisted to
// localStorage so they survive page refreshes.
//
// The account is clearly labeled "PAPER" in the UI.

import type {
  AccountState,
  ClosedPosition,
  OrderSide,
  PendingOrder,
  Position,
  RiskRules,
} from "./types";
import type { RiskCheckResult } from "./types";
import { checkRisk } from "./risk-engine";

const STORAGE_KEY = "lucian-markets-paper-account";
const DEFAULT_STARTING_BALANCE = 100000; // $100,000 virtual USD

interface PaperAccountData {
  startingBalance: number;
  balance: number;
  positions: Position[];
  closedPositions: ClosedPosition[];
  pendingOrders: PendingOrder[];
  dailyLossAmount: number;
  dailyLossResetAt: number;
  weeklyLossAmount: number;
  weeklyLossResetAt: number;
  consecutiveLosses: number;
  lastLossAt: number;
}

function defaultData(): PaperAccountData {
  return {
    startingBalance: DEFAULT_STARTING_BALANCE,
    balance: DEFAULT_STARTING_BALANCE,
    positions: [],
    closedPositions: [],
    pendingOrders: [],
    dailyLossAmount: 0,
    dailyLossResetAt: Date.now() + 24 * 60 * 60 * 1000,
    weeklyLossAmount: 0,
    weeklyLossResetAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    consecutiveLosses: 0,
    lastLossAt: 0,
  };
}

export function loadData(): PaperAccountData {
  if (typeof window === "undefined") return defaultData();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaultData(), ...JSON.parse(stored) };
  } catch {
    // storage unavailable
  }
  return defaultData();
}

export function saveData(data: PaperAccountData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage unavailable
  }
}

/** Generate a position ID. */
function genId(): string {
  return `pos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Open a paper position (market order). */
export function openPosition(
  symbol: string,
  side: OrderSide,
  entryPrice: number,
  quantity: number,
  stopLoss: number = 0,
  takeProfit: number = 0,
  riskRules: RiskRules,
): { success: boolean; position?: Position; error?: string } {
  const data = loadData();
  const entryValue = entryPrice * quantity;

  // Risk check
  const equity = data.balance + data.positions.reduce((s, p) => s + p.unrealizedPnl, 0);
  const riskCheck = checkRisk({
    side,
    entryPrice,
    quantity,
    stopLoss,
    equity,
    positions: data.positions,
    riskRules,
    dailyLossAmount: data.dailyLossAmount,
    weeklyLossAmount: data.weeklyLossAmount,
    consecutiveLosses: data.consecutiveLosses,
    lastLossAt: data.lastLossAt,
    symbol,
  });
  if (!riskCheck.passed) {
    return { success: false, error: riskCheck.reason };
  }

  const position: Position = {
    id: genId(),
    symbol,
    side,
    entryPrice,
    quantity,
    stopLoss,
    takeProfit,
    openedAt: Date.now(),
    unrealizedPnl: 0,
    entryValue,
  };
  data.positions.push(position);
  // Deduct the position value from the balance (margin).
  data.balance -= entryValue;
  saveData(data);
  return { success: true, position };
}

/** Close a paper position at the given exit price. */
export function closePosition(positionId: string, exitPrice: number): {
  success: boolean;
  closed?: ClosedPosition;
  error?: string;
} {
  const data = loadData();
  const idx = data.positions.findIndex((p) => p.id === positionId);
  if (idx < 0) return { success: false, error: "Position not found" };
  const pos = data.positions[idx];

  const realizedPnl =
    pos.side === "buy"
      ? (exitPrice - pos.entryPrice) * pos.quantity
      : (pos.entryPrice - exitPrice) * pos.quantity;

  const closed: ClosedPosition = {
    id: pos.id,
    symbol: pos.symbol,
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice,
    quantity: pos.quantity,
    realizedPnl,
    openedAt: pos.openedAt,
    closedAt: Date.now(),
  };
  data.closedPositions.unshift(closed);
  // Add the position value back + realized P/L.
  data.balance += pos.entryValue + realizedPnl;

  // Track losses for risk rules.
  if (realizedPnl < 0) {
    data.dailyLossAmount += Math.abs(realizedPnl);
    data.weeklyLossAmount += Math.abs(realizedPnl);
    data.consecutiveLosses += 1;
    data.lastLossAt = Date.now();
  } else {
    data.consecutiveLosses = 0;
  }

  data.positions.splice(idx, 1);
  saveData(data);
  return { success: true, closed };
}

/** Update unrealized P/L for all open positions based on current market prices. */
export function updateUnrealizedPnl(prices: Map<string, number>): void {
  const data = loadData();
  let changed = false;
  for (const pos of data.positions) {
    const price = prices.get(pos.symbol);
    if (price !== undefined) {
      pos.unrealizedPnl =
        pos.side === "buy"
          ? (price - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - price) * pos.quantity;
      changed = true;

      // Auto-close on SL/TP hit.
      if (pos.stopLoss > 0) {
        if (pos.side === "buy" && price <= pos.stopLoss) {
          closePosition(pos.id, pos.stopLoss);
          return;
        }
        if (pos.side === "sell" && price >= pos.stopLoss) {
          closePosition(pos.id, pos.stopLoss);
          return;
        }
      }
      if (pos.takeProfit > 0) {
        if (pos.side === "buy" && price >= pos.takeProfit) {
          closePosition(pos.id, pos.takeProfit);
          return;
        }
        if (pos.side === "sell" && price <= pos.takeProfit) {
          closePosition(pos.id, pos.takeProfit);
          return;
        }
      }
    }
  }
  if (changed) saveData(data);
}

/** Get the current account state (computed from stored data + live prices). */
export function getAccountState(prices?: Map<string, number>): AccountState {
  const data = loadData();

  // Reset daily/weekly loss counters if needed.
  const now = Date.now();
  if (now > data.dailyLossResetAt) {
    data.dailyLossAmount = 0;
    data.dailyLossResetAt = now + 24 * 60 * 60 * 1000;
  }
  if (now > data.weeklyLossResetAt) {
    data.weeklyLossAmount = 0;
    data.weeklyLossResetAt = now + 7 * 24 * 60 * 60 * 1000;
  }

  let floatingPnl = 0;
  let margin = 0;
  for (const pos of data.positions) {
    const price = prices?.get(pos.symbol);
    if (price !== undefined) {
      pos.unrealizedPnl =
        pos.side === "buy"
          ? (price - pos.entryPrice) * pos.quantity
          : (pos.entryPrice - price) * pos.quantity;
    }
    floatingPnl += pos.unrealizedPnl;
    margin += pos.entryValue;
  }

  const equity = data.balance + floatingPnl;
  const freeMargin = equity - margin;
  const marginLevel = margin > 0 ? (equity / margin) * 100 : 0;

  return {
    mode: "paper",
    startingBalance: data.startingBalance,
    balance: data.balance,
    equity,
    margin,
    freeMargin,
    marginLevel,
    floatingPnl,
  };
}

/** Get all open positions. */
export function getOpenPositions(): Position[] {
  return loadData().positions;
}

/** Get all closed positions (most recent first). */
export function getClosedPositions(): ClosedPosition[] {
  return loadData().closedPositions;
}

/** Reset the paper account to its starting balance. */
export function resetPaperAccount(): void {
  saveData(defaultData());
}

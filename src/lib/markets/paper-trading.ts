// Paper trading stub — minimal in-memory account so the markets store can
// return a sensible AccountState without an actual trading backend.

import type { AccountState } from "./types";

const STARTING_BALANCE = 1000;

let virtualBalance = STARTING_BALANCE;
let openPositions: unknown[] = [];

export function getVirtualBalance(): number {
  return virtualBalance;
}

export function depositVirtual(amount: number): void {
  virtualBalance += amount;
}

export function withdrawVirtual(amount: number): boolean {
  if (amount > virtualBalance) return false;
  virtualBalance -= amount;
  return true;
}

export function resetPaperAccount(): void {
  virtualBalance = STARTING_BALANCE;
  openPositions = [];
}

export function getAccountState(prices: Map<string, number>): AccountState {
  // Without real positions there's no floating PnL, but the shape must
  // match what the markets store expects.
  const equity = virtualBalance;
  const floatingPnl = 0;
  return {
    balance: virtualBalance,
    margin: 0,
    freeMargin: virtualBalance,
    marginLevel: 0,
    equity,
    floatingPnl,
    openPositions,
  };
}

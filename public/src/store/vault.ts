"use client";

// LUCIAN Vault — financial control center state.
//
// Vault manages:
//   - Connected financial accounts (banks, cards, wallets, brokerages)
//   - Capital pools (trading, investing, business, research, reserve, agent)
//   - Allocations between pools
//   - Transaction history
//   - Agent Capital (explicitly allocated, never auto-granted)
//
// All state is persisted to localStorage — no server, no database, no
// environment variables required.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/** A connected financial account. */
export interface ConnectedAccount {
  id: string;
  /** Display name. */
  label: string;
  /** Provider type. */
  type: "bank" | "card" | "crypto-wallet" | "brokerage" | "trading";
  /** Provider name (e.g. "Chase", "Binance", "MetaMask"). */
  provider: string;
  /** Last 4 digits / chars (never full numbers). */
  maskedIdentifier: string;
  /** Available balance in this account (0 when not connected). */
  balance: number;
  /** Currency code. */
  currency: string;
  /** When the account was linked. */
  connectedAt: number;
}

/** A capital pool (allocation bucket). */
export interface CapitalPool {
  id: string;
  label: string;
  /** Current allocated amount. */
  allocated: number;
  /** Whether this pool is authorized to feed into Markets. */
  feedsMarkets: boolean;
  /** Whether this pool is authorized for Agent use. */
  agentAccessible: boolean;
}

/** A transaction record. */
export interface VaultTransaction {
  id: string;
  /** Source pool or account. */
  from: string;
  /** Destination pool or account. */
  to: string;
  amount: number;
  currency: string;
  timestamp: number;
  /** Optional description. */
  description: string;
}

export interface VaultState {
  // Connected accounts
  accounts: ConnectedAccount[];
  // Capital pools
  pools: CapitalPool[];
  // Transaction history
  transactions: VaultTransaction[];

  // Actions
  addAccount: (account: Omit<ConnectedAccount, "id" | "connectedAt">) => void;
  removeAccount: (id: string) => void;

  allocateToPool: (poolId: string, amount: number) => void;
  deallocateFromPool: (poolId: string, amount: number) => void;
  setPoolFeedsMarkets: (poolId: string, feeds: boolean) => void;
  setPoolAgentAccessible: (poolId: string, accessible: boolean) => void;

  // Derived values
  getTotalConnectedCapital: () => number;
  getAllocatedCapital: () => number;
  getAvailableCapital: () => number;
  getTradingCapital: () => number;
  getAgentCapital: () => number;
}

const DEFAULT_POOLS: CapitalPool[] = [
  { id: "trading", label: "Trading Capital", allocated: 0, feedsMarkets: true, agentAccessible: false },
  { id: "investing", label: "Investment Capital", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "business", label: "Business Capital", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "research", label: "Research Budget", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "infrastructure", label: "Software / Infrastructure", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "advertising", label: "Advertising", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "experiments", label: "Experiments", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "reserve", label: "Reserve", allocated: 0, feedsMarkets: false, agentAccessible: false },
  { id: "agent", label: "Agent Capital", allocated: 0, feedsMarkets: false, agentAccessible: true },
];

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      accounts: [],
      pools: DEFAULT_POOLS,
      transactions: [],

      addAccount: (account) =>
        set((s) => ({
          accounts: [
            ...s.accounts,
            { ...account, id: `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, connectedAt: Date.now() },
          ],
        })),

      removeAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
        })),

      allocateToPool: (poolId, amount) =>
        set((s) => ({
          pools: s.pools.map((p) =>
            p.id === poolId ? { ...p, allocated: p.allocated + amount } : p,
          ),
          transactions: [
            {
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              from: "available",
              to: poolId,
              amount,
              currency: "USD",
              timestamp: Date.now(),
              description: `Allocated to ${s.pools.find((p) => p.id === poolId)?.label ?? poolId}`,
            },
            ...s.transactions,
          ],
        })),

      deallocateFromPool: (poolId, amount) =>
        set((s) => ({
          pools: s.pools.map((p) =>
            p.id === poolId ? { ...p, allocated: Math.max(0, p.allocated - amount) } : p,
          ),
          transactions: [
            {
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              from: poolId,
              to: "available",
              amount,
              currency: "USD",
              timestamp: Date.now(),
              description: `Deallocated from ${s.pools.find((p) => p.id === poolId)?.label ?? poolId}`,
            },
            ...s.transactions,
          ],
        })),

      setPoolFeedsMarkets: (poolId, feeds) =>
        set((s) => ({
          pools: s.pools.map((p) =>
            p.id === poolId ? { ...p, feedsMarkets: feeds } : p,
          ),
        })),

      setPoolAgentAccessible: (poolId, accessible) =>
        set((s) => ({
          pools: s.pools.map((p) =>
            p.id === poolId ? { ...p, agentAccessible: accessible } : p,
          ),
        })),

      getTotalConnectedCapital: () =>
        get().accounts.reduce((s, a) => s + a.balance, 0),

      getAllocatedCapital: () =>
        get().pools.reduce((s, p) => s + p.allocated, 0),

      getAvailableCapital: () =>
        get().getTotalConnectedCapital() - get().getAllocatedCapital(),

      getTradingCapital: () =>
        get().pools.find((p) => p.id === "trading")?.allocated ?? 0,

      getAgentCapital: () =>
        get().pools.find((p) => p.id === "agent")?.allocated ?? 0,
    }),
    {
      name: "lucian-vault",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
        return localStorage;
      }),
    },
  ),
);

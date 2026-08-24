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
  /** Transaction type for activity filtering. */
  type:
    | "deposit"
    | "withdrawal"
    | "transfer"
    | "markets-allocation"
    | "funding"
    | "investment"
    | "security"
    | "connection";
  /** "real" or "virtual" funds. */
  fundType: "real" | "virtual";
  /** Status of the transaction. */
  status: "completed" | "pending" | "failed";
}

/** A holding (owned asset). */
export interface VaultHolding {
  id: string;
  symbol: string;
  name: string;
  type: "cash" | "crypto" | "stock" | "etf" | "stablecoin" | "other";
  quantity: number;
  value: number;
  changePct: number;
  fundType: "real" | "virtual";
}

/** Vault-level user settings. */
export interface VaultSettings {
  hideBalances: boolean;
  baseCurrency: string;
  defaultView: "overview" | "accounts" | "balances" | "transfers" | "activity" | "holdings" | "funding" | "security";
  defaultBalanceMode: "total" | "real" | "virtual";
  notifications: {
    deposits: boolean;
    withdrawals: boolean;
    transfers: boolean;
    failedTransactions: boolean;
    largeBalanceChanges: boolean;
  };
  security: {
    requireTransferConfirmation: boolean;
    maskSensitiveValues: boolean;
    sessionTimeoutMin: number;
  };
}

const DEFAULT_SETTINGS: VaultSettings = {
  hideBalances: false,
  baseCurrency: "USD",
  defaultView: "overview",
  defaultBalanceMode: "total",
  notifications: {
    deposits: true,
    withdrawals: true,
    transfers: true,
    failedTransactions: true,
    largeBalanceChanges: false,
  },
  security: {
    requireTransferConfirmation: true,
    maskSensitiveValues: false,
    sessionTimeoutMin: 30,
  },
};

export interface VaultState {
  // Connected accounts
  accounts: ConnectedAccount[];
  // Capital pools
  pools: CapitalPool[];
  // Transaction history
  transactions: VaultTransaction[];
  // Holdings (owned assets)
  holdings: VaultHolding[];
  // Vault-level settings
  settings: VaultSettings;

  // Actions
  addAccount: (account: Omit<ConnectedAccount, "id" | "connectedAt">) => void;
  removeAccount: (id: string) => void;

  allocateToPool: (poolId: string, amount: number) => void;
  deallocateFromPool: (poolId: string, amount: number) => void;
  setPoolFeedsMarkets: (poolId: string, feeds: boolean) => void;
  setPoolAgentAccessible: (poolId: string, accessible: boolean) => void;

  updateSettings: (patch: Partial<VaultSettings>) => void;
  resetSettings: () => void;

  // Derived values
  getTotalConnectedCapital: () => number;
  getAllocatedCapital: () => number;
  getAvailableCapital: () => number;
  getTradingCapital: () => number;
  getAgentCapital: () => number;
  /** Sum of real-fund account balances + real holdings value. */
  getRealBalance: () => number;
  /** Sum of virtual-fund balances + virtual holdings value. */
  getVirtualBalance: () => number;
  /** Real + Virtual. */
  getTotalBalance: () => number;
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

/** Demo seed data — used only on first load (when localStorage is empty).
    Clearly structured as sample data; the architecture supports replacing
    it with real provider integrations later. */

const DEMO_ACCOUNTS: ConnectedAccount[] = [
  {
    id: "acct_demo_primary_cash",
    label: "Primary Cash",
    type: "bank",
    provider: "LUCIAN Bank",
    maskedIdentifier: "••4821",
    balance: 25000,
    currency: "USD",
    connectedAt: Date.now() - 30 * 86400000,
  },
  {
    id: "acct_demo_connected_bank",
    label: "Connected Bank",
    type: "bank",
    provider: "First National",
    maskedIdentifier: "••9307",
    balance: 12400,
    currency: "USD",
    connectedAt: Date.now() - 20 * 86400000,
  },
  {
    id: "acct_demo_markets_virtual",
    label: "Markets Virtual",
    type: "trading",
    provider: "LUCIAN Markets",
    maskedIdentifier: "VIRT-001",
    balance: 100000,
    currency: "USD",
    connectedAt: Date.now() - 15 * 86400000,
  },
  {
    id: "acct_demo_demo_reserve",
    label: "Demo Reserve",
    type: "trading",
    provider: "LUCIAN Markets",
    maskedIdentifier: "VIRT-002",
    balance: 5000,
    currency: "USD",
    connectedAt: Date.now() - 10 * 86400000,
  },
  {
    id: "acct_demo_crypto_wallet",
    label: "Crypto Wallet",
    type: "crypto-wallet",
    provider: "MetaMask",
    maskedIdentifier: "0x4f…b21a",
    balance: 3821.18,
    currency: "USD",
    connectedAt: Date.now() - 5 * 86400000,
  },
];

const DEMO_HOLDINGS: VaultHolding[] = [
  { id: "h_btc", symbol: "BTC", name: "Bitcoin", type: "crypto", quantity: 0.05, value: 3856.42, changePct: 1.24, fundType: "real" },
  { id: "h_aapl", symbol: "AAPL", name: "Apple Inc.", type: "stock", quantity: 12, value: 2680.44, changePct: -0.32, fundType: "real" },
  { id: "h_usdc", symbol: "USDC", name: "USD Coin", type: "stablecoin", quantity: 1500, value: 1500, changePct: 0.01, fundType: "real" },
  { id: "h_etf", symbol: "VOO", name: "Vanguard S&P 500 ETF", type: "etf", quantity: 4, value: 1842.16, changePct: 0.44, fundType: "real" },
  { id: "h_cash", symbol: "USD", name: "Cash", type: "cash", quantity: 1, value: 4200, changePct: 0, fundType: "real" },
  { id: "h_virt_btc", symbol: "BTC", name: "Bitcoin (Virtual)", type: "crypto", quantity: 0.5, value: 38564.20, changePct: 1.24, fundType: "virtual" },
];

const DEMO_TRANSACTIONS: VaultTransaction[] = [
  {
    id: "tx_demo_1",
    from: "Connected Bank",
    to: "Primary Cash",
    amount: 5000,
    currency: "USD",
    timestamp: Date.now() - 2 * 3600000,
    description: "Transfer from Connected Bank",
    type: "transfer",
    fundType: "real",
    status: "completed",
  },
  {
    id: "tx_demo_2",
    from: "Primary Cash",
    to: "Trading Capital",
    amount: 1000,
    currency: "USD",
    timestamp: Date.now() - 5 * 3600000,
    description: "Markets allocation",
    type: "markets-allocation",
    fundType: "real",
    status: "completed",
  },
  {
    id: "tx_demo_3",
    from: "LUCIAN Bank",
    to: "Primary Cash",
    amount: 25000,
    currency: "USD",
    timestamp: Date.now() - 30 * 86400000,
    description: "Initial deposit",
    type: "deposit",
    fundType: "real",
    status: "completed",
  },
  {
    id: "tx_demo_4",
    from: "LUCIAN Markets",
    to: "Markets Virtual",
    amount: 100000,
    currency: "USD",
    timestamp: Date.now() - 15 * 86400000,
    description: "Virtual account funded",
    type: "funding",
    fundType: "virtual",
    status: "completed",
  },
  {
    id: "tx_demo_5",
    from: "Crypto Wallet",
    to: "Primary Cash",
    amount: 500,
    currency: "USD",
    timestamp: Date.now() - 86400000,
    description: "Crypto → Cash conversion",
    type: "transfer",
    fundType: "real",
    status: "pending",
  },
  {
    id: "tx_demo_6",
    from: "Primary Cash",
    to: "—",
    amount: 250,
    currency: "USD",
    timestamp: Date.now() - 2 * 86400000,
    description: "Withdrawal failed — insufficient destination info",
    type: "withdrawal",
    fundType: "real",
    status: "failed",
  },
];

export const useVaultStore = create<VaultState>()(
  persist(
    (set, get) => ({
      accounts: DEMO_ACCOUNTS,
      pools: DEFAULT_POOLS,
      transactions: DEMO_TRANSACTIONS,
      holdings: DEMO_HOLDINGS,
      settings: DEFAULT_SETTINGS,

      addAccount: (account) =>
        set((s) => ({
          accounts: [
            ...s.accounts,
            { ...account, id: `acct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, connectedAt: Date.now() },
          ],
          transactions: [
            {
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              from: "external",
              to: account.label,
              amount: account.balance,
              currency: account.currency,
              timestamp: Date.now(),
              description: `Connected ${account.label}`,
              type: "connection",
              fundType: account.type === "trading" ? "virtual" : "real",
              status: "completed",
            },
            ...s.transactions,
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
              type: "markets-allocation",
              fundType: "real",
              status: "completed",
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
              type: "markets-allocation",
              fundType: "real",
              status: "completed",
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

      updateSettings: (patch) =>
        set((s) => ({
          settings: { ...s.settings, ...patch },
        })),

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),

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

      getRealBalance: () => {
        const realAccounts = get()
          .accounts.filter((a) => a.type !== "trading")
          .reduce((s, a) => s + a.balance, 0);
        const realHoldings = get()
          .holdings.filter((h) => h.fundType === "real")
          .reduce((s, h) => s + h.value, 0);
        return realAccounts + realHoldings;
      },

      getVirtualBalance: () => {
        const virtualAccounts = get()
          .accounts.filter((a) => a.type === "trading")
          .reduce((s, a) => s + a.balance, 0);
        const virtualHoldings = get()
          .holdings.filter((h) => h.fundType === "virtual")
          .reduce((s, h) => s + h.value, 0);
        return virtualAccounts + virtualHoldings;
      },

      getTotalBalance: () => get().getRealBalance() + get().getVirtualBalance(),
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

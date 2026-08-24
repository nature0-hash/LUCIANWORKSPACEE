"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Plus,
  Wallet,
  TrendingUp,
  TrendingDown,
  Building2,
  Shield,
  ArrowRight,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  MoveHorizontal,
  Link2,
  Activity as ActivityIcon,
  Eye,
  EyeOff,
  Settings as SettingsIcon,
  Bell,
  Lock,
  Check,
  ChevronRight,
  LayoutGrid,
  Coins,
  PiggyBank,
} from "lucide-react";
import { useVaultStore, type ConnectedAccount, type VaultTransaction } from "@/store/vault";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-devspace/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-devspace/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type VaultTab =
  | "overview"
  | "accounts"
  | "balances"
  | "transfers"
  | "activity"
  | "holdings"
  | "funding"
  | "security";

/** Re-exported for type narrowing in Select onValueChange callbacks. */
type VaultSettings = ReturnType<typeof useVaultStore.getState>["settings"];

const TABS: { id: VaultTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "accounts", label: "Accounts" },
  { id: "balances", label: "Balances" },
  { id: "transfers", label: "Transfers" },
  { id: "activity", label: "Activity" },
  { id: "holdings", label: "Holdings" },
  { id: "funding", label: "Funding" },
  { id: "security", label: "Security" },
];

const TIME_RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
type TimeRange = (typeof TIME_RANGES)[number];

const QUICK_ACTIONS = [
  { id: "deposit", label: "Deposit", icon: ArrowDownToLine },
  { id: "withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight },
  { id: "move", label: "Move Funds", icon: MoveHorizontal },
  { id: "connect", label: "Connect Account", icon: Link2 },
  { id: "activity", label: "View Activity", icon: ActivityIcon },
] as const;

export function VaultDashboard() {
  const store = useVaultStore();
  const [tab, setTab] = useState<VaultTab>(store.settings.defaultView);
  const [hideBalances, setHideBalances] = useState(store.settings.hideBalances);
  const [addOpen, setAddOpen] = useState(false);

  // Apply hideBalances to the store on toggle.
  useEffect(() => {
    store.updateSettings({ hideBalances });
  }, [hideBalances]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalBalance = store.getTotalBalance();
  const realBalance = store.getRealBalance();
  const virtualBalance = store.getVirtualBalance();

  return (
    <div className="themed flex h-full min-h-0 flex-col bg-canvas text-fg">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-line-muted px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-fg">Vault</h1>
            <p className="mt-0.5 text-sm text-fg-muted">
              Manage balances, accounts, transfers, and holdings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setHideBalances((v) => !v)}
              title={hideBalances ? "Show balances" : "Hide balances"}
            >
              {hideBalances ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="ml-1.5 hidden sm:inline">
                {hideBalances ? "Show" : "Hide"}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTab("security")}
              title="Vault settings"
            >
              <SettingsIcon className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">Settings</span>
            </Button>
          </div>
        </div>

        {/* Quick action row */}
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  if (action.id === "connect") setAddOpen(true);
                  else if (action.id === "activity") setTab("activity");
                  else if (action.id === "deposit")
                    toast({ title: "Deposit", description: "Connect a funding source to deposit real funds." });
                  else if (action.id === "withdraw")
                    toast({ title: "Withdraw", description: "Withdrawals require a connected bank account." });
                  else if (action.id === "transfer" || action.id === "move")
                    toast({ title: action.label, description: "Select a source and destination in the Transfers tab." });
                }}
                className="flex items-center gap-1.5 rounded-md border border-line-muted bg-surface px-3 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg themed"
              >
                <Icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Tab strip */}
        <div className="mt-3 flex flex-wrap gap-1 border-b border-line-muted/60">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "px-3 py-2 text-[12px] font-medium transition-colors themed",
                tab === t.id
                  ? "border-b-2 border-[var(--accent)] text-fg"
                  : "border-b-2 border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body: left account navigator + main content ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left account navigator */}
        <AccountNavigator
          hidden={hideBalances}
          onAddAccount={() => setAddOpen(true)}
        />

        {/* Main content area */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {tab === "overview" && <OverviewTab hidden={hideBalances} onSwitchTab={setTab} />}
          {tab === "accounts" && <AccountsTab hidden={hideBalances} onAddAccount={() => setAddOpen(true)} />}
          {tab === "balances" && <BalancesTab hidden={hideBalances} />}
          {tab === "transfers" && <TransfersTab hidden={hideBalances} />}
          {tab === "activity" && <ActivityTab hidden={hideBalances} />}
          {tab === "holdings" && <HoldingsTab hidden={hideBalances} />}
          {tab === "funding" && <FundingTab onAddAccount={() => setAddOpen(true)} />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>

      {/* Add account dialog */}
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Account navigator (left panel)                                      */
/* ------------------------------------------------------------------ */

function AccountNavigator({
  hidden,
  onAddAccount,
}: {
  hidden: boolean;
  onAddAccount: () => void;
}) {
  const accounts = useVaultStore((s) => s.accounts);
  const getTotalBalance = useVaultStore((s) => s.getTotalBalance);
  const total = getTotalBalance();

  const realAccounts = accounts.filter((a) => a.type !== "trading");
  const virtualAccounts = accounts.filter((a) => a.type === "trading");
  const connectedAccounts = accounts.filter(
    (a) => a.type === "crypto-wallet" || a.type === "brokerage" || a.type === "card",
  );

  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-line-muted bg-surface-2/40 sm:flex sm:flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 pb-2 pt-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
          Accounts
        </h2>
        <p className="mt-0.5 text-[9px] text-fg-faint">
          As of {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </p>
      </div>

      {/* Scrollable account list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* All Funds summary */}
        <div className="mb-3 rounded-md border border-line-muted bg-surface px-3 py-2.5">
          <div className="text-[10px] uppercase tracking-wide text-fg-muted">All Funds</div>
          <div className="mt-0.5 font-mono text-[16px] font-bold tabular-nums text-fg">
            {hidden ? "••••••" : formatCurrency(total)}
          </div>
        </div>

        {/* Real Funds */}
        <AccountGroup label="Real Funds" accounts={realAccounts} hidden={hidden} />

        {/* Virtual Funds */}
        <AccountGroup label="Virtual Funds" accounts={virtualAccounts} hidden={hidden} />

        {/* Connected */}
        {connectedAccounts.length > 0 && (
          <AccountGroup label="Connected" accounts={connectedAccounts} hidden={hidden} />
        )}
      </div>

      {/* Add account button */}
      <div className="shrink-0 border-t border-line-muted p-2">
        <button
          type="button"
          onClick={onAddAccount}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        >
          <Plus className="h-4 w-4" />
          Connect account
        </button>
      </div>
    </aside>
  );
}

function AccountGroup({
  label,
  accounts,
  hidden,
}: {
  label: string;
  accounts: ConnectedAccount[];
  hidden: boolean;
}) {
  if (accounts.length === 0) return null;
  const total = accounts.reduce((s, a) => s + a.balance, 0);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-1 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-fg-faint">
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-fg-muted">
          {hidden ? "••••" : formatCurrency(total)}
        </span>
      </div>
      {accounts.map((a) => (
        <button
          key={a.id}
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-hover"
        >
          <AccountTypeIcon type={a.type} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] font-medium text-fg">{a.label}</div>
            <div className="truncate text-[9px] text-fg-faint">{a.maskedIdentifier}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] tabular-nums text-fg">
              {hidden ? "••••" : formatCurrency(a.balance)}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function AccountTypeIcon({ type }: { type: ConnectedAccount["type"] }) {
  const className = "h-3.5 w-3.5 text-fg-muted";
  switch (type) {
    case "bank":
      return <Building2 className={className} />;
    case "card":
      return <CreditCard className={className} />;
    case "crypto-wallet":
      return <Wallet className={className} />;
    case "brokerage":
      return <TrendingUp className={className} />;
    case "trading":
      return <Banknote className={className} />;
    default:
      return <Banknote className={className} />;
  }
}

/* ------------------------------------------------------------------ */
/* Overview tab                                                        */
/* ------------------------------------------------------------------ */

function OverviewTab({
  hidden,
  onSwitchTab,
}: {
  hidden: boolean;
  onSwitchTab: (t: VaultTab) => void;
}) {
  const store = useVaultStore();
  const [balanceMode, setBalanceMode] = useState<"total" | "real" | "virtual">(
    store.settings.defaultBalanceMode,
  );
  const [timeRange, setTimeRange] = useState<TimeRange>("1M");

  const totalBalance = store.getTotalBalance();
  const realBalance = store.getRealBalance();
  const virtualBalance = store.getVirtualBalance();
  const displayedBalance =
    balanceMode === "total" ? totalBalance : balanceMode === "real" ? realBalance : virtualBalance;

  // Compute change based on mode (demo values).
  const changePct = balanceMode === "virtual" ? 0.04 : 0.52;
  const changeAmount = displayedBalance * (changePct / 100);

  // Chart data — deterministic based on the selected range + mode.
  const chartData = useMemo(
    () => generateSparkline(timeRange, balanceMode, displayedBalance),
    [timeRange, balanceMode, displayedBalance],
  );

  return (
    <div className="space-y-4">
      {/* Total Balance card */}
      <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[13px] font-semibold text-fg">Total Balance</h3>
              {/* Total / Real / Virtual toggle */}
              <div className="flex items-center gap-0.5 rounded-md border border-line-muted bg-surface-2 p-0.5">
                {(["total", "real", "virtual"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setBalanceMode(mode)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-medium capitalize transition-colors themed",
                      balanceMode === mode
                        ? mode === "real"
                          ? "bg-[#3b82f6] text-white"
                          : mode === "virtual"
                          ? "bg-[#10b981] text-white"
                          : "bg-[var(--accent)] text-[var(--accent-fg)]"
                        : "text-fg-muted hover:text-fg",
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 font-mono text-[28px] font-bold tabular-nums text-fg">
              {hidden ? "••••••••" : formatCurrency(displayedBalance)}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px]">
              <span
                className={cn(
                  "flex items-center gap-0.5 font-medium",
                  changePct >= 0 ? "text-[#089981]" : "text-[#f23645]",
                )}
              >
                {changePct >= 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {changePct >= 0 ? "+" : ""}
                {hidden ? "••••" : formatCurrency(changeAmount)} ({changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%)
              </span>
              <span className="text-fg-faint">Today</span>
            </div>
          </div>
          {/* Sparkline chart */}
          <div className="h-[100px] w-full lg:w-[320px]">
            <Sparkline data={chartData} positive={changePct >= 0} />
          </div>
        </div>
        {/* Time range selector */}
        <div className="mt-3 flex items-center gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setTimeRange(r)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-medium transition-colors themed",
                timeRange === r
                  ? "bg-active text-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg",
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Transfer tracker + Asset allocation */}
      <div className="grid gap-4 lg:grid-cols-2">
        <TransferTrackerCard onSwitchTab={onSwitchTab} />
        <AssetAllocationCard hidden={hidden} />
      </div>

      {/* Available funds breakdown */}
      <AvailableFundsCard hidden={hidden} />

      {/* Recent activity */}
      <RecentActivityCard hidden={hidden} onSwitchTab={onSwitchTab} limit={5} />

      {/* Holdings preview */}
      <HoldingsPreviewCard hidden={hidden} onSwitchTab={onSwitchTab} limit={5} />
    </div>
  );
}

/* ── Sparkline (inline SVG) ── */

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 320;
  const height = 100;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");
  const color = positive ? "#089981" : "#f23645";
  const fillColor = positive ? "rgba(8,153,129,0.1)" : "rgba(242,54,69,0.1)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={fillColor}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function generateSparkline(range: TimeRange, mode: string, base: number): number[] {
  const count = range === "1D" ? 24 : range === "1W" ? 7 : range === "1M" ? 30 : range === "3M" ? 90 : range === "1Y" ? 52 : 60;
  const seed = mode.charCodeAt(0) + range.length;
  const out: number[] = [];
  let v = base * 0.95;
  for (let i = 0; i < count; i++) {
    const s = (seed + i) * 9301 + 49297;
    const rnd = ((s % 233280) / 233280) * 2 - 1;
    v = v * (1 + rnd * 0.01);
    out.push(v);
  }
  out.push(base);
  return out;
}

/* ── Transfer tracker ── */

function TransferTrackerCard({ onSwitchTab }: { onSwitchTab: (t: VaultTab) => void }) {
  const transactions = useVaultStore((s) => s.transactions);
  const transfers = transactions.filter((t) => t.type === "transfer" || t.type === "markets-allocation");
  const pending = transfers.filter((t) => t.status === "pending").length;
  const completed = transfers.filter((t) => t.status === "completed").length;
  const failed = transfers.filter((t) => t.status === "failed").length;

  return (
    <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg">Transfer Tracker</h3>
        <button
          type="button"
          onClick={() => onSwitchTab("transfers")}
          className="text-[11px] font-medium text-[var(--accent)] hover:underline"
        >
          View transfers →
        </button>
      </div>
      <p className="mt-1 text-[11px] text-fg-muted">
        Easily view the status of your recent activity.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <StatusBox label="Pending" count={pending} color="text-amber-500" />
        <StatusBox label="Completed" count={completed} color="text-[#089981]" />
        <StatusBox label="Failed" count={failed} color="text-[#f23645]" />
      </div>
      {transfers[0] && (
        <div className="mt-3 border-t border-line-muted pt-2">
          <div className="text-[9px] uppercase tracking-wide text-fg-faint">Latest transfer</div>
          <div className="mt-1 flex items-center justify-between text-[11px]">
            <span className="text-fg">{transfers[0].description}</span>
            <span className="font-mono tabular-nums text-fg">
              {formatCurrency(transfers[0].amount)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBox({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="rounded-md border border-line-muted bg-surface-2 px-2 py-2 text-center">
      <div className={cn("font-mono text-[18px] font-bold tabular-nums", color)}>{count}</div>
      <div className="text-[9px] uppercase tracking-wide text-fg-faint">{label}</div>
    </div>
  );
}

/* ── Asset allocation ── */

function AssetAllocationCard({ hidden }: { hidden: boolean }) {
  const holdings = useVaultStore((s) => s.holdings);
  const accounts = useVaultStore((s) => s.accounts);

  // Aggregate by category.
  const categories = useMemo(() => {
    const cash = accounts.filter((a) => a.type === "bank").reduce((s, a) => s + a.balance, 0);
    const crypto = holdings.filter((h) => h.type === "crypto").reduce((s, h) => s + h.value, 0);
    const stocks = holdings.filter((h) => h.type === "stock" || h.type === "etf").reduce((s, h) => s + h.value, 0);
    const stablecoin = holdings.filter((h) => h.type === "stablecoin").reduce((s, h) => s + h.value, 0);
    const cashHolding = holdings.filter((h) => h.type === "cash").reduce((s, h) => s + h.value, 0);
    const total = cash + crypto + stocks + stablecoin + cashHolding;
    return [
      { label: "Cash", value: cash + cashHolding, color: "#3b82f6" },
      { label: "Crypto", value: crypto, color: "#8b5cf6" },
      { label: "Stocks", value: stocks, color: "#089981" },
      { label: "Stablecoin", value: stablecoin, color: "#f59e0b" },
      { label: "Other", value: 0, color: "#6b7280" },
    ].filter((c) => c.value > 0);
  }, [holdings, accounts]);

  const total = categories.reduce((s, c) => s + c.value, 0);

  return (
    <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
      <h3 className="text-[13px] font-semibold text-fg">Asset Allocation</h3>
      <div className="mt-3 flex items-center gap-4">
        {/* Donut chart */}
        <DonutChart segments={categories} total={total} hidden={hidden} />
        {/* Legend */}
        <div className="flex-1 space-y-1">
          {categories.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-[11px]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: c.color }}
              />
              <span className="flex-1 text-fg-muted">{c.label}</span>
              <span className="font-mono tabular-nums text-fg">
                {hidden ? "•••" : `${((c.value / total) * 100).toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DonutChart({
  segments,
  total,
  hidden,
}: {
  segments: { label: string; value: number; color: string }[];
  total: number;
  hidden: boolean;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 100 100" className="h-[100px] w-[100px]">
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="var(--surface-2)"
        strokeWidth="12"
      />
      {segments.map((s) => {
        const fraction = total > 0 ? s.value / total : 0;
        const dash = fraction * circumference;
        const el = (
          <circle
            key={s.label}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 50 50)"
          />
        );
        offset += dash;
        return el;
      })}
      <text
        x="50"
        y="46"
        textAnchor="middle"
        className="fill-fg font-mono text-[10px] font-bold"
      >
        {hidden ? "••••" : formatCurrency(total, 0)}
      </text>
      <text
        x="50"
        y="58"
        textAnchor="middle"
        className="fill-fg-faint text-[7px] uppercase"
      >
        Total
      </text>
    </svg>
  );
}

/* ── Available funds breakdown ── */

function AvailableFundsCard({ hidden }: { hidden: boolean }) {
  const store = useVaultStore();
  const available = store.getAvailableCapital();
  const reserved = store.getAllocatedCapital();
  const invested = store.holdings.filter((h) => h.fundType === "real").reduce((s, h) => s + h.value, 0);
  const pending = store.transactions.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);
  const virtual = store.getVirtualBalance();

  const rows = [
    { label: "Available", value: available, color: "text-[#089981]" },
    { label: "Reserved", value: reserved, color: "text-fg" },
    { label: "Invested", value: invested, color: "text-fg" },
    { label: "Pending", value: pending, color: "text-amber-500" },
    { label: "Virtual", value: virtual, color: "text-[#8b5cf6]" },
  ];

  return (
    <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
      <h3 className="text-[13px] font-semibold text-fg">Balance Breakdown</h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-md border border-line-muted bg-surface-2 px-3 py-2"
          >
            <div className="text-[9px] uppercase tracking-wide text-fg-faint">{r.label}</div>
            <div className={cn("mt-0.5 font-mono text-[14px] font-bold tabular-nums", r.color)}>
              {hidden ? "••••" : formatCurrency(r.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Recent activity ── */

function RecentActivityCard({
  hidden,
  onSwitchTab,
  limit,
}: {
  hidden: boolean;
  onSwitchTab: (t: VaultTab) => void;
  limit?: number;
}) {
  const transactions = useVaultStore((s) => s.transactions);
  const items = limit ? transactions.slice(0, limit) : transactions;

  return (
    <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg">Recent Activity</h3>
        <button
          type="button"
          onClick={() => onSwitchTab("activity")}
          className="text-[11px] font-medium text-[var(--accent)] hover:underline"
        >
          View all →
        </button>
      </div>
      <div className="mt-2 divide-y divide-line-muted/60">
        {items.map((tx) => (
          <ActivityRow key={tx.id} tx={tx} hidden={hidden} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ tx, hidden }: { tx: VaultTransaction; hidden: boolean }) {
  const icon = getTxIcon(tx.type);
  const statusColor =
    tx.status === "completed"
      ? "text-[#089981]"
      : tx.status === "pending"
      ? "text-amber-500"
      : "text-[#f23645]";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-fg-muted">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] font-medium text-fg">{tx.description}</div>
        <div className="text-[10px] text-fg-faint">
          {tx.from} → {tx.to} · {new Date(tx.timestamp).toLocaleString()}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[12px] tabular-nums text-fg">
          {hidden ? "••••" : formatCurrency(tx.amount)}
        </div>
        <div className={cn("text-[9px] uppercase", statusColor)}>{tx.status}</div>
      </div>
    </div>
  );
}

function getTxIcon(type: VaultTransaction["type"]) {
  switch (type) {
    case "deposit":
      return <ArrowDownToLine className="h-3.5 w-3.5" />;
    case "withdrawal":
      return <ArrowUpFromLine className="h-3.5 w-3.5" />;
    case "transfer":
      return <ArrowLeftRight className="h-3.5 w-3.5" />;
    case "markets-allocation":
      return <LayoutGrid className="h-3.5 w-3.5" />;
    case "funding":
      return <Coins className="h-3.5 w-3.5" />;
    case "investment":
      return <PiggyBank className="h-3.5 w-3.5" />;
    case "security":
      return <Shield className="h-3.5 w-3.5" />;
    case "connection":
      return <Link2 className="h-3.5 w-3.5" />;
    default:
      return <ActivityIcon className="h-3.5 w-3.5" />;
  }
}

/* ── Holdings preview ── */

function HoldingsPreviewCard({
  hidden,
  onSwitchTab,
  limit,
}: {
  hidden: boolean;
  onSwitchTab: (t: VaultTab) => void;
  limit?: number;
}) {
  const holdings = useVaultStore((s) => s.holdings);
  const items = limit ? holdings.slice(0, limit) : holdings;

  return (
    <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-fg">Holdings Preview</h3>
        <button
          type="button"
          onClick={() => onSwitchTab("holdings")}
          className="text-[11px] font-medium text-[var(--accent)] hover:underline"
        >
          View all →
        </button>
      </div>
      <div className="mt-2 divide-y divide-line-muted/60">
        {items.map((h) => (
          <div key={h.id} className="flex items-center gap-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[10px] font-bold text-fg">
              {h.symbol.slice(0, 3)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-fg">{h.symbol}</div>
              <div className="text-[10px] text-fg-faint">
                {h.quantity} {h.symbol} · {h.fundType}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[12px] tabular-nums text-fg">
                {hidden ? "••••" : formatCurrency(h.value)}
              </div>
              <div
                className={cn(
                  "text-[10px] tabular-nums",
                  h.changePct >= 0 ? "text-[#089981]" : "text-[#f23645]",
                )}
              >
                {h.changePct >= 0 ? "+" : ""}
                {h.changePct.toFixed(2)}%
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Accounts tab                                                        */
/* ------------------------------------------------------------------ */

function AccountsTab({
  hidden,
  onAddAccount,
}: {
  hidden: boolean;
  onAddAccount: () => void;
}) {
  const accounts = useVaultStore((s) => s.accounts);
  const removeAccount = useVaultStore((s) => s.removeAccount);

  const groups = [
    { label: "Real Accounts", items: accounts.filter((a) => a.type === "bank" || a.type === "brokerage") },
    { label: "Virtual Accounts", items: accounts.filter((a) => a.type === "trading") },
    { label: "Wallets", items: accounts.filter((a) => a.type === "crypto-wallet") },
    { label: "Cards", items: accounts.filter((a) => a.type === "card") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-fg">All Accounts</h2>
        <Button size="sm" onClick={onAddAccount}>
          <Plus className="h-4 w-4" />
          Connect
        </Button>
      </div>
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.label}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
              {g.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-line-muted bg-surface p-3 themed"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <AccountTypeIcon type={a.type} />
                      <div>
                        <div className="text-[12px] font-semibold text-fg">{a.label}</div>
                        <div className="text-[9px] text-fg-faint">{a.provider}</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAccount(a.id)}
                      className="text-fg-faint hover:text-[#f23645]"
                      title="Remove account"
                    >
                      ×
                    </button>
                  </div>
                  <div className="mt-2 font-mono text-[18px] font-bold tabular-nums text-fg">
                    {hidden ? "••••••" : formatCurrency(a.balance)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px] text-fg-faint">
                    <span>{a.maskedIdentifier}</span>
                    <span>{a.currency}</span>
                    <span>Connected {new Date(a.connectedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ),
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Balances tab                                                        */
/* ------------------------------------------------------------------ */

function BalancesTab({ hidden }: { hidden: boolean }) {
  const store = useVaultStore();
  const total = store.getTotalBalance();
  const real = store.getRealBalance();
  const virtual = store.getVirtualBalance();
  const available = store.getAvailableCapital();
  const reserved = store.getAllocatedCapital();
  const invested = store.holdings.filter((h) => h.fundType === "real").reduce((s, h) => s + h.value, 0);
  const pending = store.transactions.filter((t) => t.status === "pending").reduce((s, t) => s + t.amount, 0);

  const rows = [
    { label: "Total Balance", value: total, color: "text-fg" },
    { label: "Real Balance", value: real, color: "text-[#3b82f6]" },
    { label: "Virtual Balance", value: virtual, color: "text-[#10b981]" },
    { label: "Available", value: available, color: "text-[#089981]" },
    { label: "Reserved", value: reserved, color: "text-fg" },
    { label: "Invested", value: invested, color: "text-fg" },
    { label: "Pending", value: pending, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold text-fg">Balance Breakdown</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-lg border border-line-muted bg-surface p-3 themed"
          >
            <div className="text-[10px] uppercase tracking-wide text-fg-faint">{r.label}</div>
            <div className={cn("mt-1 font-mono text-[20px] font-bold tabular-nums", r.color)}>
              {hidden ? "••••••" : formatCurrency(r.value)}
            </div>
          </div>
        ))}
      </div>
      {/* Real vs Virtual comparison bar */}
      <div className="rounded-lg border border-line-muted bg-surface p-4 themed">
        <h3 className="text-[13px] font-semibold text-fg">Real vs Virtual</h3>
        <div className="mt-3 flex h-6 overflow-hidden rounded-md">
          <div
            className="flex items-center justify-center bg-[#3b82f6] text-[9px] font-bold text-white"
            style={{ width: `${total > 0 ? (real / total) * 100 : 0}%` }}
          >
            {total > 0 && (real / total) * 100 > 10 ? "REAL" : ""}
          </div>
          <div
            className="flex items-center justify-center bg-[#10b981] text-[9px] font-bold text-white"
            style={{ width: `${total > 0 ? (virtual / total) * 100 : 0}%` }}
          >
            {total > 0 && (virtual / total) * 100 > 10 ? "VIRTUAL" : ""}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-fg-muted">
          <span>Real: {hidden ? "••••" : formatCurrency(real)}</span>
          <span>Virtual: {hidden ? "••••" : formatCurrency(virtual)}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Transfers tab                                                       */
/* ------------------------------------------------------------------ */

function TransfersTab({ hidden }: { hidden: boolean }) {
  const transactions = useVaultStore((s) => s.transactions);
  const transfers = transactions.filter(
    (t) => t.type === "transfer" || t.type === "markets-allocation",
  );

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold text-fg">Transfers</h2>
      <div className="rounded-lg border border-line-muted bg-surface themed">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
          <span>From</span>
          <span>To</span>
          <span>Date</span>
          <span>Amount</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-line-muted/60">
          {transfers.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 px-3 py-2 text-[11px]"
            >
              <span className="truncate text-fg">{t.from}</span>
              <span className="truncate text-fg">{t.to}</span>
              <span className="text-fg-muted">{new Date(t.timestamp).toLocaleDateString()}</span>
              <span className="font-mono tabular-nums text-fg">
                {hidden ? "••••" : formatCurrency(t.amount)}
              </span>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                  t.status === "completed" && "bg-[#089981]/15 text-[#089981]",
                  t.status === "pending" && "bg-amber-500/15 text-amber-500",
                  t.status === "failed" && "bg-[#f23645]/15 text-[#f23645]",
                )}
              >
                {t.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Activity tab                                                        */
/* ------------------------------------------------------------------ */

function ActivityTab({ hidden }: { hidden: boolean }) {
  const transactions = useVaultStore((s) => s.transactions);
  const [filter, setFilter] = useState<string>("all");

  const FILTERS = [
    { id: "all", label: "All" },
    { id: "deposits", label: "Deposits" },
    { id: "withdrawals", label: "Withdrawals" },
    { id: "transfers", label: "Transfers" },
    { id: "funding", label: "Funding" },
    { id: "investments", label: "Investments" },
    { id: "markets", label: "Markets" },
    { id: "security", label: "Security" },
  ];

  const filtered = transactions.filter((t) => {
    if (filter === "all") return true;
    if (filter === "deposits") return t.type === "deposit";
    if (filter === "withdrawals") return t.type === "withdrawal";
    if (filter === "transfers") return t.type === "transfer";
    if (filter === "funding") return t.type === "funding";
    if (filter === "investments") return t.type === "investment";
    if (filter === "markets") return t.type === "markets-allocation";
    if (filter === "security") return t.type === "security";
    return true;
  });

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold text-fg">Activity History</h2>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-medium transition-colors themed",
              filter === f.id
                ? "bg-active text-fg"
                : "bg-surface-2 text-fg-muted hover:bg-hover hover:text-fg",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="rounded-lg border border-line-muted bg-surface themed">
        <div className="divide-y divide-line-muted/60">
          {filtered.map((t) => (
            <ActivityRow key={t.id} tx={t} hidden={hidden} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Holdings tab                                                        */
/* ------------------------------------------------------------------ */

function HoldingsTab({ hidden }: { hidden: boolean }) {
  const holdings = useVaultStore((s) => s.holdings);
  const total = holdings.reduce((s, h) => s + h.value, 0);

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold text-fg">Holdings</h2>
      <div className="rounded-lg border border-line-muted bg-surface themed">
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
          <span>Asset</span>
          <span>Type</span>
          <span>Quantity</span>
          <span>Value</span>
          <span>Change</span>
          <span>Allocation</span>
        </div>
        <div className="divide-y divide-line-muted/60">
          {holdings.map((h) => (
            <div
              key={h.id}
              className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 text-[11px]"
            >
              <span className="font-medium text-fg">{h.symbol}</span>
              <span className="capitalize text-fg-muted">{h.type}</span>
              <span className="font-mono tabular-nums text-fg-muted">{h.quantity}</span>
              <span className="font-mono tabular-nums text-fg">
                {hidden ? "••••" : formatCurrency(h.value)}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums",
                  h.changePct >= 0 ? "text-[#089981]" : "text-[#f23645]",
                )}
              >
                {h.changePct >= 0 ? "+" : ""}
                {h.changePct.toFixed(2)}%
              </span>
              <span className="font-mono tabular-nums text-fg-muted">
                {total > 0 ? ((h.value / total) * 100).toFixed(1) : "0.0"}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Funding tab                                                         */
/* ------------------------------------------------------------------ */

function FundingTab({ onAddAccount }: { onAddAccount: () => void }) {
  const accounts = useVaultStore((s) => s.accounts);

  const groups = [
    { label: "Bank Accounts", items: accounts.filter((a) => a.type === "bank") },
    { label: "Cards", items: accounts.filter((a) => a.type === "card") },
    { label: "Crypto Wallets", items: accounts.filter((a) => a.type === "crypto-wallet") },
    { label: "Brokerages", items: accounts.filter((a) => a.type === "brokerage") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-fg">Funding Sources</h2>
        <Button size="sm" onClick={onAddAccount}>
          <Plus className="h-4 w-4" />
          Connect
        </Button>
      </div>
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
            {g.label}
          </h3>
          {g.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line-muted p-4 text-center text-[11px] text-fg-faint">
              No {g.label.toLowerCase()} connected.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border border-line-muted bg-surface p-3 themed"
                >
                  <AccountTypeIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-fg">{a.label}</div>
                    <div className="text-[9px] text-fg-faint">{a.maskedIdentifier}</div>
                  </div>
                  <span className="rounded bg-[#089981]/15 px-1.5 py-0.5 text-[8px] font-bold uppercase text-[#089981]">
                    Active
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Security tab (Vault settings)                                       */
/* ------------------------------------------------------------------ */

function SecurityTab() {
  const settings = useVaultStore((s) => s.settings);
  const updateSettings = useVaultStore((s) => s.updateSettings);
  const resetSettings = useVaultStore((s) => s.resetSettings);

  return (
    <div className="space-y-4">
      <h2 className="text-[15px] font-semibold text-fg">Vault Security & Settings</h2>

      {/* Display settings */}
      <SettingsSection title="Display" icon={Eye}>
        <SettingRow
          label="Hide balance values"
          description="Mask all monetary amounts across Vault"
        >
          <Toggle
            checked={settings.hideBalances}
            onChange={(v) => updateSettings({ hideBalances: v })}
          />
        </SettingRow>
        <SettingRow label="Base currency" description="Currency used for display">
          <Select
            value={settings.baseCurrency}
            onValueChange={(v) => updateSettings({ baseCurrency: v })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="GBP">GBP</SelectItem>
              <SelectItem value="JPY">JPY</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Default view" description="Which tab opens by default">
          <Select
            value={settings.defaultView}
            onValueChange={(v) => updateSettings({ defaultView: v as VaultSettings["defaultView"] })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="accounts">Accounts</SelectItem>
              <SelectItem value="balances">Balances</SelectItem>
              <SelectItem value="transfers">Transfers</SelectItem>
              <SelectItem value="activity">Activity</SelectItem>
              <SelectItem value="holdings">Holdings</SelectItem>
              <SelectItem value="funding">Funding</SelectItem>
              <SelectItem value="security">Security</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow
          label="Default balance mode"
          description="Initial Total/Real/Virtual selection"
        >
          <Select
            value={settings.defaultBalanceMode}
            onValueChange={(v) =>
              updateSettings({ defaultBalanceMode: v as VaultSettings["defaultBalanceMode"] })
            }
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total">Total</SelectItem>
              <SelectItem value="real">Real</SelectItem>
              <SelectItem value="virtual">Virtual</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Notification settings */}
      <SettingsSection title="Notifications" icon={Bell}>
        <SettingRow label="Deposits" description="Notify on incoming deposits">
          <Toggle
            checked={settings.notifications.deposits}
            onChange={(v) => updateSettings({ notifications: { ...settings.notifications, deposits: v } })}
          />
        </SettingRow>
        <SettingRow label="Withdrawals" description="Notify on outgoing withdrawals">
          <Toggle
            checked={settings.notifications.withdrawals}
            onChange={(v) => updateSettings({ notifications: { ...settings.notifications, withdrawals: v } })}
          />
        </SettingRow>
        <SettingRow label="Transfers" description="Notify on internal transfers">
          <Toggle
            checked={settings.notifications.transfers}
            onChange={(v) => updateSettings({ notifications: { ...settings.notifications, transfers: v } })}
          />
        </SettingRow>
        <SettingRow label="Failed transactions" description="Alert on failed transactions">
          <Toggle
            checked={settings.notifications.failedTransactions}
            onChange={(v) => updateSettings({ notifications: { ...settings.notifications, failedTransactions: v } })}
          />
        </SettingRow>
        <SettingRow label="Large balance changes" description="Alert on significant changes">
          <Toggle
            checked={settings.notifications.largeBalanceChanges}
            onChange={(v) => updateSettings({ notifications: { ...settings.notifications, largeBalanceChanges: v } })}
          />
        </SettingRow>
      </SettingsSection>

      {/* Security settings */}
      <SettingsSection title="Security" icon={Lock}>
        <SettingRow
          label="Require transfer confirmation"
          description="Ask before any transfer action"
        >
          <Toggle
            checked={settings.security.requireTransferConfirmation}
            onChange={(v) => updateSettings({ security: { ...settings.security, requireTransferConfirmation: v } })}
          />
        </SettingRow>
        <SettingRow
          label="Mask sensitive values"
          description="Hide balances in headers"
        >
          <Toggle
            checked={settings.security.maskSensitiveValues}
            onChange={(v) => updateSettings({ security: { ...settings.security, maskSensitiveValues: v } })}
          />
        </SettingRow>
        <SettingRow label="Session timeout" description="Auto-lock after inactivity">
          <Select
            value={String(settings.security.sessionTimeoutMin)}
            onValueChange={(v) => updateSettings({ security: { ...settings.security, sessionTimeoutMin: Number(v) } })}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 min</SelectItem>
              <SelectItem value="30">30 min</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingsSection>

      {/* Funding / Provider status */}
      <SettingsSection title="Funding / Provider Status" icon={Link2}>
        <ProviderStatusRow label="Banking sources" status="Not connected" />
        <ProviderStatusRow label="Crypto wallets" status="Not connected" />
        <ProviderStatusRow label="Card providers" status="Not connected" />
        <ProviderStatusRow label="Brokerage" status="Not connected" />
      </SettingsSection>

      {/* Reset */}
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetSettings();
            toast({ title: "Settings reset", description: "Vault settings restored to defaults." });
          }}
        >
          Reset to defaults
        </Button>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Bell;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-line-muted bg-surface themed">
      <div className="flex items-center gap-2 border-b border-line-muted px-4 py-2.5">
        <Icon className="h-4 w-4 text-fg-muted" />
        <h3 className="text-[13px] font-semibold text-fg">{title}</h3>
      </div>
      <div className="divide-y divide-line-muted/60">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-fg">{label}</div>
        {description && (
          <div className="text-[10px] text-fg-faint">{description}</div>
        )}
      </div>
      <div className="ml-3 shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-5 w-9 rounded-full transition-colors",
        checked ? "bg-[var(--accent)]" : "bg-surface-2",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function ProviderStatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-[12px] font-medium text-fg">{label}</span>
      <span className="text-[10px] text-fg-muted">{status}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Add account dialog                                                  */
/* ------------------------------------------------------------------ */

function AddAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addAccount = useVaultStore((s) => s.addAccount);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ConnectedAccount["type"]>("bank");
  const [provider, setProvider] = useState("");
  const [maskedId, setMaskedId] = useState("");
  const [balance, setBalance] = useState("");

  const handleSubmit = () => {
    if (!label.trim()) {
      toast({ title: "Label required", variant: "destructive" });
      return;
    }
    addAccount({
      label: label.trim(),
      type,
      provider: provider.trim() || "Unknown",
      maskedIdentifier: maskedId.trim() || "••••",
      balance: Number(balance) || 0,
      currency: "USD",
    });
    toast({ title: "Manual account added", description: `${label} has been added as a self-reported manual account. Balances are not provider-verified.` });
    setLabel("");
    setProvider("");
    setMaskedId("");
    setBalance("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Manual Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
            Manual accounts use self-reported balances. They are not connected to a real financial provider and are not provider-verified.
          </div>
          <div>
            <Label>Account label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Primary Cash"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Account type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ConnectedAccount["type"])}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="crypto-wallet">Crypto Wallet</SelectItem>
                <SelectItem value="brokerage">Brokerage</SelectItem>
                <SelectItem value="trading">Trading (Virtual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Provider</Label>
            <Input
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Chase, MetaMask"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Identifier (masked)</Label>
            <Input
              value={maskedId}
              onChange={(e) => setMaskedId(e.target.value)}
              placeholder="e.g. ••4821"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Initial balance (USD)</Label>
            <Input
              type="number"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Connect</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function formatCurrency(n: number, decimals = 2): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

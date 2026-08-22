"use client";

import { useState, useEffect } from "react";
import { ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { useMarketsStore } from "@/store/markets";
import { useVaultStore } from "@/store/vault";
import { getProvider } from "@/lib/markets/provider";
import { resetPaperAccount, loadData, saveData } from "@/lib/markets/paper-trading";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function AccountBar() {
  const mode = useMarketsStore((s) => s.mode);
  const setMode = useMarketsStore((s) => s.setMode);
  const account = useMarketsStore((s) => s.account);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);
  const prices = useMarketsStore((s) => s.prices);

  // Vault integration — deposit/withdraw from the Trading Capital pool.
  const vaultPools = useVaultStore((s) => s.pools);
  const allocateToPool = useVaultStore((s) => s.allocateToPool);
  const deallocateFromPool = useVaultStore((s) => s.deallocateFromPool);

  // Auto-refresh account when prices change.
  useAutoRefresh(prices, refreshAccount);

  // Providers are registered client-side only.
  const cryptoProvider = getProvider("crypto");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let c = false;
    Promise.resolve().then(() => { if (!c) setMounted(true); });
    return () => { c = true; };
  }, []);

  const dataStatus = mounted ? (cryptoProvider?.statusLabel ?? "Disconnected") : "Connecting…";
  const dotColor = mounted
    ? (cryptoProvider?.status === "live" ? "bg-green-500"
      : cryptoProvider?.status === "delayed" ? "bg-amber-500"
      : cryptoProvider?.status === "setup-required" ? "bg-zinc-500"
      : "bg-red-500")
    : "bg-amber-500";

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Account values — show all 5 metrics from the spec.
  const metrics = account ? [
    { label: "Equity", value: `$${fmt(account.equity)}` },
    { label: "Balance", value: `$${fmt(account.balance)}` },
    { label: "Margin", value: `$${fmt(account.margin)}` },
    { label: "Free Margin", value: `$${fmt(account.freeMargin)}` },
    {
      label: "Margin Level",
      value: account.marginLevel > 0 ? `${fmt(account.marginLevel)}%` : "—",
    },
    {
      label: "Floating P/L",
      value: `${account.floatingPnl >= 0 ? "+" : ""}$${fmt(account.floatingPnl)}`,
      color: account.floatingPnl > 0 ? "text-green-500" : account.floatingPnl < 0 ? "text-red-500" : undefined,
    },
  ] : [];

  const handleDeposit = () => {
    // In Virtual mode: transfer from Vault Trading Capital pool → Markets account.
    // In Real mode: requires a broker connection.
    if (mode === "real") {
      toast({ title: "Broker connection required", description: "Real deposits require a connected broker.", variant: "destructive" });
      return;
    }
    const tradingPool = vaultPools.find((p) => p.id === "trading");
    if (!tradingPool || tradingPool.allocated <= 0) {
      toast({ title: "No trading capital", description: "Allocate capital in Vault → Trading Capital pool first.", variant: "destructive" });
      return;
    }
    // Deposit $1,000 from Vault Trading Capital.
    const amount = Math.min(1000, tradingPool.allocated);
    deallocateFromPool("trading", amount);
    // Add to paper account balance.
    const data = loadData();
    data.balance += amount;
    saveData(data);
    refreshAccount();
    toast({ title: "Deposit complete", description: `$${amount.toFixed(2)} deposited from Vault → Trading Capital.` });
  };

  const handleWithdraw = () => {
    if (mode === "real") {
      toast({ title: "Broker connection required", description: "Real withdrawals require a connected broker.", variant: "destructive" });
      return;
    }
    if (!account || account.balance <= 0) {
      toast({ title: "Insufficient balance", description: "No funds to withdraw.", variant: "destructive" });
      return;
    }
    const amount = Math.min(1000, account.balance);
    const data = loadData();
    data.balance -= amount;
    saveData(data);
    allocateToPool("trading", amount);
    refreshAccount();
    toast({ title: "Withdrawal complete", description: `$${amount.toFixed(2)} withdrawn to Vault → Trading Capital.` });
  };

  const handleReset = () => {
    if (mode === "real") return;
    resetPaperAccount();
    refreshAccount();
    toast({ title: "Virtual account reset", description: "Balance restored to $100,000.00." });
  };

  return (
    <div className="themed flex h-8 shrink-0 items-center gap-3 border-b border-line-muted bg-surface-2/40 px-3 text-[11px]">
      {/* Mode toggle — Virtual / Real */}
      <div className="flex items-center gap-0.5 rounded-md border border-line bg-inset p-0.5">
        <button
          onClick={() => setMode("paper")}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold transition-colors",
            mode === "paper"
              ? "bg-accent text-accent-fg"
              : "text-fg-faint hover:text-fg",
          )}
        >
          Virtual
        </button>
        <button
          onClick={() => setMode("real")}
          className={cn(
            "rounded px-2 py-0.5 text-[10px] font-bold transition-colors",
            mode === "real"
              ? "bg-red-600 text-white"
              : "text-fg-faint hover:text-fg",
          )}
        >
          Real
        </button>
      </div>

      <div className="h-3 w-px bg-line-muted" />

      {/* Account metrics */}
      {mode === "paper" ? (
        <div className="flex items-center gap-3 overflow-x-auto">
          {metrics.map((m) => (
            <div key={m.label} className="flex shrink-0 items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-fg-faint">{m.label}</span>
              <span className={cn("font-mono tabular-nums font-medium", m.color ?? "text-fg")}>{m.value}</span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-red-500">Broker connection required — Real mode is architecturally ready but no broker is connected.</span>
      )}

      {/* Right side: deposit/withdraw + data status */}
      <div className="ml-auto flex items-center gap-2">
        {/* Deposit / Withdraw */}
        {mode === "paper" && (
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleDeposit}
              title="Deposit from Vault Trading Capital"
              className="focus-ring themed inline-flex h-5 items-center gap-0.5 rounded px-1 text-[9px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <ArrowDownToLine className="h-2.5 w-2.5" /> Deposit
            </button>
            <button
              onClick={handleWithdraw}
              title="Withdraw to Vault Trading Capital"
              className="focus-ring themed inline-flex h-5 items-center gap-0.5 rounded px-1 text-[9px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <ArrowUpFromLine className="h-2.5 w-2.5" /> Withdraw
            </button>
            <button
              onClick={handleReset}
              title="Reset virtual account"
              className="focus-ring themed inline-flex h-5 items-center gap-0.5 rounded px-1 text-[9px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
            >
              <RefreshCw className="h-2.5 w-2.5" /> Reset
            </button>
          </div>
        )}

        {mode === "paper" && <div className="h-3 w-px bg-line-muted" />}

        {/* Data status */}
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
          <span className="text-[10px] text-fg-muted">{dataStatus}</span>
          <span className="text-fg-faint">·</span>
          <span className="text-[10px] text-fg-faint">{mounted ? (cryptoProvider?.label ?? "—") : "…"}</span>
        </div>
      </div>
    </div>
  );
}

// Auto-refresh account state when prices change.
function useAutoRefresh(prices: Map<string, number>, refreshAccount: () => void) {
  useEffect(() => {
    refreshAccount();
  }, [prices, refreshAccount]);
}

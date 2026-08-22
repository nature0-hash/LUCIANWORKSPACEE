"use client";

import { useState, useEffect } from "react";
import { useMarketsStore } from "@/store/markets";
import { useVaultStore } from "@/store/vault";
import { getProvider } from "@/lib/markets/provider";
import {
  resetPaperAccount,
  depositVirtual,
  withdrawVirtual,
  getVirtualBalance,
} from "@/lib/markets/paper-trading";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export function AccountBar() {
  const mode = useMarketsStore((s) => s.mode);
  const setMode = useMarketsStore((s) => s.setMode);
  const account = useMarketsStore((s) => s.account);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);
  const prices = useMarketsStore((s) => s.prices);

  const vaultPools = useVaultStore((s) => s.pools);
  const allocateToPool = useVaultStore((s) => s.allocateToPool);
  const deallocateFromPool = useVaultStore((s) => s.deallocateFromPool);

  useAutoRefresh(prices, refreshAccount);

  const cryptoProvider = getProvider("crypto");
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    let c = false;
    Promise.resolve().then(() => {
      if (!c) setMounted(true);
    });
    return () => {
      c = true;
    };
  }, []);

  const dataStatus = mounted
    ? cryptoProvider?.statusLabel ?? "Disconnected"
    : "Connecting…";
  const dotColor = mounted
    ? cryptoProvider?.status === "live"
      ? "bg-[#00c087]"
      : cryptoProvider?.status === "delayed"
      ? "bg-amber-500"
      : "bg-red-500"
    : "bg-amber-500";

  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const handleDeposit = () => {
    if (mode === "real") {
      toast({
        title: "Broker connection required",
        description: "Real deposits require a connected broker.",
        variant: "destructive",
      });
      return;
    }
    const tradingPool = vaultPools.find((p) => p.id === "trading");
    if (!tradingPool || tradingPool.allocated <= 0) {
      toast({
        title: "No trading capital",
        description: "Allocate capital in Vault → Trading Capital pool first.",
        variant: "destructive",
      });
      return;
    }
    const amount = Math.min(1000, tradingPool.allocated);
    deallocateFromPool("trading", amount);
    depositVirtual(amount);
    refreshAccount();
    toast({
      title: "Deposit complete",
      description: `$${amount.toFixed(2)} deposited from Vault.`,
    });
  };

  const handleWithdraw = () => {
    if (mode === "real") {
      toast({
        title: "Broker connection required",
        description: "Real withdrawals require a connected broker.",
        variant: "destructive",
      });
      return;
    }
    const balance = getVirtualBalance();
    if (balance <= 0) {
      toast({
        title: "Insufficient balance",
        description: "No funds to withdraw.",
        variant: "destructive",
      });
      return;
    }
    const amount = Math.min(1000, balance);
    const ok = withdrawVirtual(amount);
    if (ok) {
      allocateToPool("trading", amount);
      refreshAccount();
      toast({
        title: "Withdrawal complete",
        description: `$${amount.toFixed(2)} withdrawn to Vault.`,
      });
    }
  };

  const handleReset = () => {
    if (mode === "real") return;
    resetPaperAccount();
    refreshAccount();
    toast({
      title: "Virtual account reset",
      description: "Balance restored to $1,000.00.",
    });
  };

  // Metrics matching screenshot order:
  // Margin, Free margin, Margin level, Equity, Floating profit
  const metrics = account
    ? [
        { label: "Margin", value: `$${fmt(account.margin)}` },
        { label: "Free margin", value: `$${fmt(account.freeMargin)}` },
        {
          label: "Margin level",
          value: account.marginLevel > 0 ? `${fmt(account.marginLevel)}%` : "0.00%",
        },
        { label: "Equity", value: `$${fmt(account.equity)}` },
        {
          label: "Floating profit",
          value: `${account.floatingPnl >= 0 ? "+" : ""}$${fmt(account.floatingPnl)}`,
          color:
            account.floatingPnl > 0
              ? "text-[#00c087]"
              : account.floatingPnl < 0
              ? "text-[#ff4757]"
              : undefined,
        },
      ]
    : [];

  return (
    <div className="flex h-10 shrink-0 items-center gap-3 border-b border-[#2d333b] bg-[#16181d] px-3 text-[11px]">
      {/* Left: Virtual / Real toggle */}
      <div className="flex items-center gap-0.5 rounded border border-[#2d333b] bg-[#13161c] p-0.5">
        <button
          onClick={() => setMode("paper")}
          className={cn(
            "rounded px-2.5 py-0.5 text-[10px] font-bold transition-colors",
            mode === "paper"
              ? "bg-[#3b82f6] text-white"
              : "text-[#8b949e] hover:text-white",
          )}
        >
          Virtual
        </button>
        <button
          onClick={() => setMode("real")}
          className={cn(
            "rounded px-2.5 py-0.5 text-[10px] font-bold transition-colors",
            mode === "real"
              ? "bg-[#ff4757] text-white"
              : "text-[#8b949e] hover:text-white",
          )}
        >
          Real
        </button>
      </div>

      <div className="h-4 w-px bg-[#2d333b]" />

      {/* Account metrics */}
      {mode === "paper" ? (
        <div className="flex items-center gap-4 overflow-x-auto">
          {metrics.map((m) => (
            <div key={m.label} className="flex shrink-0 items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-[#565c66]">
                {m.label}
              </span>
              <span
                className={cn(
                  "font-mono tabular-nums font-medium",
                  m.color ?? "text-white",
                )}
              >
                {m.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <span className="text-[10px] text-[#ff4757]">
          Broker connection required
        </span>
      )}

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Deposit button */}
        {mode === "paper" && (
          <button
            onClick={handleDeposit}
            className="rounded bg-[#3b82f6] px-3 py-1 text-[10px] font-bold text-white transition-colors hover:bg-[#2563eb]"
          >
            Deposit
          </button>
        )}

        {/* Withdraw / Reset */}
        {mode === "paper" && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleWithdraw}
              className="text-[9px] text-[#8b949e] hover:text-white"
            >
              Withdraw
            </button>
            <span className="text-[#565c66]">·</span>
            <button
              onClick={handleReset}
              className="text-[9px] text-[#8b949e] hover:text-white"
            >
              Reset
            </button>
          </div>
        )}

        {mode === "paper" && <div className="h-4 w-px bg-[#2d333b]" />}

        {/* Data status */}
        <div className="flex items-center gap-1.5">
          <span className={cn("h-1.5 w-1.5 rounded-full", dotColor)} />
          <span className="text-[10px] text-[#8b949e]">{dataStatus}</span>
          <span className="text-[#565c66]">·</span>
          <span className="text-[10px] text-[#565c66]">
            {mounted ? cryptoProvider?.label ?? "—" : "…"}
          </span>
        </div>
      </div>
    </div>
  );
}

function useAutoRefresh(
  prices: Map<string, number>,
  refreshAccount: () => void,
) {
  useEffect(() => {
    refreshAccount();
  }, [prices, refreshAccount]);
}

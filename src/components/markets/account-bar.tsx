"use client";

import { useState, useEffect } from "react";
import { useMarketsStore } from "@/store/markets";
import { getProvider } from "@/lib/markets/provider";
import { cn } from "@/lib/utils";

export function AccountBar() {
  const mode = useMarketsStore((s) => s.mode);
  const setMode = useMarketsStore((s) => s.setMode);
  const account = useMarketsStore((s) => s.account);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);
  const prices = useMarketsStore((s) => s.prices);
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);

  // Auto-refresh account when prices change.
  useAutoRefresh(prices, refreshAccount);

  // Providers are registered client-side only.
  const cryptoProvider = getProvider("crypto");
  // Use a mounted flag to avoid hydration mismatch — the provider is
  // registered on the client only (window check in provider.ts).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { let c = false; Promise.resolve().then(() => { if (!c) setMounted(true); }); return () => { c = true; }; }, []);
  const dataStatus = mounted ? (cryptoProvider?.statusLabel ?? "Disconnected") : "Connecting…";
  const dotColor = mounted
    ? (cryptoProvider?.status === "live" ? "bg-green-500"
      : cryptoProvider?.status === "delayed" ? "bg-amber-500"
      : cryptoProvider?.status === "setup-required" ? "bg-zinc-500"
      : "bg-red-500")
    : "bg-amber-500";

  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="themed flex h-7 shrink-0 items-center gap-4 border-b border-line-muted bg-surface-2/40 px-3 text-[11px]">
      {/* Mode toggle */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setMode("paper")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors",
            mode === "paper"
              ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
              : "text-fg-faint hover:bg-hover",
          )}
        >
          PAPER
        </button>
        <button
          onClick={() => setMode("real")}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-bold transition-colors",
            mode === "real"
              ? "bg-red-500/20 text-red-500"
              : "text-fg-faint hover:bg-hover",
          )}
        >
          REAL
        </button>
      </div>

      <div className="h-3 w-px bg-line-muted" />

      {/* Account values */}
      {mode === "paper" ? (
        <>
          <Stat label="Balance" value={account ? `$${fmt(account.balance)}` : "—"} />
          <Stat label="Equity" value={account ? `$${fmt(account.equity)}` : "—"} />
          <Stat
            label="Floating P/L"
            value={account ? `${account.floatingPnl >= 0 ? "+" : ""}$${fmt(account.floatingPnl)}` : "—"}
            color={account && account.floatingPnl > 0 ? "text-green-500" : account && account.floatingPnl < 0 ? "text-red-500" : undefined}
          />
          <Stat label="Free Margin" value={account ? `$${fmt(account.freeMargin)}` : "—"} />
        </>
      ) : (
        <span className="text-[10px] text-red-500">Broker connection required</span>
      )}

      <div className="ml-auto flex items-center gap-2">
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[9px] uppercase tracking-wide text-fg-faint">{label}</span>
      <span className={cn("font-mono tabular-nums font-medium", color ?? "text-fg")}>{value}</span>
    </div>
  );
}

// Auto-refresh account state when prices change.
function useAutoRefresh(prices: Map<string, number>, refreshAccount: () => void) {
  useEffect(() => {
    refreshAccount();
  }, [prices, refreshAccount]);
}

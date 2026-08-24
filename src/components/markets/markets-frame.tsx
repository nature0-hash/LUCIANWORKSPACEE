"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  Sun,
  Moon,
} from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { InstrumentsPanel } from "@/components/markets/instruments-panel";
import { OrderDetailsPanel } from "@/components/markets/order-details-panel";
import { ChartWorkspace } from "@/components/markets/chart-workspace";
import { IntelligencePanel } from "@/components/markets/intelligence-panel";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemeId } from "@/lib/themes";
import { useMarketsStore } from "@/store/markets";
import { useVaultStore } from "@/store/vault";
import { toast } from "@/hooks/use-toast";

/* ------------------------------------------------------------------ */
/* Theme-aware tokens                                                  */
/* ------------------------------------------------------------------ */
/* Markets uses the global LUCIAN theme system (data-theme on <html>).
   These tokens map the global CSS variables to local classnames so the
   Markets page re-themes together with the rest of the workspace. */

const SURFACE_RAIL = "themed bg-surface border-r border-line-muted";
const SURFACE_TOP = "themed bg-surface border-b border-line-muted";
const SURFACE_ACCT = "themed bg-surface border-b border-line-muted";
const INACTIVE = "text-fg-faint hover:bg-hover hover:text-fg";
const ACTIVE = "bg-active text-fg";
const RAIL_SEPARATOR = "border-b border-line-muted/60";
const TOPBAR_LABEL = "text-fg-muted";
const TOPBAR_VALUE = "text-fg";
const TOGGLE_BASE = "text-fg-faint hover:bg-hover hover:text-fg themed";

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export function MarketsFrame() {
  const { theme, setTheme } = useTheme();
  const [panelOpen, setPanelOpen] = useState(true);
  const leftPanelMode = useMarketsStore((s) => s.leftPanelMode);
  const setLeftPanelMode = useMarketsStore((s) => s.setLeftPanelMode);
  const setToggleInstrumentsHandler = useMarketsStore(
    (s) => s.setToggleInstrumentsHandler,
  );
  const mode = useMarketsStore((s) => s.mode);
  const setMode = useMarketsStore((s) => s.setMode);
  const account = useMarketsStore((s) => s.account);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);
  const refreshTrading = useMarketsStore((s) => s.refreshTrading);

  // Format currency for account display
  const fmt = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  // Account values from paper-trading engine
  const balance = account?.balance ?? 0;
  const equity = account?.equity ?? 0;
  const margin = account?.margin ?? 0;
  const freeMargin = account?.freeMargin ?? 0;
  const marginLevel = account?.marginLevel ?? 0;
  const floatingPnl = account?.floatingPnl ?? 0;
  const pnlColor = floatingPnl > 0 ? "text-[#089981]" : floatingPnl < 0 ? "text-[#f23645]" : "text-fg";

  // Handle Deposit/Withdraw/Transfer — no real financial provider
  const showProviderRequired = (action: string) => {
    toast({
      title: `${action} — Financial Provider Required`,
      description: "This action requires a connected financial provider. Provider integration is not yet available.",
      variant: "destructive",
    });
  };

  // ChartWorkspace lifts pending-order price up here so OrderDetails can
  // update the chart's pending-order line via this callback.
  const [pendingOrderPrice, setPendingOrderPrice] = useState<number | null>(null);

  const isLight = useMemo(() => {
    return (
      theme === "natural-white" ||
      theme === "creamy-light"
    );
  }, [theme]);

  const toggleTheme = () => {
    const next: ThemeId = isLight ? "midnight-gray" : "natural-white";
    setTheme(next);
  };

  // Register the toggleInstruments handler in the store so the chart
  // toolbar (which lives deep inside ChartWorkspace) can toggle the
  // Instruments panel without prop drilling. Updates on every render
  // so the latest panelOpen is captured.
  useEffect(() => {
    setToggleInstrumentsHandler(() => () => {
      setPanelOpen((v) => !v);
      // Always switch back to "instruments" mode when toggling via the
      // chart toolbar so the user sees the Instruments list, not Order
      // Details, after clicking the symbol.
      setLeftPanelMode("instruments");
    });
    return () => setToggleInstrumentsHandler(undefined);
  }, [setToggleInstrumentsHandler, setLeftPanelMode]);

  // Refresh trading state (positions/pending/closed/account) on mount
  // so the bottom panel + counts reflect any persisted Virtual trades.
  useEffect(() => {
    useMarketsStore.getState().refreshTrading();
  }, []);

  const handleRailInstrumentsClick = () => {
    if (!panelOpen) {
      setPanelOpen(true);
      setLeftPanelMode("instruments");
    } else if (leftPanelMode === "instruments") {
      setPanelOpen(false);
    } else {
      // Panel is open in "order" mode → clicking the rail's Instruments
      // button switches back to instruments mode.
      setLeftPanelMode("instruments");
    }
  };

  return (
    <div className="themed flex h-full min-h-0 overflow-hidden bg-canvas text-fg">
      {/* ── LEFT VERTICAL RAIL (88px) ── */}
      <div
        className={cn(
          "flex w-[88px] shrink-0 flex-col items-center py-3",
          SURFACE_RAIL,
        )}
      >
        {/* LUCIAN logo at top */}
        <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-line-muted bg-surface-2">
          <BrandMark size={24} />
        </div>

        {/* Thin separator under logo */}
        <div className="mb-2 h-px w-12 bg-line-muted/60" />

        {/* Tools: icon → label → separator */}
        <RailBtn
          icon={BarChart3}
          label="Instruments"
          active={panelOpen && leftPanelMode === "instruments"}
          onClick={handleRailInstrumentsClick}
        />
        <RailBtn icon={ArrowDownToLine} label="Deposit" onClick={() => showProviderRequired("Deposit")} />
        <RailBtn icon={ArrowUpFromLine} label="Withdraw" onClick={() => showProviderRequired("Withdraw")} />
        <RailBtn icon={ArrowLeftRight} label="Transfer" onClick={() => showProviderRequired("Transfer")} />
        <RailBtn icon={History} label="Operation History" twoLine onClick={() => {
          refreshTrading();
          toast({ title: "Trading history refreshed", description: `${useMarketsStore.getState().positions.length} open, ${useMarketsStore.getState().closedPositions.length} closed` });
        }} />

        {/* Spacer pushes the toggle to the bottom */}
        <div className="flex-1" />

        {/* Light / Dark toggle — uses the real LUCIAN theme system */}
        <button
          type="button"
          title={isLight ? "Switch to Dark" : "Switch to Light"}
          aria-label={isLight ? "Switch to Dark" : "Switch to Light"}
          onClick={toggleTheme}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
            TOGGLE_BASE,
          )}
        >
          {isLight ? (
            <Moon className="h-[18px] w-[18px]" />
          ) : (
            <Sun className="h-[18px] w-[18px]" />
          )}
        </button>
      </div>

      {/* ── LEFT CONTEXTUAL PANEL (260px) ── conditional on panelOpen */}
      {panelOpen && (
        <aside
          className={cn(
            "themed w-[260px] shrink-0 border-r border-line-muted bg-surface",
          )}
        >
          {leftPanelMode === "instruments" ? (
            <InstrumentsPanel
              onClose={() => setPanelOpen(false)}
              onSelect={(symbol) => {
                useMarketsStore.getState().selectSymbol(symbol);
              }}
            />
          ) : (
            <OrderDetailsPanel
              onClose={() => setLeftPanelMode("instruments")}
              onPendingPriceChange={setPendingOrderPrice}
            />
          )}
        </aside>
      )}

      {/* ── RIGHT SIDE: strips + chart workspace ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* ── THIN TOP STRIP (32px) ── */}
        <div
          className={cn(
            "flex h-8 shrink-0 items-center px-4",
            SURFACE_TOP,
          )}
        >
          <span className="animate-pulse text-[11px] font-semibold tracking-wide text-[var(--accent)]">
            LUCIAN Markets
          </span>
        </div>

        {/* ── ACCOUNT METRICS STRIP (48px) ── */}
        <div
          className={cn(
            "flex h-12 shrink-0 items-center px-4",
            SURFACE_ACCT,
          )}
        >
          {/* LUCIAN brand wordmark at far left — large empty area after it */}
          <span className="mr-2 text-[13px] font-bold text-fg">LUCIAN</span>

          {/* Push account-information group toward the right, near Deposit */}
          <div className="ml-auto flex items-center gap-4">
            {/* Account metrics from paper-trading engine */}
            <Metric label="Margin" value={fmt(margin)} />
            <Metric label="Free margin" value={fmt(freeMargin)} />
            <Metric label="Margin level" value={marginLevel > 0 ? `${marginLevel.toFixed(2)}%` : "0.00%"} />
            <Metric label="Equity" value={fmt(equity)} />
            <Metric label="Floating profit" value={fmt(floatingPnl)} />

            {/* Separator between numeric metrics and Virtual/Real */}
            <div className="h-5 w-px bg-line-muted" />

            {/* Virtual — shows paper balance */}
            <AccountPill label="Virtual" value={fmt(balance)} accent="green" />

            {/* Real — not connected */}
            <AccountPill label="Real" value="Not connected" accent="blue" />

            {/* Deposit button — far right */}
            <button
              type="button"
              onClick={() => showProviderRequired("Deposit")}
              className="rounded-[6px] bg-[var(--accent)] px-5 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] themed"
            >
              Deposit
            </button>
          </div>
        </div>

        {/* Center + right: chart workspace and Intelligence panel share
            the remaining width as flex siblings so the chart resizes
            when the Intelligence panel expands/collapses. */}
        <div className="flex min-h-0 min-w-0 flex-1">
          {/* Center trading workspace (chart + drawing rail + bottom panel) */}
          <ChartWorkspace pendingOrderPriceOverride={pendingOrderPrice} />

          {/* Right Markets intelligence area (Chat + Feed) */}
          <IntelligencePanel />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function RailBtn({
  icon: Icon,
  label,
  active = false,
  twoLine = false,
  onClick,
}: {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
  twoLine?: boolean;
  onClick?: () => void;
}) {
  const parts = twoLine ? splitTwoLine(label) : [label];
  return (
    <div className="mb-2.5 flex w-full flex-col items-center">
      <button
        type="button"
        title={label}
        onClick={onClick}
        className={cn(
          "flex h-9 w-12 flex-col items-center justify-center rounded-md transition-colors themed",
          active ? ACTIVE : INACTIVE,
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
        <span className="mt-0.5 text-[9px] font-medium leading-tight tracking-tight">
          {parts.map((p, i) => (
            <span key={i} className="block text-center">
              {p}
            </span>
          ))}
        </span>
      </button>
      {/* Thin horizontal separator under each tool item */}
      <div className={cn("mt-2 h-px w-10", RAIL_SEPARATOR)} />
    </div>
  );
}

function splitTwoLine(label: string): string[] {
  /* Breaks a two-word label like "Operation History" into two lines:
     "Operation" / "History" */
  const idx = label.lastIndexOf(" ");
  if (idx < 0) return [label];
  return [label.slice(0, idx), label.slice(idx + 1)];
}

function Metric({ label, value }: { label: string; value: string }) {
  /* Vertical label-on-top / value-under layout (same pattern as
     Virtual/Real) but WITHOUT the colored dot accent — just clean
     label-over-value. */
  return (
    <div className="flex shrink-0 flex-col items-start leading-tight">
      <span className={cn("text-[10px] font-medium", TOPBAR_LABEL)}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-[12px] tabular-nums font-medium",
          TOPBAR_VALUE,
        )}
      >
        {value}
      </span>
    </div>
  );
}

function AccountPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "green" | "blue";
}) {
  /* Single, vertical label-over-value display.
     Green accent = Virtual, Blue accent = Real.
     The accent shows as a small colored dot to the left of the label,
     keeping the typography clean and consistent. */
  const dot =
    accent === "green" ? "bg-[#10b981]" : "bg-[#3b82f6]";
  return (
    <div className="flex shrink-0 flex-col items-start leading-tight">
      <div className="flex items-center gap-1.5">
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />
        <span className={cn("text-[10px] font-medium", TOPBAR_LABEL)}>
          {label}
        </span>
      </div>
      <span
        className={cn(
          "ml-3 font-mono text-[12px] tabular-nums font-medium",
          TOPBAR_VALUE,
        )}
      >
        {value}
      </span>
    </div>
  );
}

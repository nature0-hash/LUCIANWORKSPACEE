"use client";

import { useMemo } from "react";
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
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { ThemeId } from "@/lib/themes";

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

  const isLight = useMemo(() => {
    return (
      theme === "natural-white" ||
      theme === "creamy-light"
    );
  }, [theme]);

  const toggleTheme = () => {
    /* Toggle between the default dark theme and the default light theme.
       This keeps Markets consistent with the rest of LUCIAN — the same
       data-theme attribute that drives the workspace chrome also drives
       Markets. */
    const next: ThemeId = isLight ? "midnight-gray" : "natural-white";
    setTheme(next);
  };

  return (
    <div className="themed flex h-full bg-canvas text-fg">
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
        <RailBtn icon={BarChart3} label="Instruments" active />
        <RailBtn icon={ArrowDownToLine} label="Deposit" />
        <RailBtn icon={ArrowUpFromLine} label="Withdraw" />
        <RailBtn icon={ArrowLeftRight} label="Transfer" />
        <RailBtn icon={History} label="Operation History" twoLine />

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

      {/* ── INSTRUMENTS PANEL (260px) ── */}
      <aside
        className={cn(
          "themed w-[260px] shrink-0 border-r border-line-muted bg-surface",
        )}
      >
        <InstrumentsPanel />
      </aside>

      {/* ── RIGHT SIDE: strips + blank ── */}
      <div className="flex min-w-0 flex-1 flex-col">
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
            {/* ── Account metrics in screenshot order ── */}
            <Metric label="Margin" value="$0.00" />
            <Metric label="Free margin" value="$0.00" />
            <Metric label="Margin level" value="0.00%" />
            <Metric label="Equity" value="$0.00" />
            <Metric label="Floating profit" value="$0.00" />

            {/* Separator between numeric metrics and Virtual/Real */}
            <div className="h-5 w-px bg-line-muted" />

            {/* Virtual — single, label-over-value, green accent */}
            <AccountPill label="Virtual" value="$0.00" accent="green" />

            {/* Real — single, label-over-value, blue accent */}
            <AccountPill label="Real" value="$0.00" accent="blue" />

            {/* Deposit button — far right, stays where it is */}
            <button
              type="button"
              className="rounded-[6px] bg-[var(--accent)] px-5 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)] shadow-sm transition-colors hover:bg-[var(--accent-hover)] themed"
            >
              Deposit
            </button>
          </div>
        </div>

        {/* Blank markets area */}
        <div className="min-h-0 flex-1 bg-canvas themed" />
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
}: {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
  twoLine?: boolean;
}) {
  const parts = twoLine ? splitTwoLine(label) : [label];
  return (
    <div className="mb-2.5 flex w-full flex-col items-center">
      <button
        type="button"
        title={label}
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

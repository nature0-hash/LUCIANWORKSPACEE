"use client";

import { useState } from "react";
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
import { cn } from "@/lib/utils";

export function MarketsFrame() {
  const [dark, setDark] = useState(true);

  return (
    <div className="flex h-full bg-[#13161c] text-white">
      {/* ── LEFT VERTICAL RAIL (54px) ── */}
      <div className="flex w-[54px] shrink-0 flex-col items-center border-r border-[#2b2b3d] bg-[#1e1e2d] py-3">
        {/* LUCIAN logo at top (replaces PO circle) */}
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full border border-[#3a3a4f] bg-[#252535]">
          <BrandMark size={22} />
        </div>

        {/* Instruments (active) */}
        <RailBtn icon={BarChart3} label="Instruments" active />

        {/* Deposit */}
        <RailBtn icon={ArrowDownToLine} label="Deposit" />

        {/* Withdraw */}
        <RailBtn icon={ArrowUpFromLine} label="Withdraw" />

        {/* Transfer */}
        <RailBtn icon={ArrowLeftRight} label="Transfer" />

        {/* Operation History */}
        <RailBtn icon={History} label="Operation History" />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Light / Dark toggle at very bottom */}
        <button
          title={dark ? "Switch to Light" : "Switch to Dark"}
          onClick={() => setDark((d) => !d)}
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] transition-colors hover:bg-[#252535] hover:text-white"
        >
          {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
      </div>

      {/* ── RIGHT SIDE: strips + blank ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ── THIN TOP STRIP (32px) ── */}
        <div className="flex h-8 shrink-0 items-center border-b border-[#2a2a3c] bg-[#161622] px-4">
          <span className="animate-pulse text-[11px] font-semibold tracking-wide text-[#3b82f6]">
            LUCIAN Markets
          </span>
        </div>

        {/* ── ACCOUNT METRICS STRIP (48px) ── */}
        <div className="flex h-12 shrink-0 items-center gap-5 border-b border-[#2a2a3c] bg-[#161622] px-4">
          {/* LUCIAN Markets logo text at far left */}
          <span className="mr-2 text-[13px] font-bold text-white">LUCIAN</span>

          {/* Metrics — exact screenshot order */}
          <Metric label="Margin" value="$0.00" />
          <Metric label="Free margin" value="$0.00" />
          <Metric label="Margin level" value="0.00%" />
          <Metric label="Equity" value="$0.00" />

          {/* Separator */}
          <div className="h-5 w-px bg-[#333]" />

          {/* Virtual (green accent) — replaces Bonuses */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8b8ba3]">Virtual</span>
            <span className="font-mono text-[12px] tabular-nums text-white">$0.00</span>
            <span className="rounded bg-[#10b981] px-2 py-0.5 text-[9px] font-bold text-white">
              Virtual
            </span>
          </div>

          {/* Floating profit */}
          <Metric label="Floating profit" value="$0.00" />

          {/* Real (blue accent) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[#8b8ba3]">Real</span>
            <span className="font-mono text-[12px] tabular-nums text-white">$0.00</span>
            <span className="rounded bg-[#2563eb] px-2 py-0.5 text-[9px] font-bold text-white">
              Real
            </span>
          </div>

          {/* Deposit button — far right */}
          <button
            className="ml-auto rounded-[6px] bg-[#2563eb] px-6 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#3b82f6]"
          >
            Deposit
          </button>
        </div>

        {/* Blank markets area */}
        <div className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function RailBtn({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      title={label}
      className={cn(
        "mb-1 flex h-9 w-9 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-[#252535] text-white"
          : "text-[#6b7280] hover:bg-[#252535] hover:text-white",
      )}
    >
      <Icon className="h-[18px] w-[18px]" />
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-[#8b8ba3]">{label}</span>
      <span className="font-mono text-[12px] tabular-nums text-white">{value}</span>
    </div>
  );
}

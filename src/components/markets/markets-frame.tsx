"use client";

import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  CalendarDays,
  Gift,
  MessageCircle,
  Settings,
} from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { cn } from "@/lib/utils";

type RailIcon = {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
  isLogo?: boolean;
};

const RAIL_ICONS: RailIcon[] = [
  { icon: BarChart3, label: "LUCIAN", isLogo: true },
  { icon: BarChart3, label: "Instruments", active: true },
  { icon: ArrowDownToLine, label: "Deposit" },
  { icon: ArrowUpFromLine, label: "Withdraw" },
  { icon: ArrowLeftRight, label: "Transfer" },
  { icon: History, label: "Operation History" },
  { icon: CalendarDays, label: "Economic Calendar" },
  { icon: Gift, label: "Rewards" },
];

const METRICS = [
  { label: "Margin", value: "$0.00" },
  { label: "Free margin", value: "$0.00" },
  { label: "Margin level", value: "0.00%" },
  { label: "Equity", value: "$0.00" },
];

export function MarketsFrame() {
  return (
    <div className="flex h-full bg-[#13161c]">
      {/* Left vertical tool rail (~52px) */}
      <div className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-[#1f2329] bg-[#0f0f0f] py-2">
        {RAIL_ICONS.map((item, i) => {
          if (item.isLogo) {
            return (
              <div key={i} className="mb-1 flex h-8 w-8 items-center justify-center">
                <BrandMark size={26} />
              </div>
            );
          }
          return (
            <button
              key={i}
              title={item.label}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                item.active
                  ? "bg-[#1f2329] text-white"
                  : "text-[#6b7280] hover:bg-[#1f2329] hover:text-white",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
            </button>
          );
        })}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Bottom icons */}
        <button
          title="Support"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#1f2329] hover:text-white"
        >
          <MessageCircle className="h-[18px] w-[18px]" />
        </button>
        <button
          title="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-md text-[#6b7280] hover:bg-[#1f2329] hover:text-white"
        >
          <Settings className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Right side: top strips + blank area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Thin top strip */}
        <div className="flex h-8 shrink-0 items-center border-b border-[#1f2329] bg-[#16181d] px-3">
          <span className="text-[10px] font-medium text-[#9ca3af]">
            LUCIAN Markets
          </span>
        </div>

        {/* Account metrics strip */}
        <div className="flex h-11 shrink-0 items-center gap-5 border-b border-[#1f2329] bg-[#1a1d23] px-4">
          {/* Metrics */}
          {METRICS.map((m) => (
            <div key={m.label} className="flex items-center gap-1.5">
              <span className="text-[9px] uppercase tracking-wide text-[#6b7280]">
                {m.label}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-white">
                {m.value}
              </span>
            </div>
          ))}

          {/* Separator */}
          <div className="h-5 w-px bg-[#333333]" />

          {/* Virtual indicator (green) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wide text-[#6b7280]">
              Virtual
            </span>
            <span className="font-mono text-[12px] tabular-nums text-white">
              $0.00
            </span>
            <span className="rounded bg-[#10b981] px-1.5 py-0.5 text-[9px] font-bold text-white">
              Virtual
            </span>
          </div>

          {/* Floating profit */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wide text-[#6b7280]">
              Floating profit
            </span>
            <span className="font-mono text-[12px] tabular-nums text-white">
              $0.00
            </span>
          </div>

          {/* Real indicator (blue) */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] uppercase tracking-wide text-[#6b7280]">
              Real
            </span>
            <span className="font-mono text-[12px] tabular-nums text-white">
              $0.00
            </span>
            <span className="rounded bg-[#2563eb] px-1.5 py-0.5 text-[9px] font-bold text-white">
              Real
            </span>
          </div>

          {/* Deposit button (far right) */}
          <button className="ml-auto rounded bg-[#3b82f6] px-4 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#2563eb]">
            Deposit
          </button>
        </div>

        {/* Blank markets area */}
        <div className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

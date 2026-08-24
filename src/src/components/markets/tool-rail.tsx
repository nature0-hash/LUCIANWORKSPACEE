"use client";

import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  CalendarDays,
  CircleUser,
  MessageCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_ICONS = [
  { icon: CircleUser, label: "Profile" },
  { icon: BarChart3, label: "Instruments", active: true },
  { icon: ArrowDownToLine, label: "Deposit" },
  { icon: ArrowUpFromLine, label: "Withdraw" },
  { icon: ArrowLeftRight, label: "Transfer" },
  { icon: History, label: "History" },
  { icon: CalendarDays, label: "Calendar" },
];

export function ToolRail() {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[#2d333b] bg-[#1a1d23] py-2">
      {RAIL_ICONS.map((item, i) => (
        <button
          key={i}
          title={item.label}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
            item.active
              ? "bg-[#3b82f6]/20 text-white"
              : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
          )}
        >
          <item.icon className="h-4 w-4" />
        </button>
      ))}
      {/* Spacer */}
      <div className="flex-1" />
      {/* Bottom icons */}
      <button
        title="Support"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#8b949e] hover:bg-[#22262f] hover:text-white"
      >
        <MessageCircle className="h-4 w-4" />
      </button>
      <button
        title="Settings"
        className="flex h-8 w-8 items-center justify-center rounded-md text-[#8b949e] hover:bg-[#22262f] hover:text-white"
      >
        <Settings className="h-4 w-4" />
      </button>
    </div>
  );
}

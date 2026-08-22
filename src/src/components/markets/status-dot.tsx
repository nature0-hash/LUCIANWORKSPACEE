"use client";

// Colored status indicator dot.
//
// Uses LUCIAN's color tokens but with hard-coded semantic colors for
// trading-state dots (green=live, amber=delayed, red=disconnected,
// gray=setup-required).

import { cn } from "@/lib/utils";
import type { DataStatus } from "@/lib/markets/types";

export const STATUS_DOT_COLORS: Record<DataStatus, string> = {
  live: "bg-emerald-400",
  delayed: "bg-amber-400",
  disconnected: "bg-rose-400",
  "setup-required": "bg-zinc-500",
};

export const STATUS_DOT_LABELS: Record<DataStatus, string> = {
  live: "Live",
  delayed: "Delayed",
  disconnected: "Disconnected",
  "setup-required": "Setup Required",
};

interface StatusDotProps {
  status: DataStatus;
  /** Show a soft pulsing ring (only for live data). */
  pulse?: boolean;
  className?: string;
}

export function StatusDot({ status, pulse = true, className }: StatusDotProps) {
  return (
    <span className={cn("relative inline-flex size-2 shrink-0", className)}>
      {status === "live" && pulse && (
        <span
          className={cn(
            "absolute inline-flex size-full animate-ping rounded-full opacity-60",
            STATUS_DOT_COLORS[status],
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex size-2 rounded-full",
          STATUS_DOT_COLORS[status],
        )}
      />
    </span>
  );
}

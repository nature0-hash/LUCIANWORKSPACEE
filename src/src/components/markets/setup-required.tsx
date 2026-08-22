"use client";

// "Setup Required" empty-state card.
//
// Used by the center chart panel (and the intelligence panel) when the
// selected asset class doesn't have a configured data provider. The
// terminal is honest: instead of pretending to show data, it explains
// why the data isn't available.

import { Cable, AlertCircle } from "lucide-react";
import { StatusDot } from "./status-dot";

interface SetupRequiredProps {
  /** Headline (e.g. "Forex data is not available"). */
  title: string;
  /** The honest explanation of why the data isn't available. */
  reason: string;
  /** Optional secondary hint (what to do next). */
  hint?: string;
  /** Asset class label (e.g. "Forex"). */
  assetLabel?: string;
}

export function SetupRequired({
  title,
  reason,
  hint,
  assetLabel,
}: SetupRequiredProps) {
  return (
    <div className="themed flex h-full w-full items-center justify-center bg-canvas p-8">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-surface-2">
          <Cable className="size-6 text-fg-faint" />
        </div>

        <div className="flex items-center gap-2">
          <StatusDot status="setup-required" pulse={false} />
          <span className="text-xs font-medium uppercase tracking-wider text-fg-faint">
            {assetLabel ? `${assetLabel} — Setup Required` : "Setup Required"}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-fg">{title}</h3>

        <p className="text-sm leading-relaxed text-fg-muted">{reason}</p>

        {hint ? (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-line bg-inset px-3 py-2 text-left">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
            <p className="text-xs leading-relaxed text-fg-muted">{hint}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

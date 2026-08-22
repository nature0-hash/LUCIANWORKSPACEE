// LUCIAN Market Terminal — formatting helpers.
//
// All financial numbers in the terminal use tabular figures so digits
// line up in tables. Callers should also add the `tabular-nums` Tailwind
// utility class on the element for visual alignment.

/** Format a price with the right number of decimals. */
export function formatPrice(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

/** Pick a sensible precision for a given price magnitude. */
export function pricePrecisionFor(value: number): number {
  if (!Number.isFinite(value)) return 2;
  const abs = Math.abs(value);
  if (abs >= 1000) return 2;
  if (abs >= 1) return 2;
  if (abs >= 0.01) return 4;
  return 6;
}

/** Format a USD quantity (e.g. balance, equity, P/L). */
export function formatUsd(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/** Format a signed USD value with explicit + / - sign. */
export function formatSignedUsd(value: number, precision = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString("en-US", {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}`;
}

/** Format a percentage, optionally signed. */
export function formatPercent(value: number, signed = false): string {
  if (!Number.isFinite(value)) return "—";
  const sign = signed ? (value > 0 ? "+" : value < 0 ? "-" : "") : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Format a base-asset quantity (e.g. BTC). */
export function formatQty(value: number, precision = 6): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  });
}

/** Format a large volume compactly (e.g. 1.2M). */
export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format a timestamp (ms) as a short local time. */
export function formatTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Format a timestamp (ms) as a short date+time. */
export function formatDateTime(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Class helper: green for positive, red for negative. */
export function pnlColorClass(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "text-fg-muted";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

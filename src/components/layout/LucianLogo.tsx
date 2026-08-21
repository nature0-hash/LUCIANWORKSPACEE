"use client";

interface LucianLogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
}

/**
 * Compact emblem using the official LUCIAN WORKSPACE icon.
 * The gold/emerald branding remains fixed and does NOT adapt to accent color.
 */
export function LucianEmblem({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      style={{ width: size, height: size }}
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface shadow-sm ${className}`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/lucian-workspace-icon.png"
        alt=""
        width={size}
        height={size}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  );
}

export function LucianWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LucianEmblem size={32} />
      <span className="flex flex-col leading-none">
        <span className="text-sm font-semibold tracking-wide text-fg">Lucian</span>
        <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-faint">Workspace</span>
      </span>
    </span>
  );
}

"use client";

import { useId } from "react";

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

/**
 * Minimal CSS-only tooltip that appears on hover/focus.
 * Used for the collapsed rail where labels are hidden.
 */
export function Tooltip({ label, children }: TooltipProps) {
  const id = useId();
  return (
    <span className="group relative inline-flex">
      <span aria-describedby={id}>{children}</span>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-line bg-overlay px-2 py-1 text-xs font-medium text-fg shadow-pop group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

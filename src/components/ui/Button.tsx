"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-active border border-transparent shadow-sm",
  secondary:
    "bg-surface-2 text-fg border border-line hover:bg-hover hover:text-fg active:bg-active",
  ghost:
    "bg-transparent text-fg-muted border border-transparent hover:bg-hover hover:text-fg active:bg-active",
  outline:
    "bg-surface text-fg-muted border border-line hover:bg-hover hover:text-fg active:bg-active",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-7 px-2.5 text-[13px] gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
};

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`focus-ring themed inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

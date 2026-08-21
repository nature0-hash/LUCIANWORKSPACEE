"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { Tooltip } from "@/components/ui/Tooltip";

export interface NavItem {
  /** Stable key */
  id: string;
  /** Route path (use Next.js path conventions, e.g. "/" or "/projects") */
  href: string;
  /** Visible label (also used for tooltip in collapsed state) */
  label: string;
  /** lucide-react icon component */
  icon: ComponentType<{ size?: number | string; className?: string }>;
}

interface NavListProps {
  items: NavItem[];
  /** When true, render as an icon-only rail (labels + tooltips on hover) */
  collapsed?: boolean;
  /** Optional heading shown above the list (hidden when collapsed) */
  heading?: string;
  /** Called after a navigation item is clicked (e.g. to close mobile drawer) */
  onNavigate?: () => void;
}

/**
 * Reusable vertical navigation list used by both the expanded sidebar and
 * the collapsed desktop rail. Active state is derived from the current
 * pathname (exact match for "/", startsWith for nested routes).
 */
export function NavList({
  items,
  collapsed = false,
  heading,
  onNavigate,
}: NavListProps) {
  const pathname = usePathname();

  return (
    <div className={collapsed ? "flex flex-col items-stretch gap-1" : "space-y-0.5"}>
      {heading && !collapsed ? (
        <div className="px-2.5 pb-1.5 pt-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
            {heading}
          </span>
        </div>
      ) : null}

      {items.map(({ id, href, label, icon: Icon }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);

        const link = (
          <Link
            key={id}
            href={href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={`focus-ring themed relative flex items-center rounded-md transition-colors ${
              collapsed
                ? "h-9 w-9 mx-auto justify-center"
                : "gap-2.5 px-2.5 py-1.5"
            } ${
              active
                ? "bg-active font-medium text-fg"
                : "text-fg-muted hover:bg-hover hover:text-fg"
            }`}
          >
            {active && !collapsed ? (
              <span className="absolute -left-3 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r bg-accent" />
            ) : null}
            <Icon
              size={collapsed ? 18 : 15}
              className={active ? "text-accent" : "text-fg-faint"}
            />
            {!collapsed ? <span className="text-sm">{label}</span> : null}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={id} label={label} side="right">
              {link}
            </Tooltip>
          );
        }
        return link;
      })}
    </div>
  );
}

interface NavListRailSpacerProps {
  children?: ReactNode;
}

/** Tiny helper so the rail can have section breaks without re-styling. */
export function NavListRailSpacer({ children }: NavListRailSpacerProps) {
  return <div className="my-2 h-px bg-line-muted">{children}</div>;
}

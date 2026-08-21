"use client";

import { useEffect } from "react";
import { Code2, Home, X } from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { IconButton } from "@/components/ui/IconButton";
import {
  NavList,
  type NavItem,
} from "@/components/ui/NavList";
import { useSidebar } from "@/components/layout/SidebarContext";

/**
 * Sidebar navigation items.
 *
 * Phase 4 introduces DevWorkspace — the in-browser IDE with Project
 * Library, Workspace (file explorer + Monaco editor + live preview), and
 * Code Converter.
 */
const NAV_ITEMS: NavItem[] = [
  { id: "home", href: "/", label: "Home", icon: Home },
  { id: "dev-workspace", href: "/dev-workspace", label: "DevWorkspace", icon: Code2 },
];

/**
 * Expanded sidebar — full labels, full nav, brand header.
 * Rendered inside the desktop <aside> when `collapsed === false`.
 */
export function Sidebar() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Brand header */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line-muted px-4">
        <BrandMark size={28} />
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-semibold text-fg">
            Lucian
          </span>
          <span className="truncate text-[11px] uppercase tracking-wide text-fg-faint">
            Workspace
          </span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <NavList items={NAV_ITEMS} heading="Workspace" />
      </nav>

      {/* Footer */}
      <div className="themed border-t border-line-muted px-4 py-3">
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Lucian Workspace · Phase 2
        </p>
      </div>
    </div>
  );
}

/**
 * Collapsed sidebar — icon-only rail with tooltips.
 * Rendered inside the desktop <aside> when `collapsed === true`.
 */
export function SidebarCollapsedRail() {
  return (
    <div className="flex h-full flex-col items-stretch overflow-hidden">
      {/* Brand header (just the mark) */}
      <div className="flex h-14 shrink-0 items-center justify-center border-b border-line-muted">
        <BrandMark size={26} />
      </div>

      {/* Navigation rail */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
        <NavList items={NAV_ITEMS} collapsed />
      </nav>

      {/* Footer */}
      <div className="themed border-t border-line-muted px-2 py-3 text-center">
        <span className="text-[10px] uppercase tracking-wide text-fg-faint">
          v2
        </span>
      </div>
    </div>
  );
}

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-over drawer for mobile / tablet.
 *
 * Behavior:
 * - Slides in from the left
 * - Has a backdrop that closes the drawer when clicked
 * - Escape key closes the drawer
 * - Selecting a nav item closes the drawer
 * - Body scroll is locked while open
 * - Restores body scroll on close
 */
export function SidebarDrawer({ open, onClose }: SidebarDrawerProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${
        open ? "" : "pointer-events-none"
      }`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Navigation"
        className={`themed absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Drawer header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-muted px-4">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="text-sm font-semibold text-fg">Lucian</span>
          </div>
          <IconButton label="Close navigation" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        {/* Drawer nav */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <NavList
            items={NAV_ITEMS}
            heading="Workspace"
            onNavigate={onClose}
          />
        </div>

        {/* Drawer footer */}
        <div className="themed border-t border-line-muted px-4 py-3">
          <p className="text-[11px] leading-relaxed text-fg-faint">
            Lucian Workspace · Phase 2
          </p>
        </div>
      </div>
    </div>
  );
}

// Allow the drawer to also self-close via the sidebar context (used by TopNav
// toggle when the drawer is the active sidebar UI). Re-export the hook here
// for convenience.
export { useSidebar } from "@/components/layout/SidebarContext";

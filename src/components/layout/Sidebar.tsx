"use client";

import { useEffect } from "react";
import {
  Compass,
  FolderKanban,
  Home,
  LayoutGrid,
  ListFilter,
  Radio,
  Star,
  X,
} from "lucide-react";
import { Sparkles } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

const NAV_ITEMS = [
  { icon: Home, label: "Home", active: true },
  { icon: FolderKanban, label: "Projects" },
  { icon: Radio, label: "Activity" },
  { icon: Compass, label: "Explore" },
  { icon: Star, label: "Stars" },
  { icon: LayoutGrid, label: "Workspaces" },
] as const;

const PINNED = [
  { dot: "#2f81f7", name: "core / platform-shell" },
  { dot: "#23a55f", name: "core / design-tokens" },
  { dot: "#ec7211", name: "labs / theme-engine" },
  { dot: "#8957e5", name: "labs / composer-ui" },
  { dot: "#d1242f", name: "infra / edge-router" },
  { dot: "#e0559f", name: "docs / handbook" },
] as const;

/**
 * Sidebar content — reused by the fixed desktop rail and the mobile drawer.
 */
export function Sidebar() {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Heading area */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
          Workspace
        </span>
      </div>

      {/* Filter input */}
      <div className="px-3 pb-3">
        <div className="relative">
          <ListFilter
            size={13}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            placeholder="Filter items…"
            className="focus-ring themed h-7.5 w-full rounded-md border border-line bg-inset py-1.5 pl-8 pr-2.5 text-[13px] text-fg placeholder:text-fg-faint"
          />
        </div>
      </div>

      {/* Scrollable nav */}
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map(({ icon: Icon, label, ...item }) => {
            const active = "active" in item && item.active;
            return (
              <li key={label}>
                <a
                  href="#"
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring themed relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-active font-medium text-fg"
                      : "text-fg-muted hover:bg-hover hover:text-fg"
                  }`}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-5 w-0.75 -translate-y-1/2 rounded-r bg-accent" />
                  )}
                  <Icon
                    size={15}
                    className={active ? "text-accent" : "text-fg-faint"}
                  />
                  {label}
                </a>
              </li>
            );
          })}
        </ul>

        <div className="mt-5 mb-1.5 flex items-center justify-between px-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
            Pinned
          </span>
          <span className="rounded-full border border-line px-1.5 text-[10px] leading-4 text-fg-faint">
            {PINNED.length}
          </span>
        </div>

        <ul className="space-y-0.5">
          {PINNED.map((item) => (
            <li key={item.name}>
              <a
                href="#"
                className="focus-ring themed group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full opacity-80"
                  style={{ backgroundColor: item.dot }}
                />
                <span className="truncate">{item.name}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="themed border-t border-line-muted px-4 py-3">
        <p className="text-[11px] leading-relaxed text-fg-faint">
          Lucid Shell v1.0 — modular workspace foundation.
        </p>
      </div>
    </div>
  );
}

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Slide-in drawer for tablet / mobile, opened from the top-nav hamburger.
 */
export function SidebarDrawer({ open, onClose }: SidebarDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}
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
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-muted px-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
              <Sparkles size={14} strokeWidth={2.25} />
            </span>
            <span className="text-sm font-semibold text-fg">Lucid</span>
          </div>
          <IconButton label="Close navigation" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1">
          <Sidebar />
        </div>
      </div>
    </div>
  );
}

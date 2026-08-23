"use client";

import { useCallback, useState, type ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  Sidebar,
  SidebarCollapsedRail,
  SidebarDrawer,
} from "@/components/layout/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { LilithLayer } from "@/components/lilith/lilith-layer";
import {
  SidebarProvider,
  useSidebar,
} from "@/components/layout/SidebarContext";

/**
 * AppShell is the single global chrome of the application:
 *
 *   ┌───────────────────────────────────────────────────┐
 *   │ TopNav                                            │
 *   ├──────┬────────────────────────────────────────────┤
 *   │ Side │                                            │
 *   │ bar  │  Main content (children)                  │
 *   │      │                                            │
 *   └──────┴────────────────────────────────────────────┘
 *
 * Pages are rendered into the <main> via {children}. The shell itself
 * never unmounts during in-app navigation, so theme state, sidebar state
 * and settings state all persist across route changes.
 *
 * The desktop sidebar collapses to an icon rail (controlled by the
 * SidebarProvider state); on mobile the same hamburger opens a slide-over
 * drawer instead.
 */

const COLLAPSED_RAIL_WIDTH = 64; // px (w-16)
const EXPANDED_SIDEBAR_WIDTH = 288; // px (w-72)

function AppShellInner({ children }: { children: ReactNode }) {
  const { collapsed, mobileOpen, setMobileOpen } = useSidebar();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <div className="themed flex h-dvh flex-col overflow-hidden bg-canvas text-fg">
      <TopNav onOpenSettings={openSettings} />

      <div className="relative flex min-h-0 flex-1">
        {/* Desktop sidebar — collapses to an icon rail when `collapsed` is true */}
        <aside
          className="themed hidden shrink-0 border-r border-line-muted bg-surface-2/60 lg:block"
          style={{
            width: collapsed ? COLLAPSED_RAIL_WIDTH : EXPANDED_SIDEBAR_WIDTH,
            transition: "width 0.2s ease",
          }}
        >
          {collapsed ? <SidebarCollapsedRail /> : <Sidebar />}
        </aside>

        {/* Mobile / tablet drawer */}
        <SidebarDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Main content */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={closeSettings} />

      {/* Lilith — global floating AI assistant layer.
          Persists across all route changes because she's a sibling
          of {children}, not a child of any routed page. */}
      <LilithLayer />
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppShellInner>{children}</AppShellInner>
    </SidebarProvider>
  );
}

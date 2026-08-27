"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { TopNav } from "@/components/layout/TopNav";
import {
  Sidebar,
  SidebarCollapsedRail,
  SidebarDrawer,
} from "@/components/layout/Sidebar";
import { OfflineIndicator } from "@/components/layout/OfflineIndicator";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { LilithLayer } from "@/components/lilith/lilith-layer";
import { SidebarProvider, useSidebar } from "@/components/layout/SidebarContext";
import { GlobalSearchOverlay } from "@/components/search/global-search-overlay";
import { NotificationProducers } from "@/lib/notification-producers";
import { registerSharedAgentProvider } from "@/lib/agent/shared-provider";
import { primeNotificationSound } from "@/lib/notification-sound";

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

  // Phase 11: register the shared AI provider for the Project Agent once
  // at shell mount. Safe to call multiple times — it just replaces the
  // current provider (which was noopProvider before this effect ran).
  useEffect(() => {
    registerSharedAgentProvider();
  }, []);

  // Prime the notification sound AudioContext on the first user gesture.
  // Browsers require a user-initiated action before audio can play; we
  // attach one-time listeners so the context is ready when the first
  // notification arrives. Safe to call multiple times.
  useEffect(() => {
    primeNotificationSound();
  }, []);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <div className="themed flex h-dvh flex-col overflow-hidden bg-canvas text-fg">
      <OfflineIndicator />
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

      {/* Phase 9: canonical Global Search overlay. Mounted ONCE at the
          shell level so it persists across route changes. Home search,
          TopNav search input, the keyboard shortcut, and any other trigger
          all open this same instance via useGlobalSearchStore. */}
      <GlobalSearchOverlay />

      {/* Lilith — global floating AI assistant layer.
          Persists across all route changes because she's a sibling
          of {children}, not a child of any routed page. */}
      <LilithLayer />

      {/* Phase 10: Notification producers — real event sources (vault
          transactions, dev-workspace runtime failures, investing
          thesis review due). Markets price alerts are evaluated inline
          from the markets store's updatePrice hot path. AI provider
          failures are notified explicitly by the chat panels. This
          component renders nothing — it just registers the producer
          observers. */}
      <NotificationProducers />
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

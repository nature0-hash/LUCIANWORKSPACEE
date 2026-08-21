"use client";

import { useCallback, useEffect, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { DesktopSidebar, SidebarDrawer } from "@/components/layout/Sidebar";
import { SettingsModal } from "@/components/settings/SettingsModal";

interface AppShellProps {
  children?: React.ReactNode;
}

/**
 * Global application shell: Top nav + collapsible left sidebar + main content.
 * - Desktop: sidebar collapses to a narrow rail (w-14) with smooth transition.
 * - Mobile/tablet: hamburger opens a slide-over drawer with backdrop.
 * The shell persists across navigation when used in src/app/layout.tsx.
 */
export function AppShell({ children }: AppShellProps) {
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Persist collapsed state across reloads (optional, not required)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lucian-sidebar-collapsed");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved === "1") setDesktopCollapsed(true);
      if (saved === "0") setDesktopCollapsed(false);
    } catch {}
  }, []);

  const persistCollapsed = useCallback((next: boolean) => {
    setDesktopCollapsed(next);
    try {
      localStorage.setItem("lucian-sidebar-collapsed", next ? "1" : "0");
    } catch {}
  }, []);

  const handleToggleSidebar = useCallback(() => {
    // Desktop (>=1024px) => collapse rail, otherwise => drawer
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      persistCollapsed(!desktopCollapsed);
    } else {
      setMobileOpen((v) => !v);
    }
  }, [desktopCollapsed, persistCollapsed]);

  // Keep mobile drawer closed when resizing to desktop
  useEffect(() => {
    function onResize() {
      if (window.matchMedia("(min-width: 1024px)").matches) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="themed flex h-dvh flex-col overflow-hidden bg-canvas text-fg">
      <TopNav onToggleSidebar={handleToggleSidebar} onOpenSettings={openSettings} />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar - collapsible */}
        <aside
          className={`themed hidden shrink-0 border-r border-line-muted bg-surface-2/60 transition-all duration-200 ease-out lg:block ${
            desktopCollapsed ? "w-[56px]" : "w-64"
          }`}
          aria-label="Primary navigation"
        >
          <DesktopSidebar collapsed={desktopCollapsed} />
        </aside>

        {/* Mobile / tablet drawer */}
        <SidebarDrawer open={mobileOpen} onClose={closeMobile} />

        {/* Main workspace */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-canvas">
          {children ? (
            children
          ) : (
            // Fallback when used as <AppShell /> without children (legacy)
            <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
              <p className="text-sm text-fg-muted">Home</p>
            </div>
          )}
        </main>

        {/* Right context panel slot - hidden when unused so main expands naturally */}
        {/* Preserved architecture: future modules can conditionally render here */}
      </div>

      <SettingsModal open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}

"use client";

import { useCallback, useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Sidebar, SidebarDrawer } from "@/components/layout/Sidebar";
import { Workspace } from "@/components/layout/Workspace";
import { RightPanel } from "@/components/layout/RightPanel";
import { SettingsModal } from "@/components/settings/SettingsModal";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  return (
    <div className="themed flex h-dvh flex-col overflow-hidden bg-canvas text-fg">
      <TopNav
        onToggleSidebar={() => setDrawerOpen((v) => !v)}
        onOpenSettings={openSettings}
      />

      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="themed hidden w-72 shrink-0 border-r border-line-muted bg-surface-2/60 lg:block">
          <Sidebar />
        </aside>

        {/* Mobile / tablet drawer */}
        <SidebarDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        {/* Main workspace */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1">
              <Workspace />
            </div>
            <div className="hidden w-80 shrink-0 xl:block">
              <RightPanel />
            </div>
          </div>
        </main>
      </div>

      <SettingsModal open={settingsOpen} onClose={closeSettings} />
    </div>
  );
}

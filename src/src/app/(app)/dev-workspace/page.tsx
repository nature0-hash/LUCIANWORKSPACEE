"use client";

import { DevWorkspaceModule } from "@/components/devspace/dev-workspace";

/**
 * DevWorkspace route — renders the full DevWorkspace subsystem inside
 * LUCIAN's shared AppShell.
 *
 * The DevWorkspace owns its own internal Zustand store (project state,
 * open tabs, preview state) but does NOT have its own theme system — it
 * reuses LUCIAN's global ThemeProvider.
 */
export default function DevWorkspacePage() {
  return <DevWorkspaceModule />;
}

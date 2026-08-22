"use client";

// DevWorkspace top navigation — internal sub-nav for switching between
// Project Library, Workspace, and Code Converter.
//
// IMPORTANT: this component does NOT include a settings gear icon. The
// original DevWorkspace had its own theme/accent Settings dialog accessed
// via a gear icon here, but LUCIAN already has a global Settings system
// (in the profile dropdown), so the gear icon is intentionally omitted.

import { FolderOpen, Code2, Repeat, HardDrive, Wand2 } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui-devspace/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { estimateStorage } from "@/lib/workspace/db";
import { formatBytes } from "@/lib/workspace/filesystem";
import { StorageManagerDialog } from "@/components/devspace/storage/storage-manager-dialog";

const NAV_ITEMS = [
  { id: "library" as const, label: "Project Library", icon: FolderOpen },
  { id: "workspace" as const, label: "Workspace", icon: Code2 },
  { id: "visual-editor" as const, label: "Visual Editor Studio", icon: Wand2 },
  { id: "converter" as const, label: "Code Converter", icon: Repeat },
];

export function TopNavigation() {
  const view = useWorkspaceStore((s) => s.view);
  const setView = useWorkspaceStore((s) => s.setView);
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [storageOpen, setStorageOpen] = useState(false);

  useEffect(() => {
    estimateStorage().then(setStorage);
    const interval = setInterval(() => estimateStorage().then(setStorage), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <header className="themed flex h-14 shrink-0 items-center justify-between border-b border-line-muted bg-surface-2/60 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="themed flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Code2 className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight text-fg">
            DevWorkspace
          </span>
          {activeProject && (
            <span className="ml-3 hidden min-w-0 items-center gap-2 text-sm text-fg-muted md:inline">
              <span className="text-fg-faint">/</span>
              <span className="truncate font-medium text-fg">
                {activeProject.name}
              </span>
            </span>
          )}
        </div>

        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id;
            return (
              <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                className={cn("gap-2", isActive ? "" : "text-fg-muted")}
                onClick={() => setView(item.id)}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setStorageOpen(true)}
          title="Open Storage Manager"
          aria-label="Open Storage Manager"
          className="focus-ring themed hidden items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs text-fg-muted transition-colors hover:bg-hover hover:text-fg lg:flex"
        >
          <HardDrive className="h-3.5 w-3.5" />
          <span>
            {formatBytes(storage.usage)}
            {storage.quota > 0 && ` / ${formatBytes(storage.quota)}`}
          </span>
        </button>
      </header>

      <StorageManagerDialog open={storageOpen} onOpenChange={setStorageOpen} />
    </>
  );
}

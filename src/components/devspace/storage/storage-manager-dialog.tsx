"use client";

// LUCIAN Storage Manager.
//
// Shows browser storage usage, per-project size breakdown, the Recycle Bin,
// and a (truthful) request-persistent-storage action. All operations work
// against the real IndexedDB store via the Zustand store + db.ts.
//
// Architectural honesty:
// - Storage quota is whatever navigator.storage.estimate() reports. We never
//   invent a number. When the API is unavailable, we say so.
// - "Protect Local Storage" calls navigator.storage.persist() — it returns
//   `true` only when the browser actually grants persistence. We surface the
//   real result. There is no fake "Upgrade" button: if the browser cannot
//   grant more quota, we say so explicitly.
// - Project deletion is a soft-delete → trash. Permanent deletion is a
//   separate, clearly-labeled action.

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Database,
  HardDrive,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-devspace/dialog";
import { Button } from "@/components/ui-devspace/button";
import { Badge } from "@/components/ui-devspace/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui-devspace/alert-dialog";
import { useWorkspaceStore } from "@/store/workspace";
import {
  estimateStorage,
  isStoragePersistent,
  requestPersistentStorage,
} from "@/lib/workspace/db";
import { formatBytes } from "@/lib/workspace/filesystem";
import { toast } from "@/hooks/use-toast";

interface StorageManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StorageManagerDialog({ open, onOpenChange }: StorageManagerDialogProps) {
  const {
    projects,
    trashedProjects,
    refreshProjects,
    refreshTrashedProjects,
    permanentlyDeleteProject,
    restoreProject,
    emptyRecycleBin,
  } = useWorkspaceStore();

  const [storage, setStorage] = useState({ usage: 0, quota: 0 });
  const [persistence, setPersistence] = useState<{ supported: boolean; persisted: boolean }>({
    supported: false,
    persisted: false,
  });
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [est, persisted] = await Promise.all([
        estimateStorage(),
        isStoragePersistent(),
      ]);
      setStorage(est);
      setPersistence(persisted);
      await Promise.all([refreshProjects(), refreshTrashedProjects()]);
    } finally {
      setLoading(false);
    }
  }, [refreshProjects, refreshTrashedProjects]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [open, refresh]);

  const handleRequestPersistence = async () => {
    setRequesting(true);
    try {
      const result = await requestPersistentStorage();
      setPersistence(result);
      if (!result.supported) {
        toast({
          title: "Persistence not supported",
          description: "This browser does not expose the persistent storage API.",
          variant: "destructive",
        });
      } else if (result.persisted) {
        toast({
          title: "Local storage protected",
          description:
            "Your browser has granted persistence. Lucian's stored data will not be evicted by the browser's automatic cleanup.",
        });
      } else {
        toast({
          title: "Persistence request denied",
          description:
            "Your browser declined the persistence request. Some browsers only grant persistence for installed/PWA sites.",
          variant: "destructive",
        });
      }
    } finally {
      setRequesting(false);
    }
  };

  const handleRestore = async (id: string) => {
    await restoreProject(id);
    toast({ title: "Project restored" });
    void refresh();
  };

  const handlePermanentDelete = async (id: string) => {
    await permanentlyDeleteProject(id);
    setConfirmDelete(null);
    toast({ title: "Project permanently deleted" });
    void refresh();
  };

  const handleEmptyBin = async () => {
    setConfirmEmpty(false);
    await emptyRecycleBin();
    toast({ title: "Recycle Bin emptied" });
    void refresh();
  };

  const usedPct =
    storage.quota > 0 ? Math.min(100, (storage.usage / storage.quota) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="flex-row items-center justify-between border-b px-5 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Database className="h-4 w-4" /> Storage Manager
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="max-h-[calc(85vh-50px)] overflow-y-auto px-5 py-4">
          {/* Storage usage */}
          <section className="rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                Browser storage
              </h3>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            {storage.quota > 0 ? (
              <>
                <div className="mb-1.5 flex items-baseline justify-between text-xs">
                  <span className="font-mono text-foreground">
                    {formatBytes(storage.usage)}
                  </span>
                  <span className="text-muted-foreground">
                    of {formatBytes(storage.quota)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  This is the browser&apos;s per-origin estimate — actual usage may
                  differ slightly. Quota is set by the browser and cannot be
                  increased by Lucian.
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                The browser does not expose storage estimates on this device.
                Lucian cannot display usage information here.
              </p>
            )}
          </section>

          {/* Persistent storage */}
          <section className="mt-3 rounded-lg border bg-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Persistent storage protection
              </h3>
              {persistence.supported && persistence.persisted ? (
                <Badge variant="default">Protected</Badge>
              ) : (
                <Badge variant="secondary">Not protected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Browsers can automatically evict local storage when disk space is
              low. Requesting persistence tells the browser not to evict Lucian&apos;s
              stored projects.{" "}
              {persistence.supported
                ? ""
                : "This browser does not support the persistence API."}
            </p>
            {persistence.supported && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={requesting || persistence.persisted}
                onClick={handleRequestPersistence}
              >
                {requesting ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                )}
                {persistence.persisted ? "Protected" : "Protect Local Storage"}
              </Button>
            )}
          </section>

          {/* Stored projects */}
          <section className="mt-3">
            <h3 className="mb-2 flex items-center justify-between text-sm font-medium">
              <span>Stored projects ({projects.length})</span>
              <span className="text-xs font-normal text-muted-foreground">
                {formatBytes(projects.reduce((s, p) => s + p.totalSize, 0))}
              </span>
            </h3>
            {projects.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                No live projects stored.
              </p>
            ) : (
              <ul className="space-y-1">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.fileCount} files · {p.framework}
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 font-mono text-xs text-muted-foreground">
                      {formatBytes(p.totalSize)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Recycle Bin */}
          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                Recycle Bin ({trashedProjects.length})
              </h3>
              {trashedProjects.length > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setConfirmEmpty(true)}
                >
                  Empty Recycle Bin
                </Button>
              ) : null}
            </div>

            {trashedProjects.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                Recycle Bin is empty. Deleted projects will appear here first.
              </p>
            ) : (
              <ul className="space-y-1">
                {trashedProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.fileCount} files · {formatBytes(p.totalSize)}
                        {p.trashedAt
                          ? ` · trashed ${new Date(p.trashedAt).toLocaleDateString()}`
                          : ""}
                      </p>
                    </div>
                    <div className="ml-3 flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => handleRestore(p.id)}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restore
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(p.id)}
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete forever
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Confirm: empty recycle bin */}
        <AlertDialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete {trashedProjects.length}{" "}
                {trashedProjects.length === 1 ? "project" : "projects"} and all
                of their files. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleEmptyBin}
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Empty Recycle Bin
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Confirm: permanently delete one */}
        <AlertDialog
          open={!!confirmDelete}
          onOpenChange={(o) => !o && setConfirmDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project forever?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the project record and all of its
                files. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete forever
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderKanban, Loader2, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";
import { ProjectCard } from "@/components/projects/ProjectCard";
import { ImportZipDialog } from "@/components/projects/ImportZipDialog";
import { RenameProjectDialog } from "@/components/projects/RenameProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import { listAllProjects } from "@/lib/projects";
import type { Project } from "@/lib/projects";

/**
 * Projects list page — the Project Library.
 *
 * Loads project metadata only (no file contents) from IndexedDB, displays
 * them as a responsive grid, and orchestrates the import / rename / delete
 * dialogs.
 *
 * Persistence: each mutation (import / rename / delete) is performed by the
 * underlying project service. After a successful mutation we re-query the
 * list — single source of truth, no optimistic caching.
 */
export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Project | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

  const refresh = useCallback(async () => {
    try {
      const rows = await listAllProjects();
      setProjects(rows);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load projects from local storage."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load. We can't call refresh() synchronously in the effect body
  // (it would trigger the set-state-in-effect lint rule), so we fire the
  // async load and let setState happen in the async callbacks.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Yield to the microtask queue so any setState calls below are
      // NOT synchronous in the effect body (avoids cascading renders
      // during initial mount).
      await Promise.resolve();
      try {
        const rows = await listAllProjects();
        if (cancelled) return;
        setProjects(rows);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load projects from local storage."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasProjects = projects.length > 0;

  return (
    <PageShell width="wide">
      <PageHeader
        title="Projects"
        description="Imported projects are stored locally in your browser. They survive refresh and remain available until you delete them."
        actions={
          <Button
            variant="primary"
            size="md"
            onClick={() => setImportOpen(true)}
          >
            <Upload size={14} />
            Import ZIP
          </Button>
        }
      />

      <div className="mt-6">
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={refresh} />
        ) : !hasProjects ? (
          <EmptyProjectsState onImport={() => setImportOpen(true)} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onRename={(project) => setRenameTarget(project)}
                onDelete={(project) => setDeleteTarget(project)}
              />
            ))}
          </div>
        )}
      </div>

      <ImportZipDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          void refresh();
        }}
      />
      <RenameProjectDialog
        key={`rename-${renameTarget?.id ?? "none"}`}
        project={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRenamed={() => {
          void refresh();
        }}
      />
      <DeleteProjectDialog
        key={`delete-${deleteTarget?.id ?? "none"}`}
        project={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => {
          void refresh();
        }}
      />
    </PageShell>
  );
}

function LoadingState() {
  return (
    <div className="themed flex items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-surface-2/40 px-6 py-16 text-sm text-fg-muted">
      <Loader2 size={16} className="animate-spin text-accent" />
      Loading your projects…
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <EmptyState
      icon={<FolderKanban size={20} />}
      title="Couldn't load projects"
      description={message}
      actions={
        <Button variant="secondary" size="md" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

function EmptyProjectsState({ onImport }: { onImport: () => void }) {
  return (
    <EmptyState
      icon={<FolderKanban size={20} />}
      title="No projects yet"
      description="Import a .zip file from your computer to add it to your local Project Library. Nothing is uploaded to a server."
      actions={
        <Button variant="primary" size="md" onClick={onImport}>
          <Plus size={14} />
          Import ZIP
        </Button>
      }
    />
  );
}

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  FolderKanban,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { PageShell } from "@/components/ui/PageShell";
import { FileTree } from "@/components/projects/FileTree";
import { FilePreview } from "@/components/projects/FilePreview";
import { RenameProjectDialog } from "@/components/projects/RenameProjectDialog";
import { DeleteProjectDialog } from "@/components/projects/DeleteProjectDialog";
import {
  formatBytes,
  formatRelativeTime,
  frameworkLabel,
  getProjectById,
  listProjectFiles,
} from "@/lib/projects";
import type { Project, ProjectFile } from "@/lib/projects";

/**
 * Project detail page.
 *
 * Loads the project metadata + file list from IndexedDB on mount, then
 * renders a two-pane layout: file tree on the left, read-only file
 * preview on the right. Both panes are theme-aware and responsive —
 * on small screens they stack vertically.
 */
export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!projectId) return;
    try {
      const [p, f] = await Promise.all([
        getProjectById(projectId),
        listProjectFiles(projectId),
      ]);
      if (!p) {
        setError("This project could not be found. It may have been deleted.");
        setProject(null);
        return;
      }
      setProject(p);
      setFiles(f);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load the project from local storage."
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Initial load + reload whenever projectId changes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Yield to the microtask queue so any setState calls below are
      // NOT synchronous in the effect body (avoids cascading renders
      // during initial mount).
      await Promise.resolve();
      if (cancelled) return;
      if (!projectId) {
        setError("Invalid project ID.");
        setLoading(false);
        return;
      }
      try {
        const [p, f] = await Promise.all([
          getProjectById(projectId),
          listProjectFiles(projectId),
        ]);
        if (cancelled) return;
        if (!p) {
          setError("This project could not be found. It may have been deleted.");
          setProject(null);
          return;
        }
        setProject(p);
        setFiles(f);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load the project from local storage."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleDeleted = useCallback(() => {
    // Navigate back to the projects list after deletion.
    router.push("/projects");
  }, [router]);

  if (loading) {
    return (
      <PageShell width="wide">
        <div className="flex items-center gap-2 text-sm text-fg-muted">
          <Loader2 size={16} className="animate-spin text-accent" />
          Loading project…
        </div>
      </PageShell>
    );
  }

  if (error || !project) {
    return (
      <PageShell width="default">
        <div className="space-y-4">
          <Link
            href="/projects"
            className="focus-ring themed inline-flex items-center gap-1.5 rounded-md text-sm text-fg-muted hover:text-fg"
          >
            <ArrowLeft size={14} />
            Back to Projects
          </Link>
          <div className="themed flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-2/40 px-6 py-16 text-center">
            <FolderKanban size={20} className="mb-3 text-fg-faint" />
            <h2 className="text-base font-semibold text-fg">
              {error ?? "Project not found"}
            </h2>
            <p className="mt-1 text-sm text-fg-muted">
              It may have been deleted, or your browser storage may be unavailable.
            </p>
            <Link href="/projects" className="mt-4">
              <Button variant="secondary" size="md">
                Back to Projects
              </Button>
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell width="wide">
      {/* Breadcrumb + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            href="/projects"
            className="focus-ring themed inline-flex items-center gap-1 rounded-md text-fg-muted hover:text-fg"
          >
            <ArrowLeft size={14} />
            Projects
          </Link>
          <span className="text-fg-faint">/</span>
          <h1 className="truncate text-base font-semibold text-fg">
            {project.name}
          </h1>
        </div>
        <div className="relative">
          <IconButton
            label="Project actions"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal size={15} />
          </IconButton>
          {menuOpen ? (
            <ProjectActionsMenu
              onClose={() => setMenuOpen(false)}
              onRename={() => {
                setMenuOpen(false);
                setRenameOpen(true);
              }}
              onDelete={() => {
                setMenuOpen(false);
                setDeleteOpen(true);
              }}
            />
          ) : null}
        </div>
      </div>

      {/* Metadata bar */}
      <dl className="themed mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line-muted text-sm sm:grid-cols-4">
        <MetaCell label="Framework" value={frameworkLabel(project.detectedFramework)} />
        <MetaCell label="Files" value={String(project.fileCount)} />
        <MetaCell label="Total size" value={formatBytes(project.totalSize)} />
        <MetaCell label="Imported" value={formatRelativeTime(project.importedAt)} />
      </dl>

      {project.importWarning ? (
        <p className="mt-3 rounded-md border border-line-muted bg-surface-2/50 px-3 py-2 text-[12px] leading-relaxed text-fg-faint">
          {project.importWarning}
        </p>
      ) : null}

      {/* Tree + preview two-pane layout */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,360px)_1fr]">
        <div className="themed flex max-h-[min(70vh,560px)] flex-col overflow-hidden rounded-lg border border-line bg-surface-2/40">
          <div className="themed flex shrink-0 items-center justify-between border-b border-line-muted px-3 py-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
              Files
            </span>
            <span className="text-[11px] text-fg-faint">
              {project.fileCount === 1 ? "1 file" : `${project.fileCount} files`}
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 py-2">
            <FileTree
              files={files}
              selectedPath={
                files.find((f) => f.id === selectedFileId)?.path ?? null
              }
              onSelect={(file) => setSelectedFileId(file.id)}
            />
          </div>
        </div>

        <div className="min-h-[400px] lg:min-h-[min(70vh,560px)]">
          <FilePreview fileId={selectedFileId} projectId={project.id} />
        </div>
      </div>

      <RenameProjectDialog
        key={`rename-${renameOpen ? project.id : "none"}`}
        project={renameOpen ? project : null}
        onClose={() => setRenameOpen(false)}
        onRenamed={() => {
          void refresh();
        }}
      />
      <DeleteProjectDialog
        key={`delete-${deleteOpen ? project.id : "none"}`}
        project={deleteOpen ? project : null}
        onClose={() => setDeleteOpen(false)}
        onDeleted={handleDeleted}
      />
    </PageShell>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="themed flex flex-col gap-0.5 bg-surface px-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-wide text-fg-faint">
        {label}
      </dt>
      <dd className="truncate text-sm font-medium text-fg">{value}</dd>
    </div>
  );
}

interface ProjectActionsMenuProps {
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

function ProjectActionsMenu({ onClose, onRename, onDelete }: ProjectActionsMenuProps) {
  // Reuse the close-on-outside-click pattern from ProjectCardMenu inline.
  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node;
      // The menu container is the parent of the event listeners' target.
      // We rely on event bubbling: any click inside the menu will have been
      // handled by the menu buttons before this listener fires.
      // So we just check: did the click happen *inside* an element marked
      // with `data-project-menu`?
      const menu = document.querySelector('[data-project-menu="true"]');
      if (menu && !menu.contains(target)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    const timer = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("touchstart", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const itemClass =
    "focus-ring flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-fg transition-colors hover:bg-hover";

  return (
    <div
      data-project-menu="true"
      role="menu"
      className="themed absolute right-0 top-full z-40 mt-1 w-44 origin-top-right rounded-lg border border-line bg-overlay p-1 shadow-pop"
    >
      <button type="button" role="menuitem" className={itemClass} onClick={onRename}>
        <Pencil size={14} className="text-fg-muted" />
        Rename project
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={onDelete}>
        <Trash2 size={14} className="text-fg-muted" />
        Delete project
      </button>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import {
  formatBytes,
  formatRelativeTime,
  frameworkLabel,
} from "@/lib/projects";
import type { Project } from "@/lib/projects";

interface ProjectCardProps {
  project: Project;
  onRename: (project: Project) => void;
  onDelete: (project: Project) => void;
}

/**
 * One card in the project list grid.
 *
 * The whole card links to the project detail page, except for the actions
 * menu button which has its own click handler (and stops propagation so it
 * doesn't navigate).
 */
export function ProjectCard({ project, onRename, onDelete }: ProjectCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="themed group relative flex flex-col rounded-lg border border-line bg-surface transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]">
      <Link
        href={`/projects/${project.id}`}
        aria-label={`Open ${project.name}`}
        className="focus-ring themed flex flex-1 flex-col gap-3 rounded-lg p-4"
      >
        {/* Header row: icon + name */}
        <div className="flex items-start gap-3">
          <span className="themed flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-accent">
            <FolderKanban size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-fg">
              {project.name}
            </h3>
            <p className="mt-0.5 text-xs text-fg-faint">
              {frameworkLabel(project.detectedFramework)} ·{" "}
              {project.fileCount === 1
                ? "1 file"
                : `${project.fileCount} files`}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          <span>{formatBytes(project.totalSize)}</span>
          <span className="text-fg-faint">·</span>
          <span>Imported {formatRelativeTime(project.importedAt)}</span>
        </div>

        {project.importWarning ? (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-fg-faint">
            {project.importWarning}
          </p>
        ) : null}
      </Link>

      {/* Actions menu (does NOT navigate) */}
      <div className="absolute right-2 top-2">
        <IconButton
          label="Project actions"
          className="opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
        >
          <MoreHorizontal size={15} />
        </IconButton>
        {menuOpen ? (
          <ProjectCardMenu
            onClose={() => setMenuOpen(false)}
            onRename={() => {
              setMenuOpen(false);
              onRename(project);
            }}
            onDelete={() => {
              setMenuOpen(false);
              onDelete(project);
            }}
          />
        ) : null}
      </div>
    </article>
  );
}

interface ProjectCardMenuProps {
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * Small dropdown menu rendered by the ProjectCard. Closes on outside click
 * or Escape. Implementation is intentionally lightweight — we only have
 * two items so a full Menu primitive would be overkill.
 */
function ProjectCardMenu({ onClose, onRename, onDelete }: ProjectCardMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!ref.current?.contains(event.target as Node)) onClose();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    // Defer listener attachment by one tick so the click that opened us
    // doesn't immediately close us again.
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
      ref={ref}
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

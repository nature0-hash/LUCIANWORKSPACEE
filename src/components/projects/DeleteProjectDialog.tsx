"use client";

import { useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { deleteProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";

interface DeleteProjectDialogProps {
  project: Project | null;
  onClose: () => void;
  onDeleted: (projectId: string) => void;
}

/**
 * Delete-project confirmation dialog.
 *
 * Behavior:
 * - Clearly states the project name in the body.
 * - Disables the Delete button while a request is in-flight.
 * - Surfaces errors verbatim (e.g. "Project not found").
 * - On success, calls `onDeleted(id)` so the parent can refresh and
 *   navigate away from the detail page (if applicable).
 *
 * Implementation note: We use useState initializers (rather than syncing
 * from props in an effect) and rely on the parent passing `key={project?.id}`
 * so the dialog remounts with fresh state per project.
 */
export function DeleteProjectDialog({
  project,
  onClose,
  onDeleted,
}: DeleteProjectDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!project) return null;

  async function handleDelete() {
    if (!project) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteProject(project.id);
      onDeleted(project.id);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete the project."
      );
      setDeleting(false);
    }
  }

  return (
    <Dialog
      open={!!project}
      onClose={onClose}
      title="Delete project"
      ariaLabel="Delete project confirmation"
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleDelete}
            disabled={deleting}
            className="!bg-[color-mix(in_srgb,var(--accent)_70%,#000_25%)]"
          >
            {deleting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Deleting…
              </>
            ) : (
              "Delete project"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="themed flex items-start gap-3 rounded-md border border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))] p-3">
          <AlertTriangle
            size={16}
            className="mt-0.5 shrink-0 text-accent"
            aria-hidden
          />
          <div className="leading-relaxed text-[13px] text-fg">
            <p>
              Delete <span className="font-semibold">{project.name}</span> from
              your local project library?
            </p>
            <p className="mt-1 text-xs text-fg-muted">
              This removes the project record and all{" "}
              {project.fileCount === 1 ? "1 file" : `${project.fileCount} files`}{" "}
              stored in this browser. The original ZIP on your computer is
              not affected.
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="text-xs text-[color-mix(in_srgb,var(--accent)_85%,var(--fg))]"
          >
            {error}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

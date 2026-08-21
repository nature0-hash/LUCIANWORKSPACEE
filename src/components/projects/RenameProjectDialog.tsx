"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextInput } from "@/components/ui/TextInput";
import { renameProject } from "@/lib/projects";
import type { Project } from "@/lib/projects";

interface RenameProjectDialogProps {
  project: Project | null;
  onClose: () => void;
  onRenamed: (updated: Project) => void;
}

/**
 * Rename-project dialog.
 *
 * Behavior:
 * - Prefills with the project's current name and selects it on open so
 *   the user can immediately type a new one.
 * - Validates that the name is non-empty (after trim).
 * - Disables the Save button while a request is in-flight to prevent
 *   duplicate submissions.
 * - Surfaces any error from the project service verbatim.
 *
 * Implementation note: We deliberately don't `useEffect` to sync `name`
 * with `project.name` when the project changes. Instead, the parent
 * passes `key={project?.id ?? "none"}` so React unmounts the dialog when
 * the target project changes and remounts it with the useState initializer
 * below — this is the React-recommended pattern for "reset state when
 * prop changes".
 */
export function RenameProjectDialog({
  project,
  onClose,
  onRenamed,
}: RenameProjectDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // useState initializer reads from props once, on mount. The parent
  // remounts this component via a `key` change whenever the target project
  // changes, so this is sufficient.
  const [name, setName] = useState(() => project?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Move focus + select the input text when the dialog mounts (which
  // happens every time the user opens it for a new project, thanks to the
  // parent's `key` prop).
  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!project) return null;

  const trimmed = name.trim();
  const trimmedIsUnchanged = trimmed === project.name;

  async function handleSave() {
    if (!project) return;
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Project name cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await renameProject(project.id, trimmedName);
      onRenamed(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rename project.");
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={!!project}
      onClose={onClose}
      title="Rename project"
      ariaLabel="Rename project dialog"
      maxWidthClass="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={saving || trimmed.length === 0 || trimmedIsUnchanged}
          >
            Save name
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <TextInput
          ref={inputRef}
          id="project-name"
          label="Project name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSave();
            }
          }}
          error={error ?? undefined}
          helper="This is the display name in your project library. Internal file paths are not affected."
          placeholder="e.g. my-awesome-app"
          autoComplete="off"
          spellCheck={false}
          maxLength={120}
        />
      </div>
    </Dialog>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import { FileArchive, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { importZipProject } from "@/lib/projects";
import type { ImportStatus } from "@/lib/projects";

interface ImportZipDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the parent can refresh its list */
  onImported: () => void;
}

/**
 * "Import ZIP" dialog.
 *
 * Owns:
 *   - A hidden file input that opens the OS file picker.
 *   - The ImportStatus state machine surfaced to the user.
 *   - Cleanup of the input value so the same file can be re-imported.
 *
 * The actual ZIP parsing + IndexedDB write happens in
 * `importZipProject` — this dialog only orchestrates the UX.
 */
export function ImportZipDialog({
  open,
  onClose,
  onImported,
}: ImportZipDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle" });

  const reset = useCallback(() => {
    setStatus({ kind: "idle" });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const handleClose = useCallback(() => {
    // Don't allow closing while an import is in-flight — the user might
    // trigger a duplicate by reopening.
    if (
      status.kind === "reading" ||
      status.kind === "extracting" ||
      status.kind === "saving"
    ) {
      return;
    }
    reset();
    onClose();
  }, [status, onClose, reset]);

  const handlePick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate extension client-side — saves a useless decompress attempt.
      if (!file.name.toLowerCase().endsWith(".zip")) {
        setStatus({
          kind: "error",
          message: "Please choose a .zip file.",
        });
        return;
      }

      setStatus({ kind: "reading", fileName: file.name });
      // Yield to the event loop so the UI paints the "Reading…" state before
      // we hand off to the synchronous-feeling unzip flow.
      await new Promise((r) => setTimeout(r, 0));

      try {
        // The progress between reading/extracting/saving is intentionally
        // coarse — fflate's unzip is a single Promise and does not expose
        // per-entry progress. The user sees truthful, indeterminate states.
        setStatus({ kind: "extracting", fileName: file.name, entries: 0 });
        await new Promise((r) => setTimeout(r, 0));

        const project = await importZipProject(file);

        setStatus({
          kind: "saving",
          fileName: file.name,
          entries: project.fileCount,
        });
        await new Promise((r) => setTimeout(r, 0));

        // The actual write already happened inside importZipProject —
        // we just surface the success state.
        setStatus({ kind: "done", projectId: project.id });

        // Notify the parent to refresh its list, then close the dialog
        // after a brief beat so the user sees the "Import complete" state.
        onImported();
        setTimeout(() => {
          reset();
          onClose();
        }, 700);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while importing.";
        setStatus({ kind: "error", message });
      }
    },
    [onImported, reset, onClose]
  );

  const isWorking =
    status.kind === "reading" ||
    status.kind === "extracting" ||
    status.kind === "saving";

  const statusText = (() => {
    switch (status.kind) {
      case "idle":
        return null;
      case "reading":
        return "Reading archive…";
      case "extracting":
        return "Extracting files…";
      case "saving":
        return "Saving project to local storage…";
      case "done":
        return "Import complete.";
      case "error":
        return status.message;
    }
  })();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Import project from ZIP"
      ariaLabel="Import a project from a ZIP archive"
      maxWidthClass="max-w-lg"
      footer={
        <>
          <Button
            variant="ghost"
            size="md"
            onClick={handleClose}
            disabled={isWorking}
          >
            Close
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handlePick}
            disabled={isWorking}
          >
            {isWorking ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Working…
              </>
            ) : (
              <>
                <Upload size={14} />
                Choose ZIP file
              </>
            )}
          </Button>
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        onChange={handleFile}
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />

      <div className="space-y-3">
        <p className="text-sm leading-relaxed text-fg-muted">
          Choose a <code className="rounded bg-inset px-1 py-0.5 text-[12px]">.zip</code>{" "}
          file from your computer. Lucian extracts its contents locally in
          your browser — nothing is uploaded to a server.
        </p>

        <div className="themed flex items-start gap-3 rounded-md border border-line-muted bg-surface-2/60 p-3 text-[13px] text-fg-muted">
          <FileArchive size={16} className="mt-0.5 shrink-0 text-fg-faint" />
          <div className="leading-relaxed">
            <p>Projects are stored in your browser&rsquo;s IndexedDB.</p>
            <p className="mt-1 text-xs text-fg-faint">
              Folders like <code>node_modules/</code> are skipped to save space.
              macOS metadata (<code>__MACOSX/</code>, <code>.DS_Store</code>) is
              ignored.
            </p>
          </div>
        </div>

        {statusText ? (
          <div
            className={`themed flex items-start gap-2 rounded-md border p-3 text-[13px] ${
              status.kind === "error"
                ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))] bg-[color-mix(in_srgb,var(--accent)_6%,var(--surface))]"
                : status.kind === "done"
                ? "border-line bg-surface-2/60 text-fg"
                : "border-line-muted bg-surface-2/60 text-fg-muted"
            }`}
            role={status.kind === "error" ? "alert" : "status"}
          >
            {isWorking ? (
              <Loader2 size={14} className="mt-0.5 shrink-0 animate-spin text-accent" />
            ) : null}
            <span className="leading-relaxed">{statusText}</span>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

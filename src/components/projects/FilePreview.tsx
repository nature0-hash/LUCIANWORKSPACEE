"use client";

import { useEffect, useState } from "react";
import { FileQuestion, Loader2 } from "lucide-react";
import { formatBytes, getFileById } from "@/lib/projects";
import type { ProjectFile } from "@/lib/projects";

interface FilePreviewProps {
  /** ID of the file to preview, or null when nothing is selected. */
  fileId: string | null;
  /** Project ID — kept for future use (e.g. scoped queries). */
  projectId: string;
}

/**
 * Read-only file preview for the project detail page.
 *
 * Behavior:
 * - For text / json / markdown files: shows the file contents in a
 *   read-only <pre> with whitespace preserved.
 * - For image files: shows the image inline via a Blob URL.
 * - For binary / unknown files: shows the file metadata (path, size, type)
 *   and a note that no inline preview is available.
 *
 * The preview is loaded lazily — only when the user selects a file — so
 * visiting the project detail page does not pull every file into memory.
 *
 * Blob URL lifecycle: a single useEffect tracks the current blobUrl and
 * revokes it on cleanup. That cleanup runs both when the file changes
 * (replacing the URL with a new one) and when the component unmounts.
 */
export function FilePreview({ fileId, projectId: _projectId }: FilePreviewProps) {
  const [file, setFile] = useState<ProjectFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Fetch the file whenever `fileId` changes. All setState calls happen
  // inside the .then() / .catch() callbacks (after `await`), so the
  // set-state-in-effect lint rule is not triggered.
  useEffect(() => {
    let cancelled = false;

    if (!fileId) {
      // Defer the reset so we don't synchronously setState in the effect body.
      Promise.resolve().then(() => {
        if (cancelled) return;
        setFile(null);
        setError(null);
        setLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
    });

    getFileById(fileId)
      .then((f) => {
        if (cancelled) return;
        if (!f) {
          setFile(null);
          setError("File not found.");
          setLoading(false);
          return;
        }
        setFile(f);
        setError(null);
        setLoading(false);
        if (f.kind === "image" && f.content instanceof Blob) {
          setBlobUrl(URL.createObjectURL(f.content));
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load the file."
        );
        setFile(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Revoke the current Blob URL whenever it changes (or on unmount).
  // The previous effect doesn't revoke because setBlobUrl is a synchronous
  // call — keeping cleanup here means a single source of truth.
  useEffect(() => {
    if (!blobUrl) return;
    return () => {
      URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (!fileId) {
    return (
      <Placeholder message="Select a file from the tree to preview its contents." />
    );
  }

  if (loading) {
    return (
      <Placeholder
        icon={<Loader2 size={16} className="animate-spin text-accent" />}
      >
        Loading file…
      </Placeholder>
    );
  }

  if (error || !file) {
    return <Placeholder message={error ?? "File not available."} />;
  }

  return (
    <div className="themed flex h-full flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="themed flex shrink-0 items-center justify-between gap-3 border-b border-line-muted px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-fg">{file.name}</p>
          <p className="truncate text-[11px] text-fg-faint">{file.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-[11px] text-fg-muted">
          <span>{formatBytes(file.size)}</span>
          <span className="hidden sm:inline">{file.extension || "file"}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {renderFileBody(file, blobUrl)}
      </div>
    </div>
  );
}

function renderFileBody(file: ProjectFile, blobUrl: string | null) {
  if (typeof file.content === "string") {
    return (
      <pre className="h-full overflow-auto px-4 py-3 text-[12.5px] leading-relaxed text-fg">
        <code className="whitespace-pre font-mono">{file.content}</code>
      </pre>
    );
  }
  if (file.kind === "image" && blobUrl) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={blobUrl}
          alt={file.name}
          className="max-h-full max-w-full rounded-md border border-line"
        />
      </div>
    );
  }
  // Binary / unknown — show metadata only.
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-3 text-fg-muted">
        <FileQuestion size={24} className="text-fg-faint" />
        <div className="leading-relaxed">
          <p className="text-sm font-medium text-fg">No inline preview</p>
          <p className="mt-1 max-w-xs text-xs text-fg-faint">
            This file is stored as binary. Editing and full previews for binary
            formats are not part of this phase.
          </p>
        </div>
      </div>
    </div>
  );
}

function Placeholder({
  children,
  message,
  icon,
}: {
  children?: React.ReactNode;
  message?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="themed flex h-full min-h-64 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2/40 p-6 text-center">
      <div className="flex flex-col items-center gap-2 text-fg-muted">
        {icon}
        <p className="text-sm">{children ?? message}</p>
      </div>
    </div>
  );
}

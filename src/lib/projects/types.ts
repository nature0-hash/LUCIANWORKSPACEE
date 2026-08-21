/**
 * Type definitions for the Lucian Project Library.
 *
 * These types describe how projects are stored in IndexedDB and how
 * they are exposed to UI components. They are intentionally narrow and
 * explicit so the storage layer and the UI cannot drift apart silently.
 */

/** Project source — what kind of import created this project. */
export type ProjectSource = "zip";

/**
 * Lightweight, file-only framework detection result.
 *
 * `null` (mapped to the label "Unknown" in the UI) is returned when we
 * cannot confidently say what framework the project uses. We never
 * pretend to know.
 */
export type FrameworkType =
  | "nextjs"
  | "react"
  | "vite"
  | "node"
  | "static-html"
  | null;

/** One row in the `projects` IndexedDB store. */
export interface Project {
  /** Stable unique ID — a generated string (crypto.randomUUID when available) */
  id: string;
  /** Display name shown in the UI. Renamable. */
  name: string;
  /** Original root folder name from the ZIP (e.g. "my-app"). Empty if flat. */
  rootFolderName: string;
  /** Where this project came from. */
  sourceType: ProjectSource;
  /** Detected framework, or null when uncertain. */
  detectedFramework: FrameworkType;
  /** Total number of imported files. */
  fileCount: number;
  /** Sum of all imported file sizes in bytes. */
  totalSize: number;
  /** ISO timestamp — when the project was first imported. */
  importedAt: string;
  /** ISO timestamp — when the project metadata was last changed (e.g. rename). */
  updatedAt: string;
  /**
   * Optional warning surfaced during import (e.g. "node_modules was
   * excluded"). Kept on the project record so the user can review it
   * later from the detail page.
   */
  importWarning: string | null;
}

/** One row in the `projectFiles` IndexedDB store. */
export interface ProjectFile {
  /** Stable unique ID — typically `${projectId}::${path}` */
  id: string;
  /** Owning project ID. Indexed for fast per-project queries. */
  projectId: string;
  /** Full slash-separated path inside the project, e.g. "src/app/page.tsx" */
  path: string;
  /** File name only (last path segment), e.g. "page.tsx" */
  name: string;
  /** Parent path, "" for files at the root, no leading/trailing slash. */
  parentPath: string;
  /** Always "file" — reserved for future "symlink"/"special" if ever needed. */
  type: "file";
  /** Size in bytes. */
  size: number;
  /** Detected MIME-style category: text / json / image / binary / unknown */
  kind: FileKind;
  /** File contents. Text files store a string; binary files store a Blob. */
  content: string | Blob;
  /** Lower-case extension without the dot, e.g. "tsx", "md", "png". May be "". */
  extension: string;
  /** ISO timestamp — when the file was imported. */
  importedAt: string;
}

/** Coarse content category used by the file preview / tree icons. */
export type FileKind =
  | "text"
  | "json"
  | "markdown"
  | "image"
  | "binary"
  | "unknown";

/** Tree node used by the FileTree component. Built from ProjectFile rows. */
export interface ProjectTreeNode {
  /** Path of this node — same as the file's path for files, or the folder path for folders. */
  path: string;
  /** Last path segment. */
  name: string;
  /** "folder" or "file" */
  type: "folder" | "file";
  /** For files only — the kind + size + extension from the underlying ProjectFile. */
  kind?: FileKind;
  size?: number;
  extension?: string;
  /** Children, sorted (folders first, then files, each alphabetical). */
  children?: ProjectTreeNode[];
}

/** Result of a successful ZIP import. Returned by zip-import.ts. */
export interface ProjectImportResult {
  /** The newly-created project record (not yet persisted). */
  project: Omit<Project, "id" | "importedAt" | "updatedAt">;
  /** Files extracted from the ZIP, ready to be persisted. */
  files: Omit<ProjectFile, "id" | "projectId" | "importedAt">[];
  /** Optional warning surfaced during extraction (e.g. node_modules skipped). */
  warning: string | null;
}

/** Status of an in-flight import, surfaced to the UI. */
export type ImportStatus =
  | { kind: "idle" }
  | { kind: "reading"; fileName: string }
  | { kind: "extracting"; fileName: string; entries: number }
  | { kind: "saving"; fileName: string; entries: number }
  | { kind: "done"; projectId: string }
  | { kind: "error"; message: string };

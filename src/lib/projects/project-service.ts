/**
 * Project service — high-level operations the UI calls.
 *
 * This layer exists so components never touch IndexedDB or fflate directly.
 * It is the single seam where persistence, ZIP parsing, and framework
 * detection meet. Later phases (Code Workspace, Live Runtime) will reuse
 * the same service to read project files without re-implementing storage.
 *
 * All functions are async and reject with descriptive Error messages on
 * failure. The UI is expected to surface those messages verbatim.
 */
import {
  deleteProjectAndFiles,
  estimateStorage,
  getFile,
  getProject,
  insertProjectWithFiles,
  isAvailable,
  listFilesForProject,
  listProjects,
  putProject,
} from "./database";
import {
  ensureUniqueName,
  tryParsePackageJson,
} from "./framework-detection";
import { parseZipFile } from "./zip-import";
import type {
  Project,
  ProjectFile,
  ProjectImportResult,
} from "./types";

/** Generate a stable unique ID. Uses crypto.randomUUID when available. */
function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers — should never run on a modern browser.
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export async function listAllProjects(): Promise<Project[]> {
  if (!isAvailable()) return [];
  return listProjects();
}

export async function getProjectById(id: string): Promise<Project | null> {
  if (!isAvailable()) return null;
  return getProject(id);
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  if (!isAvailable()) return [];
  return listFilesForProject(projectId);
}

export async function getFileById(id: string): Promise<ProjectFile | null> {
  if (!isAvailable()) return null;
  return getFile(id);
}

/* ------------------------------------------------------------------ */
/* Import                                                              */
/* ------------------------------------------------------------------ */

/**
 * Import a browser File (a .zip) into the project library.
 *
 * Steps:
 *   1. Estimate storage — fail fast if the user is obviously out of space.
 *   2. Parse the ZIP (decompress + normalize paths).
 *   3. Generate a unique project ID + a unique display name.
 *   4. Persist the project + files atomically (single transaction).
 *
 * On any failure, nothing is left in the database — the atomic transaction
 * rolls back. We also double-check after the fact to defend against any
 * edge case where a partial write slipped through.
 *
 * Returns the created Project.
 */
export async function importZipProject(file: File): Promise<Project> {
  if (!isAvailable()) {
    throw new Error(
      "Browser storage (IndexedDB) is not available in this environment."
    );
  }

  // Pre-flight storage check. We only refuse if the ZIP itself is bigger
  // than the remaining quota — that's a clear sign the import will fail.
  // Smaller projects may still fail at write time if the user is near the
  // quota; in that case the IndexedDB write error below surfaces.
  const storage = await estimateStorage();
  if (storage && storage.quota > 0) {
    const remaining = storage.quota - storage.usage;
    // 2× safety margin: decompressed size is usually much larger than the ZIP,
    // and IndexedDB write overhead + future project growth must fit too.
    if (file.size * 2 > remaining) {
      throw new Error(
        `Your browser only has about ${formatBytes(
          remaining
        )} of storage left. Free up space in your browser storage settings and try again.`
      );
    }
  }

  // Step 1+2: parse ZIP. parseZipFile throws on invalid / empty archives.
  let result: ProjectImportResult;
  try {
    result = await parseZipFile(file);
  } catch (err) {
    // Wrap with a more user-friendly message; parseZipFile already
    // produces decent messages, but we want to make sure no raw stack
    // leaks through.
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("Failed to read the ZIP archive.");
  }

  // Step 3: pick a unique project name + generate IDs.
  const existing = await listProjects();
  const uniqueName = ensureUniqueName(
    result.project.name,
    existing.map((p) => p.name)
  );

  const projectId = generateId();
  const nowIso = new Date().toISOString();

  const projectRow: Project = {
    ...result.project,
    id: projectId,
    name: uniqueName,
    importedAt: nowIso,
    updatedAt: nowIso,
  };

  const fileRows: ProjectFile[] = result.files.map((f) => ({
    ...f,
    id: `${projectId}::${f.path}`,
    projectId,
    importedAt: nowIso,
  }));

  // Step 4: persist atomically. If any file write fails (e.g. quota),
  // the whole transaction is rolled back — no orphan project record.
  try {
    await insertProjectWithFiles(projectRow, fileRows);
  } catch (err) {
    // Re-check that nothing was written — defensive, the transaction
    // should already have been aborted.
    const maybe = await getProject(projectId);
    if (maybe) {
      await deleteProjectAndFiles(projectId);
    }
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      throw new Error(
        "Browser storage is full. Free up space in your browser settings and try again."
      );
    }
    if (err instanceof Error) {
      throw new Error(`Failed to save the project: ${err.message}`);
    }
    throw new Error("Failed to save the project.");
  }

  return projectRow;
}

/* ------------------------------------------------------------------ */
/* Update                                                              */
/* ------------------------------------------------------------------ */

/**
 * Rename a project. Validates the new name and persists it to IndexedDB.
 *
 * Returns the updated Project row. Throws if the project doesn't exist or
 * the new name is empty.
 */
export async function renameProject(
  projectId: string,
  rawNewName: string
): Promise<Project> {
  const trimmed = rawNewName.trim();
  if (trimmed.length === 0) {
    throw new Error("Project name cannot be empty.");
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const updated: Project = {
    ...project,
    name: trimmed,
    updatedAt: new Date().toISOString(),
  };
  await putProject(updated);
  return updated;
}

/* ------------------------------------------------------------------ */
/* Delete                                                              */
/* ------------------------------------------------------------------ */

/**
 * Delete a project and every file that belongs to it, atomically.
 *
 * Throws if the project doesn't exist (so the UI can show a specific error
 * rather than silently navigating back).
 */
export async function deleteProject(projectId: string): Promise<void> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error("Project not found.");
  }
  await deleteProjectAndFiles(projectId);
}

/* ------------------------------------------------------------------ */
/* Tree                                                                */
/* ------------------------------------------------------------------ */

/**
 * Build a hierarchical tree from a flat list of ProjectFile rows.
 *
 * Folders are synthesized from file paths — they are not stored separately.
 * The tree is sorted: folders first (alphabetical), then files (alphabetical).
 */
import type { ProjectTreeNode } from "./types";

export function buildFileTree(files: ProjectFile[]): ProjectTreeNode {
  const root: ProjectTreeNode = {
    path: "",
    name: "",
    type: "folder",
    children: [],
  };

  // Index files by path for O(1) lookup when attaching metadata to leaf nodes.
  const byPath = new Map<string, ProjectFile>();
  for (const f of files) byPath.set(f.path, f);

  // Track folder nodes by path so we can attach children incrementally.
  const folderByPath = new Map<string, ProjectTreeNode>();
  folderByPath.set("", root);

  // Ensure a folder node exists for `path`, creating ancestors as needed.
  const ensureFolder = (path: string): ProjectTreeNode => {
    const cached = folderByPath.get(path);
    if (cached) return cached;

    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const parent = ensureFolder(parentPath);

    const node: ProjectTreeNode = {
      path,
      name,
      type: "folder",
      children: [],
    };
    parent.children!.push(node);
    folderByPath.set(path, node);
    return node;
  };

  for (const file of files) {
    const segments = file.path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const parent = ensureFolder(parentPath);
    parent.children!.push({
      path: file.path,
      name,
      type: "file",
      kind: file.kind,
      size: file.size,
      extension: file.extension,
    });
  }

  // Recursive sort: folders first (alphabetical), then files (alphabetical).
  const sortRecursive = (node: ProjectTreeNode) => {
    if (!node.children) return;
    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    for (const child of node.children) sortRecursive(child);
  };
  sortRecursive(root);

  return root;
}

/* ------------------------------------------------------------------ */
/* Formatting helpers (used across UI components)                      */
/* ------------------------------------------------------------------ */

/** Format a byte count as a human-readable string, e.g. "12.4 KB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[unit]}`;
}

/**
 * Format an ISO timestamp as a relative "X minutes ago" / "X hours ago"
 * string. Falls back to a localized date for older timestamps.
 */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const now = Date.now();
  const diff = now - then;

  const sec = Math.round(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  // Older than a week — show the localized date.
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

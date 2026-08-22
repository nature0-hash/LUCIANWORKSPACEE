// IndexedDB-backed persistence layer.
//
// Architecture:
//   - `projects` store: Project metadata + lightweight file index (FileEntry[]).
//     Always loaded in full — small even for projects with 48k files
//     (each entry is ~80 bytes).
//   - `contents` store: per-file content keyed by `${projectId}:${path}`.
//     Loaded on demand only when the user opens a file.
//   - `versions` store: historical snapshots (full content copies).
//
// This separation is what lets the UI list 48k+ files without loading
// their contents into memory.

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Project, ProjectVersion } from "@/types/workspace";

const DB_NAME = "workspace-dev-db-v2";
const DB_VERSION = 2;
const PROJECTS_STORE = "projects";
const VERSIONS_STORE = "versions";
const CONTENTS_STORE = "contents";

interface WorkspaceDB extends DBSchema {
  [PROJECTS_STORE]: {
    key: string;
    value: Project;
  };
  [VERSIONS_STORE]: {
    key: string;
    value: ProjectVersion;
    indexes: { "by-project": string };
  };
  [CONTENTS_STORE]: {
    key: string;
    value: { key: string; content: string; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<WorkspaceDB>> | null = null;

function getDB() {
  if (typeof window === "undefined") {
    throw new Error("IndexedDB is only available in the browser");
  }
  if (!dbPromise) {
    dbPromise = openDB<WorkspaceDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, _newVersion, _transaction) {
        // v1 stores
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
            db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
          }
          if (!db.objectStoreNames.contains(VERSIONS_STORE)) {
            const store = db.createObjectStore(VERSIONS_STORE, { keyPath: "id" });
            store.createIndex("by-project", "projectId");
          }
        }
        // v2: add separate content store for lazy loading. Existing v1
        // projects stored inline content on each file; that data is left
        // in place (the user can re-import if needed). The new code path
        // expects content in the contents store, so old projects won't
        // display content until re-imported — that's an acceptable trade-off
        // for a major version bump.
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(CONTENTS_STORE)) {
            db.createObjectStore(CONTENTS_STORE, { keyPath: "key" });
          }
        }
      },
    });
  }
  return dbPromise;
}

export function contentKey(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}

// ---- Project CRUD --------------------------------------------------------

/** Return all live projects (excluding trashed), sorted newest-updated first. */
export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAll(PROJECTS_STORE);
  return all
    .filter((p) => p.trashedAt === null || p.trashedAt === undefined)
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Return all trashed projects, sorted by trash date (most recent first). */
export async function listTrashedProjects(): Promise<Project[]> {
  const db = await getDB();
  const all = await db.getAll(PROJECTS_STORE);
  return all
    .filter((p) => p.trashedAt !== null && p.trashedAt !== undefined)
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get(PROJECTS_STORE, id);
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  project.updatedAt = Date.now();
  await db.put(PROJECTS_STORE, project);
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(PROJECTS_STORE, id);
  // Cascade delete versions.
  const versions = await db.getAllFromIndex(VERSIONS_STORE, "by-project", id);
  const vTx = db.transaction(VERSIONS_STORE, "readwrite");
  await Promise.all(versions.map((v) => vTx.store.delete(v.id)));
  await vTx.done;
  // Cascade delete all file contents for this project.
  // We iterate over keys with prefix `${id}:` — IndexedDB doesn't have native
  // prefix queries, so we use a cursor range.
  const cTx = db.transaction(CONTENTS_STORE, "readwrite");
  const range = IDBKeyRange.bound(`${id}:`, `${id}:\uffff`);
  let cursor = await cTx.store.openCursor(range);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await cTx.done;
}

// ---- File content (lazy) -------------------------------------------------

export async function getFileContent(
  projectId: string,
  path: string,
): Promise<string | undefined> {
  const db = await getDB();
  const row = await db.get(CONTENTS_STORE, contentKey(projectId, path));
  return row?.content;
}

export async function setFileContent(
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  const db = await getDB();
  await db.put(CONTENTS_STORE, {
    key: contentKey(projectId, path),
    content,
    updatedAt: Date.now(),
  });
}

export async function deleteFileContent(projectId: string, path: string): Promise<void> {
  const db = await getDB();
  await db.delete(CONTENTS_STORE, contentKey(projectId, path));
}

/** Bulk-load contents for multiple files (used by Save Preview / Download ZIP). */
export async function getManyFileContents(
  projectId: string,
  paths: string[],
): Promise<Map<string, string>> {
  const db = await getDB();
  const result = new Map<string, string>();
  const tx = db.transaction(CONTENTS_STORE, "readonly");
  await Promise.all(
    paths.map(async (path) => {
      const row = await tx.store.get(contentKey(projectId, path));
      if (row) result.set(path, row.content);
    }),
  );
  return result;
}

/** Bulk-write contents (used by import). */
export async function setManyFileContents(
  projectId: string,
  entries: { path: string; content: string }[],
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(CONTENTS_STORE, "readwrite");
  const now = Date.now();
  await Promise.all(
    entries.map((e) =>
      tx.store.put({
        key: contentKey(projectId, e.path),
        content: e.content,
        updatedAt: now,
      }),
    ),
  );
  await tx.done;
}

/** Rename a file's content key. */
export async function renameFileContent(
  projectId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const db = await getDB();
  const old = await db.get(CONTENTS_STORE, contentKey(projectId, oldPath));
  if (old) {
    await db.delete(CONTENTS_STORE, contentKey(projectId, oldPath));
    await db.put(CONTENTS_STORE, {
      key: contentKey(projectId, newPath),
      content: old.content,
      updatedAt: Date.now(),
    });
  }
}

// ---- Version snapshots ---------------------------------------------------

export async function listVersions(projectId: string): Promise<ProjectVersion[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex(VERSIONS_STORE, "by-project", projectId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveVersion(version: ProjectVersion): Promise<void> {
  const db = await getDB();
  await db.put(VERSIONS_STORE, version);
}

export async function getVersion(versionId: string): Promise<ProjectVersion | undefined> {
  const db = await getDB();
  return db.get(VERSIONS_STORE, versionId);
}

export async function deleteVersion(versionId: string): Promise<void> {
  const db = await getDB();
  await db.delete(VERSIONS_STORE, versionId);
}

/** Estimated storage usage in bytes. */
export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return { usage: 0, quota: 0 };
  }
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

/**
 * Ask the browser to persist local storage so the user's projects survive
 * automatic eviction by the browser's LRU cleanup. Truthful: returns
 * `true` only when the browser actually grants persistence.
 *
 * Returns `{ supported: false }` when the API is unavailable.
 */
export async function requestPersistentStorage(): Promise<{
  supported: boolean;
  persisted: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return { supported: false, persisted: false };
  }
  const persisted = await navigator.storage.persist();
  return { supported: true, persisted };
}

/** Check whether storage is already persistent. */
export async function isStoragePersistent(): Promise<{
  supported: boolean;
  persisted: boolean;
}> {
  if (typeof navigator === "undefined" || !navigator.storage?.persisted) {
    return { supported: false, persisted: false };
  }
  const persisted = await navigator.storage.persisted();
  return { supported: true, persisted };
}

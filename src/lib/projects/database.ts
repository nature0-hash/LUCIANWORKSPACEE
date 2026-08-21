/**
 * IndexedDB wrapper for the Lucian Project Library.
 *
 * Storage layout
 * --------------
 * Two object stores, both created in the same DB:
 *
 *   `projects`       keyed by `id`           — Project metadata only
 *   `projectFiles`   keyed by `id`           — File contents + path
 *                    indexed by `projectId`  — fast per-project lookup
 *
 * Why split:
 *   Listing projects should not pull every file into memory. The UI only
 *   needs the rows in `projects` to render the project list; file rows are
 *   loaded lazily on the project detail page.
 *
 * Browser-only
 * ------------
 * All functions here touch `indexedDB` and must only be called from client
 * components. We guard against SSR by checking `typeof window`. The
 * database module is imported lazily via dynamic import in the few places
 * the server might evaluate the file (route components are "use client"
 * already, but defensive guards don't hurt).
 */
import type { Project, ProjectFile } from "./types";

const DB_NAME = "lucian-workspace";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_FILES = "projectFiles";

let dbPromise: Promise<IDBDatabase> | null = null;

/** Returns true if IndexedDB is available in the current context. */
export function isAvailable(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

/**
 * Open (and upgrade) the database. Reuses a single connection across calls.
 *
 * Schema is keyed by `DB_VERSION` so future migrations are explicit:
 *   v1: initial stores.
 */
export function openDatabase(): Promise<IDBDatabase> {
  if (!isAvailable()) {
    return Promise.reject(
      new Error("IndexedDB is not available in this environment.")
    );
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (event.oldVersion === 0 || !db.objectStoreNames.contains(STORE_PROJECTS)) {
        const projects = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        projects.createIndex("importedAt", "importedAt", { unique: false });
      }
      if (event.oldVersion === 0 || !db.objectStoreNames.contains(STORE_FILES)) {
        const files = db.createObjectStore(STORE_FILES, { keyPath: "id" });
        files.createIndex("projectId", "projectId", { unique: false });
        files.createIndex("path", "path", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Failed to open IndexedDB."));
    request.onblocked = () =>
      reject(
        new Error(
          "IndexedDB upgrade blocked. Please close other tabs of Lucian Workspace and try again."
        )
      );
  });

  return dbPromise;
}

/** Run a transaction against the named stores. Resolves when the tx completes. */
async function withStores<T>(
  mode: IDBTransactionMode,
  stores: string[],
  fn: (tx: IDBTransaction) => T | Promise<T>
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
    Promise.resolve(fn(tx))
      .then((r) => {
        result = r as T;
      })
      .catch((err) => {
        try {
          tx.abort();
        } catch {
          /* ignore */
        }
        reject(err);
      });
  });
}

/** Promisify a single IDBRequest so we can `await` it. */
function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

/** Return all projects, sorted by `importedAt` descending (newest first). */
export async function listProjects(): Promise<Project[]> {
  return withStores("readonly", [STORE_PROJECTS], (tx) => {
    const store = tx.objectStore(STORE_PROJECTS);
    return awaitRequest(store.getAll() as IDBRequest<Project[]>);
  }).then((rows) =>
    rows.sort(
      (a, b) =>
        new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
    )
  );
}

/** Get a single project by id, or null if it doesn't exist. */
export async function getProject(id: string): Promise<Project | null> {
  const result = await withStores("readonly", [STORE_PROJECTS], (tx) => {
    const store = tx.objectStore(STORE_PROJECTS);
    return awaitRequest(store.get(id) as IDBRequest<Project | undefined>);
  });
  return result ?? null;
}

/** Persist (insert or replace) a project row. */
export async function putProject(project: Project): Promise<void> {
  await withStores("readwrite", [STORE_PROJECTS], (tx) => {
    const store = tx.objectStore(STORE_PROJECTS);
    store.put(project);
    return undefined;
  });
}

/** Delete a project row. Does NOT delete files — see `deleteProjectAndFiles`. */
export async function deleteProjectRow(id: string): Promise<void> {
  await withStores("readwrite", [STORE_PROJECTS], (tx) => {
    tx.objectStore(STORE_PROJECTS).delete(id);
    return undefined;
  });
}

/* ------------------------------------------------------------------ */
/* Project files                                                      */
/* ------------------------------------------------------------------ */

/** Return all files for a given project, sorted by path ascending. */
export async function listFilesForProject(projectId: string): Promise<ProjectFile[]> {
  const rows = await withStores("readonly", [STORE_FILES], (tx) => {
    const store = tx.objectStore(STORE_FILES);
    const index = store.index("projectId");
    return awaitRequest(index.getAll(projectId) as IDBRequest<ProjectFile[]>);
  });
  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

/** Get a single file by id. */
export async function getFile(id: string): Promise<ProjectFile | null> {
  const result = await withStores("readonly", [STORE_FILES], (tx) => {
    const store = tx.objectStore(STORE_FILES);
    return awaitRequest(store.get(id) as IDBRequest<ProjectFile | undefined>);
  });
  return result ?? null;
}

/** Persist a batch of files atomically (single transaction). */
export async function putFiles(files: ProjectFile[]): Promise<void> {
  await withStores("readwrite", [STORE_FILES], (tx) => {
    const store = tx.objectStore(STORE_FILES);
    for (const f of files) store.put(f);
    return undefined;
  });
}

/** Delete all files for a project (used by deleteProjectAndFiles). */
export async function deleteFilesForProject(projectId: string): Promise<void> {
  await withStores("readwrite", [STORE_FILES], (tx) => {
    const store = tx.objectStore(STORE_FILES);
    const index = store.index("projectId");
    // openKeyCursor is the right primitive here — we only need keys.
    const request = index.openKeyCursor();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/* ------------------------------------------------------------------ */
/* Composite operations                                                */
/* ------------------------------------------------------------------ */

/**
 * Delete a project AND every file row that belongs to it, atomically.
 *
 * Both stores are mutated in a single transaction so the database is never
 * left in a half-deleted state.
 */
export async function deleteProjectAndFiles(projectId: string): Promise<void> {
  await withStores("readwrite", [STORE_PROJECTS, STORE_FILES], (tx) => {
    tx.objectStore(STORE_PROJECTS).delete(projectId);
    const files = tx.objectStore(STORE_FILES);
    const index = files.index("projectId");
    const request = index.openKeyCursor();
    return new Promise<void>((resolve, reject) => {
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          files.delete(cursor.primaryKey);
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}

/**
 * Insert a project together with its files in a single transaction.
 *
 * Used by the ZIP import flow. If the file write phase fails, the entire
 * operation is rolled back — no half-created project remains.
 */
export async function insertProjectWithFiles(
  project: Project,
  files: ProjectFile[]
): Promise<void> {
  await withStores("readwrite", [STORE_PROJECTS, STORE_FILES], (tx) => {
    tx.objectStore(STORE_PROJECTS).put(project);
    const fileStore = tx.objectStore(STORE_FILES);
    for (const f of files) fileStore.put(f);
    return undefined;
  });
}

/**
 * Best-effort estimate of how much storage Lucian is using.
 *
 * Returns null when the Storage API is unavailable (older browsers).
 * Used by the import flow to fail early when the user is clearly out of
 * space — IndexedDB write errors are still the source of truth.
 */
export async function estimateStorage(): Promise<{
  usage: number;
  quota: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
    return null;
  }
  const est = await navigator.storage.estimate();
  return { usage: est.usage ?? 0, quota: est.quota ?? 0 };
}

/**
 * Real client-side ZIP import using fflate.
 *
 * Flow:
 *   1. readZip(file)            — read the File into a Uint8Array
 *   2. unzip(archive)           — fflate decompresses the whole archive
 *   3. normalizeEntries(paths) — strip the optional top-level folder,
 *                                 drop __MACOSX/.DS_Store, and reject
 *                                 path-traversal attempts
 *   4. classify(entries)        — split text vs binary, compute metadata
 *   5. buildProject(...)        — assemble a Project + ProjectFile[] batch
 *
 * Path safety:
 *   - Any entry containing ".." as a path segment is rejected.
 *   - Absolute paths (leading "/") are made relative.
 *   - Windows drive prefixes ("C:\\") are stripped.
 *   - The optional single top-level folder is unwrapped so the imported
 *     project root contains its actual files, not a redundant wrapper.
 *
 * The unzip itself happens in a Web Worker when fflate is configured to use
 * one, but for our entry counts (typically hundreds to low thousands of
 * files) the synchronous path on the main thread is fast enough — fflate's
 * async `unzip` returns a Promise and uses requestAnimationFrame to chunk
 * the work, so the UI does not freeze.
 */
import { unzip } from "fflate";
import type {
  FileKind,
  ProjectFile,
  ProjectImportResult,
} from "./types";
import {
  classifyFramework,
  pickProjectName,
} from "./framework-detection";

/** Standard ZIP entries that are pure OS / archive noise — skipped silently. */
const NOISE_PREFIXES = ["__MACOSX/", "._"];
const NOISE_FILES = new Set([".DS_Store", "Thumbs.db", "ehthumbs.db"]);

/**
 * Directories fflate does not return as explicit entries but which we
 * surface as a warning if they are present in the ZIP, since we deliberately
 * skip them (they would balloon storage with no inspection value at this
 * phase — they are regenerable from `package.json` anyway).
 */
const SKIP_DIRECTORY_PREFIXES = ["node_modules/"];

/**
 * Read a browser File into a Uint8Array.
 *
 * This is the only part of the import flow that touches the File API; the
 * rest is pure data manipulation that could in principle run anywhere.
 */
export function readZipFile(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read the selected file."));
      }
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Failed to read the file."));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Decompress a ZIP archive into a map of { path: bytes }.
 *
 * fflate's `unzip` is async, but it shares the main thread — large archives
 * may take noticeable time. The progress callback receives the count of
 * entries decoded so far, but fflate does not expose per-entry progress,
 * so we report an indeterminate `extracting` state to the UI.
 */
export function decompressZip(
  archive: Uint8Array
): Promise<Record<string, Uint8Array>> {
  return new Promise((resolve, reject) => {
    unzip(archive, (err, unzipped) => {
      if (err) {
        reject(
          new Error(
            "This file could not be unzipped. It may be corrupted or use an unsupported format."
          )
        );
        return;
      }
      resolve(unzipped);
    });
  });
}

/**
 * Sanitize a single ZIP entry path.
 *
 * Returns null when the entry should be skipped (noise, directory marker,
 * unsafe path). Otherwise returns a normalized POSIX-style path with no
 * leading slash, no `..` segments, and no backslashes.
 */
function normalizePath(rawPath: string): string | null {
  // ZIP spec uses forward slashes, but Windows-created archives sometimes
  // use backslashes. Normalize to forward slashes first.
  let path = rawPath.replace(/\\/g, "/");

  // Strip Windows drive prefix like "C:/..."
  path = path.replace(/^[a-zA-Z]:/, "");

  // Strip leading slashes — we never import absolute paths.
  path = path.replace(/^\/+/, "");

  // Reject parent-directory segments outright — they would let a malicious
  // archive escape the logical project root.
  const segments = path.split("/");
  if (segments.some((seg) => seg === "..")) {
    return null;
  }

  // Normalize empty segments (consecutive slashes) away.
  const cleaned = segments.filter((seg) => seg.length > 0);

  // fflate emits explicit directory entries with a trailing slash. We do
  // not store directories — they are reconstructed from file paths when
  // building the tree. Skip them.
  if (rawPath.endsWith("/")) {
    return null;
  }

  if (cleaned.length === 0) return null;
  return cleaned.join("/");
}

/** Determine if an entry path is noise we should silently skip. */
function isNoise(path: string): boolean {
  if (NOISE_FILES.has(path.split("/").pop() ?? "")) return true;
  return NOISE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/** True if the path lives inside a directory we deliberately skip. */
function isSkippedDirectory(path: string): boolean {
  return SKIP_DIRECTORY_PREFIXES.some((prefix) =>
    path.startsWith(prefix)
  );
}

/**
 * Determine the project's logical root by detecting whether all entries
 * share a single top-level folder (e.g. "my-app/src/page.tsx").
 *
 * If they do, return that prefix so we can strip it from each path. If the
 * ZIP is flat (no common parent), return "".
 *
 * Edge case: if exactly one top-level entry exists AND it is itself a
 * directory (i.e. all entries live under it), we treat that as the wrapper
 * folder and strip it. If multiple top-level entries exist, we leave them
 * as-is — the user is importing a multi-root archive and the project root
 * is the archive root.
 */
function detectWrapperFolder(paths: string[]): string {
  if (paths.length === 0) return "";

  const topSegments = new Set<string>();
  for (const path of paths) {
    const slash = path.indexOf("/");
    if (slash === -1) {
      // A file at the root — no wrapper possible.
      return "";
    }
    topSegments.add(path.slice(0, slash));
    if (topSegments.size > 1) return "";
  }
  if (topSegments.size === 1) {
    const candidate = [...topSegments][0];
    return `${candidate}/`;
  }
  return "";
}

/** Lower-cased extension without the dot, e.g. "tsx", "md". May be "". */
function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  if (dot === -1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

/** Coarse content kind, used by the tree icon + preview picker. */
function classifyFile(name: string, bytes: Uint8Array): FileKind {
  const ext = extensionOf(name);
  if (ext === "json") return "json";
  if (ext === "md" || ext === "markdown") return "markdown";
  if (
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "json",
      "md",
      "markdown",
      "txt",
      "css",
      "scss",
      "sass",
      "html",
      "htm",
      "xml",
      "yml",
      "yaml",
      "toml",
      "ini",
      "env",
      "sh",
      "bash",
      "zsh",
      "py",
      "rb",
      "go",
      "rs",
      "java",
      "kt",
      "swift",
      "c",
      "h",
      "cpp",
      "hpp",
      "cs",
      "php",
      "vue",
      "svelte",
      "astro",
      "graphql",
      "gql",
      "dockerfile",
      "gitignore",
      "npmrc",
      "prettierrc",
      "eslintrc",
    ].includes(ext)
  ) {
    return "text";
  }
  // Heuristic: if the first 1KB contains a NUL byte, treat as binary.
  // This catches images, archives, fonts, executables reliably.
  const sampleLen = Math.min(bytes.length, 1024);
  for (let i = 0; i < sampleLen; i++) {
    if (bytes[i] === 0) return "binary";
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"].includes(ext)) {
    return "image";
  }
  return "unknown";
}

/**
 * Decode a Uint8Array as UTF-8 text.
 *
 * Uses TextDecoder when available (it is, in every modern browser); the
 * `fatal: false` option means invalid UTF-8 gets replacement characters
 * instead of throwing — which is fine for read-only preview.
 */
function decodeText(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

/** Build the canonical ProjectFile.id from projectId + path. */
function fileRowId(projectId: string, path: string): string {
  return `${projectId}::${path}`;
}

/**
 * Convert a raw ZIP entry into a normalized import result entry.
 *
 * Returns null for entries we want to skip silently. Returns `{ skipped: true }`
 * for entries we want to count toward the "node_modules was excluded"
 * warning but not actually store.
 */
interface NormalizedEntry {
  path: string;
  name: string;
  parentPath: string;
  size: number;
  kind: FileKind;
  extension: string;
  bytes: Uint8Array;
  skippedBecauseSkippedDir?: boolean;
}

function normalizeEntries(
  raw: Record<string, Uint8Array>
): { entries: NormalizedEntry[]; skippedDirCount: number } {
  const out: NormalizedEntry[] = [];
  let skippedDirCount = 0;

  for (const [rawPath, bytes] of Object.entries(raw)) {
    const path = normalizePath(rawPath);
    if (path === null) continue;
    if (isNoise(path)) continue;
    if (isSkippedDirectory(path)) {
      skippedDirCount++;
      continue;
    }

    const segments = path.split("/");
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join("/");
    const kind = classifyFile(name, bytes);
    out.push({
      path,
      name,
      parentPath,
      size: bytes.byteLength,
      kind,
      extension: extensionOf(name),
      bytes,
    });
  }

  out.sort((a, b) => a.path.localeCompare(b.path));
  return { entries: out, skippedDirCount };
}

/**
 * Build a ProjectImportResult from a raw unzip output + the original file
 * name (used as a fallback for the project name).
 *
 * The result is pure data — no IndexedDB interaction happens here. The
 * caller (project-service) is responsible for persisting the result.
 */
export function buildImportResult(
  rawEntries: Record<string, Uint8Array>,
  zipFileName: string
): ProjectImportResult {
  // Edge case: completely empty archive.
  if (Object.keys(rawEntries).length === 0) {
    throw new Error("The selected ZIP is empty.");
  }

  const { entries, skippedDirCount } = normalizeEntries(rawEntries);
  if (entries.length === 0) {
    throw new Error(
      "The selected ZIP did not contain any importable project files."
    );
  }

  // Strip the wrapper folder from each entry path so the project root
  // contains the actual project files directly.
  const wrapper = detectWrapperFolder(entries.map((e) => e.path));

  const rootFolderName = wrapper ? wrapper.slice(0, -1) : "";

  // Look for package.json at the project root (post-wrapper-strip) — this
  // drives framework detection and the project name fallback.
  const rootPrefix = wrapper;
  const packageJsonEntry = entries.find(
    (e) => e.path === `${rootPrefix}package.json`
  );
  let packageJson: Record<string, unknown> | null = null;
  if (packageJsonEntry) {
    try {
      packageJson = JSON.parse(decodeText(packageJsonEntry.bytes));
    } catch {
      // Malformed package.json — we ignore and let detection fall through.
    }
  }

  const detectedFramework = classifyFramework(
    entries.map((e) => e.path),
    packageJson
  );

  const projectName = pickProjectName(
    rootFolderName,
    packageJson,
    zipFileName
  );

  // Build the final file list with wrapper-stripped paths.
  const files: Omit<ProjectFile, "id" | "projectId" | "importedAt">[] =
    entries.map((entry) => {
      const strippedPath = entry.path.slice(rootPrefix.length);
      const strippedParent = entry.parentPath.slice(rootPrefix.length);
      return {
        path: strippedPath,
        name: entry.name,
        parentPath: strippedParent,
        type: "file" as const,
        size: entry.size,
        kind: entry.kind,
        extension: entry.extension,
        // Text files are stored as strings (cheaper to read later, and avoids
        // a Blob round-trip for the most common preview case). Binary files
        // are stored as Blobs — IndexedDB handles Blob values natively and
        // they are not counted against the structured-clone size limits
        // the way large typed arrays can be.
        content:
          entry.kind === "text" ||
          entry.kind === "json" ||
          entry.kind === "markdown"
            ? decodeText(entry.bytes)
            : new Blob([entry.bytes.slice()]),
      };
    });

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  const warning =
    skippedDirCount > 0
      ? `${skippedDirCount} file(s) inside node_modules/ were skipped to save storage. They can always be regenerated by running \`npm install\` later.`
      : null;

  return {
    project: {
      name: projectName,
      rootFolderName,
      sourceType: "zip" as const,
      detectedFramework,
      fileCount: files.length,
      totalSize,
      importWarning: warning,
    },
    files,
    warning,
  };
}

/**
 * Top-level convenience: given a browser File, decompress + build the
 * import result. Used by the UI; the actual persistence step is done by
 * `projectService.persistImportResult`.
 */
export async function parseZipFile(file: File): Promise<ProjectImportResult> {
  const archive = await readZipFile(file);
  const entries = await decompressZip(archive);
  return buildImportResult(entries, file.name);
}

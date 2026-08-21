// ZIP import and export utilities backed by JSZip.
// Smart import filters skip node_modules, .next, build, dist, .git, etc.
// File content is written to the separate `contents` store in IndexedDB so
// the project metadata stays small enough to load instantly even for very
// large projects.

import JSZip from "jszip";
import type { FileEntry, Project, ProjectFile } from "@/types/workspace";
import {
  BINARY_EXTENSIONS,
  detectFramework,
  getExtension,
  getSkippedDirs,
  isImageFile,
  shouldIgnorePath,
  totalSize as sumSize,
} from "./filesystem";
import {
  setManyFileContents,
  contentKey,
} from "./db";

/** Generate a short unique id. */
export function newId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Create an empty project shell. */
export function createEmptyProject(name: string, description = ""): Project {
  const now = Date.now();
  return {
    id: newId("prj"),
    name: name.trim() || "Untitled Project",
    description,
    createdAt: now,
    updatedAt: now,
    files: [],
    framework: "unknown",
    envVars: [],
    tags: [],
    fileCount: 0,
    totalSize: 0,
    skippedDirs: [],
  };
}

/** Parsed result of a ZIP / folder import: metadata + contents to write. */
export interface ImportResult {
  entries: FileEntry[];
  contents: { path: string; content: string }[];
  skippedDirs: string[];
}

/**
 * Detect whether all paths share a single common top-level folder, and if so,
 * return that folder name. This handles GitHub-style ZIPs (which wrap
 * everything in `<repo-name>/...`) and folder imports where the selected
 * folder name becomes a prefix on every path.
 *
 *   ["bring-main/index.html", "bring-main/src/App.tsx"] → "bring-main"
 *   ["src/App.tsx", "package.json"]                    → null
 *   []                                                  → null
 *
 * We skip top-level files (paths with no `/`) when making this determination,
 * because a project that genuinely has a top-level file alongside a single
 * top-level folder (e.g. ["README.md", "src/App.tsx"]) should NOT have the
 * folder stripped — that would be wrong.
 */
export function detectWrappingFolder(paths: string[]): string | null {
  if (paths.length === 0) return null;
  let first: string | null = null;
  for (const p of paths) {
    const idx = p.indexOf("/");
    if (idx === -1) {
      // Top-level file present → mixed structure, no wrapping folder.
      return null;
    }
    const seg = p.slice(0, idx);
    if (first === null) first = seg;
    else if (seg !== first) return null;
  }
  return first;
}

/**
 * Strip the wrapping folder prefix from a path. Returns the unchanged path
 * if it doesn't start with the prefix.
 */
function stripPrefix(path: string, prefix: string | null): string {
  if (!prefix) return path;
  const p = `${prefix}/`;
  return path.startsWith(p) ? path.slice(p.length) : path;
}

/**
 * Parse an uploaded ZIP file into a list of file entries + contents.
 * Skips node_modules, .next, build, dist, .git, etc. by default.
 */
export async function importZipToFiles(file: File | ArrayBuffer): Promise<ImportResult> {
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buffer);
  const entries: FileEntry[] = [];
  const contents: { path: string; content: string }[] = [];
  const skippedDirs = new Set<string>();

  const zipEntries = Object.values(zip.files).filter((e) => !e.dir);

  // First pass: collect raw paths (after stripping leading "/") so we can
  // detect a single wrapping folder. We need to do this BEFORE stripping
  // the prefix, because the wrapping folder is the prefix.
  const rawPaths: string[] = [];
  for (const entry of zipEntries) {
    const path = entry.name.replace(/^\//, "");
    if (!path) continue;
    if (path.includes("__MACOSX") || path.endsWith(".DS_Store")) continue;
    rawPaths.push(path);
  }
  const wrappingFolder = detectWrappingFolder(rawPaths);

  for (const entry of zipEntries) {
    let path = entry.name.replace(/^\//, "");
    if (!path) continue;
    // Strip the wrapping folder if one was detected (GitHub-style ZIP).
    path = stripPrefix(path, wrappingFolder);
    // Detect skipped directories for reporting (use the post-strip path so
    // e.g. "bring-main/node_modules/..." still reports "node_modules").
    for (const d of getSkippedDirs(path)) skippedDirs.add(d);
    if (shouldIgnorePath(path)) continue;
    // Also skip __MACOSX junk.
    if (path.includes("__MACOSX") || path.endsWith(".DS_Store")) continue;

    const ext = getExtension(path);
    const isBinary = BINARY_EXTENSIONS.has(ext) || isImageFile(path);

    if (isBinary) {
      const bytes = await entry.async("uint8array");
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const base64 = btoa(binary);
      const mime = guessMime(ext);
      const dataUrl = `data:${mime};base64,${base64}`;
      entries.push({
        path,
        binary: true,
        mime,
        size: bytes.length,
        updatedAt: Date.now(),
        loaded: true,
      });
      contents.push({ path, content: dataUrl });
    } else {
      const text = await entry.async("text");
      entries.push({
        path,
        binary: false,
        size: new TextEncoder().encode(text).length,
        updatedAt: Date.now(),
        loaded: true,
      });
      contents.push({ path, content: text });
    }
  }

  return { entries, contents, skippedDirs: Array.from(skippedDirs) };
}

/**
 * Import a folder selected via the File System Access API or
 * an <input type="file" webkitdirectory> file list. Skips the same
 * ignored directories as ZIP import.
 */
export async function importFolderToFiles(fileList: FileList | File[]): Promise<ImportResult> {
  const files = Array.from(fileList);
  const entries: FileEntry[] = [];
  const contents: { path: string; content: string }[] = [];
  const skippedDirs = new Set<string>();

  // First pass: collect raw relative paths so we can detect a single
  // wrapping folder. With <input webkitdirectory>, the browser prepends the
  // selected folder name to every path — we want to strip it. But we use
  // detectWrappingFolder() rather than blindly stripping the first segment,
  // so that edge cases (e.g. the user selected a folder containing loose
  // files alongside subfolders) are handled correctly.
  const rawPaths: string[] = [];
  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    if (!relative) continue;
    rawPaths.push(relative);
  }
  const wrappingFolder = detectWrappingFolder(rawPaths);

  for (const file of files) {
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    // Strip the wrapping folder if one was detected.
    let path = stripPrefix(relative, wrappingFolder);
    if (!path) continue;

    for (const d of getSkippedDirs(path)) skippedDirs.add(d);
    if (shouldIgnorePath(path)) continue;

    const ext = getExtension(path);
    const isBinary = BINARY_EXTENSIONS.has(ext) || isImageFile(path);

    if (isBinary) {
      const buffer = await file.arrayBuffer();
      const base64 = bytesToBase64(buffer);
      const mime = file.type || guessMime(ext);
      const dataUrl = `data:${mime};base64,${base64}`;
      entries.push({
        path,
        binary: true,
        mime,
        size: buffer.byteLength,
        updatedAt: Date.now(),
        loaded: true,
      });
      contents.push({ path, content: dataUrl });
    } else {
      const text = await file.text();
      entries.push({
        path,
        binary: false,
        size: new TextEncoder().encode(text).length,
        updatedAt: Date.now(),
        loaded: true,
      });
      contents.push({ path, content: text });
    }
  }

  return { entries, contents, skippedDirs: Array.from(skippedDirs) };
}

/** Export a project's files into a ZIP Blob. Accepts full ProjectFile[]
 *  (for history snapshots) or entries + a content map (for live projects). */
export async function exportProjectToZip(
  files: ProjectFile[],
  projectName: string,
): Promise<Blob> {
  const zip = new JSZip();
  const safeName = projectName.replace(/[^a-z0-9-_]/gi, "_") || "project";

  for (const file of files) {
    if (file.binary) {
      const base64 = file.content.split(",")[1] ?? "";
      zip.file(file.path, base64, { base64: true, binary: true });
    } else {
      zip.file(file.path, file.content);
    }
  }

  // If the project is empty, add a README so the zip is never empty.
  if (files.length === 0) {
    zip.file("README.md", `# ${safeName}\n\nThis project is empty.\n`);
  }

  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

function guessMime(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    bmp: "image/bmp",
    avif: "image/avif",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return map[ext] ?? "application/octet-stream";
}

function bytesToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Wrap raw imported files into a fully-formed Project and persist content. */
export async function buildProjectFromImport(
  name: string,
  importResult: ImportResult,
): Promise<Project> {
  const now = Date.now();
  const { entries, contents, skippedDirs } = importResult;

  // Persist file contents to the contents store so the project metadata
  // stays small enough to load instantly.
  const projectId = newId("prj");
  await setManyFileContents(projectId, contents);

  return {
    id: projectId,
    name: name.trim() || "Imported Project",
    description: "",
    createdAt: now,
    updatedAt: now,
    files: entries,
    framework: detectFramework(entries),
    envVars: [],
    tags: [],
    fileCount: entries.length,
    totalSize: sumSize(entries),
    skippedDirs,
  };
}

// Re-export for backwards compatibility with components that call
// buildProjectFromFiles — now routes through buildProjectFromImport
// with an empty content list (used only by createEmptyProject).
export async function buildProjectFromFiles(name: string, files: ProjectFile[]): Promise<Project> {
  const now = Date.now();
  const projectId = newId("prj");
  await setManyFileContents(
    projectId,
    files.map((f) => ({ path: f.path, content: f.content })),
  );
  const entries: FileEntry[] = files.map((f) => ({
    path: f.path,
    binary: f.binary,
    mime: f.mime,
    size: f.size,
    updatedAt: f.updatedAt,
    loaded: true,
  }));
  return {
    id: projectId,
    name: name.trim() || "Imported Project",
    description: "",
    createdAt: now,
    updatedAt: now,
    files: entries,
    framework: detectFramework(entries),
    envVars: [],
    tags: [],
    fileCount: entries.length,
    totalSize: sumSize(entries),
    skippedDirs: [],
  };
}

// ---------------------------------------------------------------------------
// Sample seed projects — used to make the library feel alive on first run.
// Each builder returns a Project whose files have inline content AND a
// matching contents[] array for persistence to the contents store.
// ---------------------------------------------------------------------------

export interface SampleProject extends Project {
  /** Inline content for each file, to be persisted via setManyFileContents. */
  inlineContents: { path: string; content: string }[];
}

export function buildSampleReactProject(): SampleProject {
  const now = Date.now();
  const inlineContents = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: "sample-react-counter",
          private: true,
          version: "0.1.0",
          dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
        },
        null,
        2,
      ),
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sample React Counter</title>
    <style>
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: grid; place-items: center; }
      .card { background: white; padding: 3rem 4rem; border-radius: 24px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4); text-align: center; }
      h1 { margin: 0 0 1rem; color: #2d3748; font-size: 2rem; }
      .count { font-size: 5rem; font-weight: 800; color: #667eea; margin: 1rem 0; transition: transform 0.15s ease; }
      .count:active { transform: scale(0.92); }
      button { background: #667eea; color: white; border: none; padding: 0.75rem 1.5rem; font-size: 1rem; border-radius: 12px; cursor: pointer; margin: 0 0.5rem; transition: background 0.15s; font-weight: 600; }
      button:hover { background: #5568d3; }
      button.reset { background: #e53e3e; }
      button.reset:hover { background: #c53030; }
      p { color: #718096; margin-top: 1.5rem; }
    </style>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`,
    },
    {
      path: "App.jsx",
      content: `export default function App() {
  const [count, setCount] = React.useState(0);
  return (
    <div className="card">
      <h1>React Counter</h1>
      <div className="count">{count}</div>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button className="reset" onClick={() => setCount(0)}>Reset</button>
      <p>Edit App.jsx and hit Save — the preview will reload.</p>
    </div>
  );
}
`,
    },
  ];
  const entries: FileEntry[] = inlineContents.map((c) => ({
    path: c.path,
    binary: false,
    size: new TextEncoder().encode(c.content).length,
    updatedAt: now,
    loaded: false,
  }));
  return {
    id: newId("prj"),
    name: "Sample React Counter",
    description: "A minimal React counter demonstrating live preview with Babel transpilation.",
    createdAt: now,
    updatedAt: now,
    files: entries,
    framework: detectFramework(entries),
    envVars: [],
    tags: ["sample", "react"],
    fileCount: entries.length,
    totalSize: sumSize(entries),
    skippedDirs: [],
    inlineContents,
  };
}

export function buildSampleHtmlProject(): SampleProject {
  const now = Date.now();
  const inlineContents = [
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Coming Soon</title>
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <main class="wrap">
      <h1>We're launching soon</h1>
      <p class="tag">Something amazing is on the way. Stay tuned.</p>
      <form onsubmit="event.preventDefault(); alert('Thanks! We will notify you at ' + this.email.value);">
        <input type="email" name="email" placeholder="you@example.com" required />
        <button type="submit">Notify me</button>
      </form>
      <div class="progress"><div class="bar"></div></div>
    </main>
    <script src="./script.js"></script>
  </body>
</html>
`,
    },
    {
      path: "styles.css",
      content: `* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: radial-gradient(circle at 30% 20%, #ff9a9e 0%, #fad0c4 50%, #fbc2eb 100%);
  min-height: 100vh; display: grid; place-items: center; color: #2d3748;
}
.wrap {
  background: rgba(255,255,255,0.85); backdrop-filter: blur(20px);
  padding: 3rem; border-radius: 28px; text-align: center;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15); max-width: 480px; width: 90%;
}
h1 { font-size: 2.5rem; margin-bottom: 0.5rem; background: linear-gradient(90deg, #667eea, #764ba2); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.tag { color: #718096; margin-bottom: 2rem; font-size: 1.05rem; }
form { display: flex; gap: 0.5rem; margin-bottom: 2rem; }
input { flex: 1; padding: 0.85rem 1rem; border: 2px solid #e2e8f0; border-radius: 12px; font-size: 1rem; outline: none; transition: border-color 0.15s; }
input:focus { border-color: #667eea; }
button { background: #667eea; color: white; border: none; padding: 0.85rem 1.5rem; border-radius: 12px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: transform 0.15s, background 0.15s; }
button:hover { background: #5568d3; transform: translateY(-2px); }
.progress { height: 6px; background: #e2e8f0; border-radius: 999px; overflow: hidden; }
.bar { height: 100%; width: 65%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 999px; animation: pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
`,
    },
    {
      path: "script.js",
      content: `// Welcome! Edit this file and the preview will update.
console.log("Coming Soon page loaded.");
document.querySelectorAll("button").forEach((b) =>
  b.addEventListener("mouseenter", () => (b.style.transform = "scale(1.05)")),
);
`,
    },
  ];
  const entries: FileEntry[] = inlineContents.map((c) => ({
    path: c.path,
    binary: false,
    size: new TextEncoder().encode(c.content).length,
    updatedAt: now,
    loaded: false,
  }));
  return {
    id: newId("prj"),
    name: "Coming Soon Landing",
    description: "Static HTML + CSS + JS landing page with gradient hero.",
    createdAt: now,
    updatedAt: now,
    files: entries,
    framework: detectFramework(entries),
    envVars: [],
    tags: ["sample", "html"],
    fileCount: entries.length,
    totalSize: sumSize(entries),
    skippedDirs: [],
    inlineContents,
  };
}

// Re-export contentKey for components that need it.
export { contentKey };

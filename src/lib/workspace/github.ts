"use client";

// Client-side GitHub repo import — no server proxy, no token required.
//
// Public repositories can be downloaded as a tarball/zipball directly from
// codeload.github.com. This module fetches the archive in the browser,
// unwraps the "owner-repo-sha/" wrapper folder, and feeds the result into
// the same ZIP importer that handles user-uploaded ZIPs.
//
// For private repositories the user would need a GitHub PAT — left for a
// later phase. This module surfaces a clear error in that case.

import JSZip from "jszip";
import { importZipToFiles, type ImportResult } from "./project";

export interface GitHubImportResult extends ImportResult {
  repoName: string;
  branch: string;
}

/**
 * Parse a GitHub URL into owner, repo, optional subdir, and optional branch.
 *
 * Supports:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo/tree/main
 *   https://github.com/owner/repo/tree/main/subdir
 *   https://github.com/owner/repo.git
 */
function parseGitHubUrl(
  url: string,
): { owner: string; repo: string; subdir: string; branch: string | null } | null {
  try {
    const u = new URL(url.trim());
    if (u.hostname !== "github.com" && u.hostname !== "www.github.com") return null;
    // Path: /owner/repo[/tree/branch[/subdir/...]]
    const parts = u.pathname.replace(/\.git$/, "").split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const [owner, repo, kind, branch, ...rest] = parts;
    if (kind === "tree" && branch) {
      return { owner, repo, subdir: rest.join("/"), branch };
    }
    return { owner, repo, subdir: "", branch: null };
  } catch {
    return null;
  }
}

/** Build the codeload URL for the default branch (or a specified branch). */
function buildArchiveUrl(
  owner: string,
  repo: string,
  branch: string | null,
): string {
  // We try HEAD (default branch) first if no branch specified — codeload
  // supports /zip/refs/heads/HEAD since GitHub added it. If that fails,
  // callers should retry with "main" or "master".
  const ref = branch ?? "HEAD";
  return `https://codeload.github.com/${owner}/${repo}/zip/refs/heads/${ref}`;
}

/**
 * Import a GitHub repository as a LUCIAN project.
 *
 * @param url GitHub URL (https://github.com/owner/repo[/tree/branch[/subdir]])
 * @param _token Reserved for future private-repo support. Currently unused.
 */
export async function importFromGitHub(
  url: string,
  _token?: string,
): Promise<GitHubImportResult> {
  const parsed = parseGitHubUrl(url);
  if (!parsed) {
    throw new Error(
      "Invalid GitHub URL. Use the form https://github.com/owner/repo or https://github.com/owner/repo/tree/branch/subdir.",
    );
  }
  const { owner, repo, subdir, branch } = parsed;

  // Fetch the ZIP archive directly from codeload.github.com.
  // Note: COEP: require-corp requires the response to send CORP headers.
  // GitHub's codeload responses do NOT send CORP — so under COEP this fetch
  // will fail with a CORS/CORP error. We catch that and surface a clean
  // message telling the user to upload the ZIP manually.
  let buffer: ArrayBuffer;
  let actualBranch = branch ?? "main";
  try {
    const res = await fetch(buildArchiveUrl(owner, repo, branch));
    if (!res.ok) {
      // Try a few common default-branch names if "HEAD" failed.
      if (!branch) {
        for (const candidate of ["main", "master"]) {
          const r2 = await fetch(buildArchiveUrl(owner, repo, candidate));
          if (r2.ok) {
            actualBranch = candidate;
            buffer = await r2.arrayBuffer();
            return await finalizeImport(buffer, owner, repo, actualBranch, subdir);
          }
        }
      }
      throw new Error(
        `GitHub returned ${res.status} ${res.statusText}. The repository may be private, deleted, or the branch does not exist.`,
      );
    }
    buffer = await res.arrayBuffer();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("failed to fetch") || msg.toLowerCase().includes("cors") || msg.toLowerCase().includes("corp")) {
      throw new Error(
        "Cannot fetch the GitHub archive directly from the browser. Cross-origin isolation (COEP) blocks requests that don't send CORP headers. Download the repository as a ZIP from github.com and use Import ZIP instead.",
      );
    }
    throw new Error(`Failed to download the repository: ${msg}`);
  }

  return await finalizeImport(buffer, owner, repo, actualBranch, subdir);
}

async function finalizeImport(
  buffer: ArrayBuffer,
  owner: string,
  repo: string,
  branch: string,
  subdir: string,
): Promise<GitHubImportResult> {
  // Re-pack the archive without the wrapper folder so paths are clean.
  const zip = await JSZip.loadAsync(buffer);
  const repacked = new JSZip();
  const names = Object.keys(zip.files);
  if (names.length === 0) {
    throw new Error("Repository archive was empty.");
  }
  // Find the wrapper prefix (first path segment shared by all entries).
  const wrapper = names[0].split("/")[0] + "/";
  const wantedPrefix = subdir ? wrapper + subdir.replace(/\/+$/, "") + "/" : wrapper;

  let copied = 0;
  for (const name of names) {
    const entry = zip.files[name];
    if (entry.dir) continue;
    if (!name.startsWith(wantedPrefix)) continue;
    const cleanPath = name.slice(wantedPrefix.length);
    if (!cleanPath) continue;
    const content = await entry.async("uint8array");
    repacked.file(cleanPath, content);
    copied++;
  }
  if (copied === 0) {
    throw new Error(
      subdir
        ? `No files found under subdirectory "${subdir}" in the repository.`
        : "Repository archive was empty.",
    );
  }

  const repackedBuffer = await repacked.generateAsync({ type: "arraybuffer" });
  const result = await importZipToFiles(repackedBuffer);
  return { ...result, repoName: `${owner}/${repo}`, branch };
}

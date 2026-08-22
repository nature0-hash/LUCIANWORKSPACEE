// Workspace project helpers stub.

import type { FileEntry, Project } from "@/types/workspace";
import type { DetectedFramework } from "@/types/workspace";

export function newId(prefix = "id"): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyProject(name: string, description = ""): Project {
  const now = Date.now();
  return {
    id: newId("proj"),
    name,
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
    trashedAt: null,
  };
}

export async function buildProjectFromImport(
  name: string,
  importResult: {
    entries: FileEntry[];
    contents: { path: string; content: string }[];
    skippedDirs: string[];
  },
): Promise<Project> {
  const p = createEmptyProject(name);
  p.files = importResult.entries;
  p.fileCount = importResult.entries.length;
  p.totalSize = importResult.entries.reduce((s, f) => s + (f.size ?? 0), 0);
  p.skippedDirs = importResult.skippedDirs;
  return p;
}

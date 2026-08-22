// Workspace db stub — minimal in-memory implementations so the
// workspace store compiles. Not actually persisted in this preview.

import type { Project } from "@/types/workspace";

const projects = new Map<string, Project>();

export async function saveProject(p: Project): Promise<void> {
  projects.set(p.id, { ...p });
}

export async function getProject(id: string): Promise<Project | null> {
  return projects.get(id) ?? null;
}

export async function listProjects(): Promise<Project[]> {
  return Array.from(projects.values()).filter((p) => !p.trashedAt);
}

export async function listTrashedProjects(): Promise<Project[]> {
  return Array.from(projects.values()).filter((p) => p.trashedAt);
}

export async function deleteProject(id: string): Promise<void> {
  projects.delete(id);
}

const fileContents = new Map<string, Map<string, string>>();

export async function getFileContent(
  projectId: string,
  path: string,
): Promise<string | undefined> {
  return fileContents.get(projectId)?.get(path);
}

export async function getManyFileContents(
  projectId: string,
  paths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const map = fileContents.get(projectId);
  if (map) {
    for (const p of paths) {
      const c = map.get(p);
      if (c !== undefined) out.set(p, c);
    }
  }
  return out;
}

export async function setFileContent(
  projectId: string,
  path: string,
  content: string,
): Promise<void> {
  if (!fileContents.has(projectId)) fileContents.set(projectId, new Map());
  fileContents.get(projectId)!.set(path, content);
}

export async function deleteFileContent(
  projectId: string,
  path: string,
): Promise<void> {
  fileContents.get(projectId)?.delete(path);
}

export async function renameFileContent(
  projectId: string,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const map = fileContents.get(projectId);
  if (!map) return;
  const c = map.get(oldPath);
  if (c !== undefined) {
    map.delete(oldPath);
    map.set(newPath, c);
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number }> {
  return { usage: 0, quota: 0 };
}

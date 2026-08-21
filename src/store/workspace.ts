"use client";

// DevWorkspace global state.
//
// We keep this in Zustand rather than React Context so deeply nested
// components (file tree, editor tabs, preview iframe, history panel) can
// subscribe to slices without prop drilling.
//
// NOTE: the original DevWorkspace had its own theme + accent state in this
// store. LUCIAN already provides a global theme system via ThemeProvider
// (useTheme), so the DevWorkspace reuses that. There is NO theme state here.

import { create } from "zustand";
import type {
  AppView,
  EnvVar,
  FileEntry,
  MockLogEntry,
  OpenTab,
  PreviewMode,
  Project,
  ProjectFile,
  ResponsiveDevice,
  ScanResult,
} from "@/types/workspace";
import {
  deleteProject as dbDeleteProject,
  deleteFileContent,
  estimateStorage,
  getFileContent,
  getManyFileContents,
  getProject,
  listProjects,
  renameFileContent,
  saveProject,
  setFileContent,
} from "@/lib/workspace/db";
import {
  buildProjectFromImport,
  createEmptyProject,
  newId,
  type SampleProject,
} from "@/lib/workspace/project";
import { detectFramework } from "@/lib/workspace/filesystem";
import { scanProject } from "@/lib/workspace/project-scanner";

interface WorkspaceState {
  // --- Navigation ---
  view: AppView;
  setView: (v: AppView) => void;

  // --- Projects ---
  projects: Project[];
  activeProjectId: string | null;
  activeProject: Project | null;
  loadingProjects: boolean;
  refreshProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<Project>;
  addSampleProject: (sample: SampleProject) => Promise<Project>;
  importProject: (name: string, importResult: {
    entries: FileEntry[];
    contents: { path: string; content: string }[];
    skippedDirs: string[];
  }) => Promise<Project>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  renameProject: (id: string, name: string) => Promise<void>;
  removeProject: (id: string) => Promise<void>;
  updateProjectEntries: (id: string, files: FileEntry[]) => Promise<void>;
  updateProjectEnv: (id: string, envVars: EnvVar[]) => Promise<void>;
  persistActive: () => Promise<void>;

  // --- File content (lazy) ---
  /** In-memory cache of file contents for the active project. */
  contentCache: Map<string, string>;
  /** Paths currently being loaded from IndexedDB. */
  loadingPaths: Set<string>;
  loadFileContent: (projectId: string, path: string) => Promise<string | undefined>;
  /** Pre-load all file contents (used before history save / download / preview). */
  loadAllFileContents: (projectId: string) => Promise<Map<string, string>>;
  /** Get a ProjectFile[] (entries + content) for the active project. */
  getActiveProjectFiles: () => Promise<ProjectFile[]>;
  /** Clear the content cache (e.g. when switching projects). */
  clearContentCache: () => void;

  // --- File operations ---
  writeFile: (path: string, content: string) => Promise<void>;
  writeFileBinary: (
    path: string,
    dataUrl: string,
    mime: string,
  ) => Promise<void>;
  deleteFile: (path: string) => Promise<void>;
  renameFile: (oldPath: string, newPath: string) => Promise<void>;
  createFile: (path: string, content?: string) => Promise<void>;

  // --- Editor tabs ---
  openTabs: OpenTab[];
  activeTab: string | null;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  setTabEditing: (path: string, editing: boolean) => void;
  markTabDirty: (path: string, dirty: boolean) => void;

  // --- Preview state ---
  previewMode: PreviewMode;
  setPreviewMode: (m: PreviewMode) => void;
  device: ResponsiveDevice;
  setDevice: (d: ResponsiveDevice) => void;
  previewKey: number;
  refreshPreview: () => void;
  /** Last preview diagnostic (error message + source). */
  previewDiagnostic: { message: string; source?: string } | null;
  setPreviewDiagnostic: (d: { message: string; source?: string } | null) => void;

  // --- Mock log (API mocking layer) ---
  /** Live log of network calls intercepted by the mock layer. */
  mockLog: MockLogEntry[];
  setMockLog: (log: MockLogEntry[]) => void;
  clearMockLog: () => void;

  // --- Project scanning ---
  /** Re-scan the active project for required services/env vars. */
  rescanActiveProject: () => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  view: "library",
  setView: (v) => set({ view: v }),

  // --- Projects ---
  projects: [],
  activeProjectId: null,
  activeProject: null,
  loadingProjects: true,

  refreshProjects: async () => {
    set({ loadingProjects: true });
    try {
      const projects = await listProjects();
      set({ projects, loadingProjects: false });
    } catch (err) {
      console.error("Failed to list projects:", err);
      set({ loadingProjects: false });
    }
  },

  createProject: async (name, description = "") => {
    const project = createEmptyProject(name, description);
    await saveProject(project);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  addSampleProject: async (sample) => {
    // Persist inline contents to the contents store.
    const { setManyFileContents } = await import("@/lib/workspace/db");
    await setManyFileContents(sample.id, sample.inlineContents);
    // Mark entries as loaded (content is now in the store).
    const project: Project = {
      ...sample,
      files: sample.files.map((f) => ({ ...f, loaded: false })),
    };
    delete (project as Partial<SampleProject>).inlineContents;
    await saveProject(project);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  importProject: async (name, importResult) => {
    const project = await buildProjectFromImport(name, importResult);
    // Scan the project for required services / env vars so we can show the
    // "what's needed to go live" checklist immediately on the library card.
    try {
      const files: ProjectFile[] = importResult.entries.map((entry, i) => ({
        ...entry,
        content: importResult.contents[i]?.content ?? "",
      }));
      project.scanResult = scanProject(files, project.envVars);
    } catch (err) {
      console.error("Project scan failed:", err);
    }
    await saveProject(project);
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  openProject: async (id) => {
    const project = await getProject(id);
    if (!project) return;
    set({
      activeProject: project,
      activeProjectId: id,
      view: "workspace",
      openTabs: [],
      activeTab: null,
      contentCache: new Map(),
      loadingPaths: new Set(),
      mockLog: [],
      previewDiagnostic: null,
    });
  },

  closeProject: () => {
    set({
      activeProject: null,
      activeProjectId: null,
      openTabs: [],
      activeTab: null,
      contentCache: new Map(),
    });
  },

  renameProject: async (id, name) => {
    const project = await getProject(id);
    if (!project) return;
    project.name = name;
    await saveProject(project);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...project } : p)),
      activeProject: s.activeProjectId === id ? { ...project } : s.activeProject,
    }));
  },

  removeProject: async (id) => {
    await dbDeleteProject(id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      activeProject: s.activeProjectId === id ? null : s.activeProject,
      activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
    }));
  },

  updateProjectEntries: async (id, files) => {
    const project = await getProject(id);
    if (!project) return;
    project.files = files;
    project.fileCount = files.length;
    project.totalSize = files.reduce((sum, f) => sum + (f.size ?? 0), 0);
    project.framework = detectFramework(files);
    await saveProject(project);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...project } : p)),
      activeProject: s.activeProjectId === id ? { ...project } : s.activeProject,
    }));
  },

  updateProjectEnv: async (id, envVars) => {
    const project = await getProject(id);
    if (!project) return;
    project.envVars = envVars;
    // Re-scan so the "what's needed to go live" checklist reflects the
    // newly configured env vars.
    if (project.scanResult) {
      try {
        // Update env var "configured" flags without a full re-scan.
        project.scanResult = {
          ...project.scanResult,
          envVars: project.scanResult.envVars.map((e) => ({
            ...e,
            configured: envVars.some((v) => v.key === e.key),
          })),
          services: project.scanResult.services.map((s) => ({
            ...s,
            configured: s.requiredEnvVars.some((key) =>
              envVars.some((v) => v.key === key),
            ),
          })),
        };
      } catch (err) {
        console.error("Re-scan after env update failed:", err);
      }
    }
    await saveProject(project);
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...project } : p)),
      activeProject: s.activeProjectId === id ? { ...project } : s.activeProject,
    }));
  },

  persistActive: async () => {
    const { activeProject } = get();
    if (!activeProject) return;
    await saveProject(activeProject);
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === activeProject.id ? { ...activeProject } : p,
      ),
    }));
  },

  // --- File content (lazy) ---
  contentCache: new Map(),
  loadingPaths: new Set(),

  loadFileContent: async (projectId, path) => {
    const state = get();
    // Check cache first.
    const cached = state.contentCache.get(path);
    if (cached !== undefined) return cached;
    if (state.loadingPaths.has(path)) {
      // Wait for in-flight load to complete, then re-check.
      while (get().loadingPaths.has(path)) {
        await new Promise((r) => setTimeout(r, 20));
      }
      return get().contentCache.get(path);
    }
    set((s) => {
      const next = new Set(s.loadingPaths);
      next.add(path);
      return { loadingPaths: next };
    });
    try {
      const content = await getFileContent(projectId, path);
      if (content !== undefined) {
        set((s) => {
          const next = new Map(s.contentCache);
          next.set(path, content);
          return { contentCache: next };
        });
      }
      return content;
    } finally {
      set((s) => {
        const next = new Set(s.loadingPaths);
        next.delete(path);
        return { loadingPaths: next };
      });
    }
  },

  loadAllFileContents: async (projectId) => {
    const state = get();
    const project = state.activeProjectId === projectId
      ? state.activeProject
      : await getProject(projectId);
    if (!project) return new Map();
    // Load ALL file contents (text + binary). Binary contents are stored as
    // data URLs in the same contents store.
    const paths = project.files.map((f) => f.path);
    const allContents = await getManyFileContents(projectId, paths);
    // Merge into the cache.
    set((s) => {
      const next = new Map(s.contentCache);
      for (const [path, content] of allContents) next.set(path, content);
      return { contentCache: next };
    });
    return allContents;
  },

  getActiveProjectFiles: async () => {
    const { activeProject, loadAllFileContents } = get();
    if (!activeProject) return [];
    // Make sure all contents are loaded (text + binary).
    await loadAllFileContents(activeProject.id);
    const cache = get().contentCache;
    return activeProject.files.map((f) => ({
      ...f,
      content: cache.get(f.path) ?? "",
    }));
  },

  clearContentCache: () => set({ contentCache: new Map() }),

  // --- File operations ---
  writeFile: async (path, content) => {
    const { activeProject, activeProjectId } = get();
    if (!activeProject || !activeProjectId) return;
    const files = [...activeProject.files];
    const idx = files.findIndex((f) => f.path === path);
    const size = new TextEncoder().encode(content).length;
    const newEntry: FileEntry = {
      path,
      binary: false,
      size,
      updatedAt: Date.now(),
      loaded: true,
    };
    if (idx >= 0) files[idx] = newEntry;
    else files.push(newEntry);
    // Persist content separately.
    await setFileContent(activeProjectId, path, content);
    // Update cache.
    set((s) => {
      const next = new Map(s.contentCache);
      next.set(path, content);
      return { contentCache: next };
    });
    await get().updateProjectEntries(activeProjectId, files);
    // Live runtime hot-reload: sync the edit into the running container.
    const { syncFile, runtimeProjectId } = await import("@/lib/workspace/webcontainer");
    if (runtimeProjectId() === activeProjectId) void syncFile(path, content);
  },

  writeFileBinary: async (path, dataUrl, mime) => {
    const { activeProject, activeProjectId } = get();
    if (!activeProject || !activeProjectId) return;
    const files = [...activeProject.files];
    const idx = files.findIndex((f) => f.path === path);
    // Estimate size from base64 length.
    const base64 = dataUrl.split(",")[1] ?? "";
    const size = Math.floor((base64.length * 3) / 4);
    const newEntry: FileEntry = {
      path,
      binary: true,
      mime,
      size,
      updatedAt: Date.now(),
      loaded: true,
    };
    if (idx >= 0) files[idx] = newEntry;
    else files.push(newEntry);
    await setFileContent(activeProjectId, path, dataUrl);
    set((s) => {
      const next = new Map(s.contentCache);
      next.set(path, dataUrl);
      return { contentCache: next };
    });
    await get().updateProjectEntries(activeProjectId, files);
  },

  deleteFile: async (path) => {
    const { activeProject, activeProjectId } = get();
    if (!activeProject || !activeProjectId) return;
    const files = activeProject.files.filter((f) => f.path !== path);
    await deleteFileContent(activeProjectId, path);
    // Live runtime: remove from the running container too.
    {
      const { removeFile, runtimeProjectId } = await import("@/lib/workspace/webcontainer");
      if (runtimeProjectId() === activeProjectId) void removeFile(path);
    }
    set((s) => {
      const next = new Map(s.contentCache);
      next.delete(path);
      return { contentCache: next };
    });
    await get().updateProjectEntries(activeProjectId, files);
    set((s) => ({
      openTabs: s.openTabs.filter((t) => t.path !== path),
      activeTab: s.activeTab === path ? null : s.activeTab,
    }));
  },

  renameFile: async (oldPath, newPath) => {
    const { activeProject, activeProjectId } = get();
    if (!activeProject || !activeProjectId) return;
    const files = activeProject.files.map((f) =>
      f.path === oldPath ? { ...f, path: newPath, updatedAt: Date.now() } : f,
    );
    await renameFileContent(activeProjectId, oldPath, newPath);
    set((s) => {
      const next = new Map(s.contentCache);
      const c = next.get(oldPath);
      if (c !== undefined) {
        next.delete(oldPath);
        next.set(newPath, c);
      }
      return { contentCache: next };
    });
    await get().updateProjectEntries(activeProjectId, files);
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === oldPath ? { ...t, path: newPath } : t,
      ),
      activeTab: s.activeTab === oldPath ? newPath : s.activeTab,
    }));
  },

  createFile: async (path, content = "") => {
    await get().writeFile(path, content);
    get().openTab(path);
  },

  // --- Editor tabs ---
  openTabs: [],
  activeTab: null,
  openTab: (path) => {
    set((s) => {
      if (s.openTabs.some((t) => t.path === path)) {
        return { activeTab: path };
      }
      return {
        openTabs: [...s.openTabs, { path, dirty: false, editing: false }],
        activeTab: path,
      };
    });
  },
  closeTab: (path) => {
    set((s) => {
      const idx = s.openTabs.findIndex((t) => t.path === path);
      const newTabs = s.openTabs.filter((t) => t.path !== path);
      let newActive = s.activeTab;
      if (s.activeTab === path) {
        newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.path ?? null;
      }
      return { openTabs: newTabs, activeTab: newActive };
    });
  },
  setActiveTab: (path) => set({ activeTab: path }),
  setTabEditing: (path, editing) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) =>
        t.path === path ? { ...t, editing, dirty: editing ? t.dirty : false } : t,
      ),
    })),
  markTabDirty: (path, dirty) =>
    set((s) => ({
      openTabs: s.openTabs.map((t) => (t.path === path ? { ...t, dirty } : t)),
    })),

  // --- Preview state ---
  previewMode: "demo",
  setPreviewMode: (m) => set({ previewMode: m }),
  device: "desktop",
  setDevice: (d) => set({ device: d }),
  previewKey: 0,
  refreshPreview: () => set((s) => ({ previewKey: s.previewKey + 1 })),
  previewDiagnostic: null,
  setPreviewDiagnostic: (d) => set({ previewDiagnostic: d }),

  // --- Mock log ---
  mockLog: [],
  setMockLog: (log) => set({ mockLog: log }),
  clearMockLog: () => set({ mockLog: [] }),

  // --- Project scanning ---
  rescanActiveProject: async () => {
    const { activeProject, getActiveProjectFiles, persistActive } = get();
    if (!activeProject) return;
    const files = await getActiveProjectFiles();
    const scanResult = scanProject(files, activeProject.envVars);
    activeProject.scanResult = scanResult;
    await persistActive();
  },
}));

/** Generate a fresh version id. */
export function generateVersionId(): string {
  return newId("ver");
}

/** Re-export estimateStorage so callers can read browser storage state. */
export { estimateStorage };

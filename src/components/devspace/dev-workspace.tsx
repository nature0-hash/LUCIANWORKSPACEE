"use client";

// LUCIAN WORKSPACE — DevWorkspace module.
//
// This wraps the full DevWorkspace subsystem (Project Library, Workspace,
// Visual Editor Studio, Code Converter) as a single module rendered inside
// the LUCIAN shell's main content area. The module keeps its own internal
// Zustand store for project state but DOES NOT have its own theme system —
// it reuses LUCIAN's global ThemeProvider (useTheme) for visual theming.

import { useEffect, useRef } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { useSettingsStore } from "@/store/settings";
import { ProjectLibraryView } from "@/components/devspace/library/project-library-view";
import { WorkspaceView } from "@/components/devspace/workspace/workspace-view";
import { VisualEditorView } from "@/components/devspace/visual-editor/visual-editor-view";
import { VectorStudioView } from "@/components/devspace/vector-studio/vector-studio-view";
import { CodeConverterView } from "@/components/devspace/converter/code-converter-view";
import { TopNavigation } from "@/components/devspace/workspace/top-navigation";

export function DevWorkspaceModule() {
  const view = useWorkspaceStore((s) => s.view);
  const refreshProjects = useWorkspaceStore((s) => s.refreshProjects);
  const projects = useWorkspaceStore((s) => s.projects);
  const openProject = useWorkspaceStore((s) => s.openProject);

  // Settings → DevWorkspace → Projects → restoreLastProject.
  // When ON (default), DevWorkspace auto-opens the most recently updated
  // project on load. When OFF, it lands on the Project Library.
  const restoreLastProject = useSettingsStore((s) => s.devWorkspace.projects.restoreLastProject);

  // Track whether we've already attempted the restore so we don't re-open
  // a project every time `projects` changes (e.g. after a manual close).
  const restoreAttemptedRef = useRef(false);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  // Restore the last project on initial load (one-shot).
  useEffect(() => {
    if (restoreAttemptedRef.current) return;
    if (projects.length === 0) return; // wait for the project list to load
    restoreAttemptedRef.current = true;
    if (!restoreLastProject) return;
    // Find the most recently updated non-trashed project.
    const eligible = projects.filter((p) => !p.trashedAt);
    if (eligible.length === 0) return;
    eligible.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
    const last = eligible[0];
    if (last) {
      void openProject(last.id);
    }
  }, [projects, restoreLastProject, openProject]);

  return (
    <div className="themed flex h-full w-full flex-col bg-canvas text-fg">
      <TopNavigation />
      <main className="min-h-0 flex-1 overflow-hidden">
        {view === "library" && <ProjectLibraryView />}
        {view === "workspace" && <WorkspaceView />}
        {view === "visual-editor" && <VisualEditorView />}
        {view === "vector-studio" && <VectorStudioView />}
        {view === "converter" && <CodeConverterView />}
      </main>
    </div>
  );
}

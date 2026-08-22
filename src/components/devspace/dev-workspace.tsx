"use client";

// LUCIAN WORKSPACE — DevWorkspace module.
//
// This wraps the full DevWorkspace subsystem (Project Library, Workspace,
// Visual Editor Studio, Code Converter) as a single module rendered inside
// the LUCIAN shell's main content area. The module keeps its own internal
// Zustand store for project state but DOES NOT have its own theme system —
// it reuses LUCIAN's global ThemeProvider (useTheme) for visual theming.

import { useEffect } from "react";
import { useWorkspaceStore } from "@/store/workspace";
import { ProjectLibraryView } from "@/components/devspace/library/project-library-view";
import { WorkspaceView } from "@/components/devspace/workspace/workspace-view";
import { VisualEditorView } from "@/components/devspace/visual-editor/visual-editor-view";
import { CodeConverterView } from "@/components/devspace/converter/code-converter-view";
import { TopNavigation } from "@/components/devspace/workspace/top-navigation";

export function DevWorkspaceModule() {
  const view = useWorkspaceStore((s) => s.view);
  const refreshProjects = useWorkspaceStore((s) => s.refreshProjects);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  return (
    <div className="themed flex h-full w-full flex-col bg-canvas text-fg">
      <TopNavigation />
      <main className="min-h-0 flex-1 overflow-hidden">
        {view === "library" && <ProjectLibraryView />}
        {view === "workspace" && <WorkspaceView />}
        {view === "visual-editor" && <VisualEditorView />}
        {view === "converter" && <CodeConverterView />}
      </main>
    </div>
  );
}

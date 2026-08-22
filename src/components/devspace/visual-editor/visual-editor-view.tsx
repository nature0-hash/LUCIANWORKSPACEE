"use client";

// Visual Editor Studio — main view.
//
// Three-pane layout:
//   ┌───────────────┬─────────────────────────────┬───────────────┐
//   │ Pages/Layers/ │      Visual Canvas          │  Agent / Style│
//   │   Assets      │  (live project preview +    │               │
//   │               │   click-to-select)          │               │
//   └───────────────┴─────────────────────────────┴───────────────┘
//
// The Agent (right) is the SAME Project Agent used in the Workspace —
// same conversation, same context. The right pane alternates between
// the Agent and the Style inspector.

import { useCallback, useMemo, useState } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Bot, FolderOpen, Sliders, Wand2 } from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { Card } from "@/components/ui-devspace/card";
import { Badge } from "@/components/ui-devspace/badge";
import { useWorkspaceStore } from "@/store/workspace";
import {
  checkVisualEditorReadiness,
  type VisualNode,
} from "@/lib/workspace/visual-editor";
import { VisualCanvas } from "./visual-canvas";
import { LayersPanel } from "./layers-panel";
import { StyleInspector } from "./style-inspector";
import { AgentPanel } from "@/components/devspace/agent/agent-panel";
import { cn } from "@/lib/utils";

type LeftTab = "pages" | "layers" | "assets";
type RightTab = "agent" | "style";

export function VisualEditorView() {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const setView = useWorkspaceStore((s) => s.setView);

  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [rightTab, setRightTab] = useState<RightTab>("style");
  const [rootNode, setRootNode] = useState<VisualNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const readiness = useMemo(
    () => checkVisualEditorReadiness(activeProject),
    [activeProject],
  );

  const handleInspection = useCallback((root: VisualNode) => {
    setRootNode(root);
  }, []);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) setRightTab("style");
  }, []);

  const handlePatched = useCallback(() => {
    // Source was patched; clear the cached tree so the next inspection refreshes.
    setRootNode(null);
  }, []);

  // Find the selected VisualNode from the tree.
  const selectedNode = useMemo(() => {
    if (!rootNode || !selectedId) return null;
    return findNode(rootNode, selectedId);
  }, [rootNode, selectedId]);

  // No active project → empty state.
  if (!activeProject) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="flex max-w-md flex-col items-center justify-center gap-4 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Wand2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No project loaded</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Open a project from Project Library to start visually editing it.
            </p>
          </div>
          <Button onClick={() => setView("library")}>
            <FolderOpen className="mr-2 h-4 w-4" /> Go to Project Library
          </Button>
        </Card>
      </div>
    );
  }

  // Project doesn't support the visual editor.
  if (!readiness.ready) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="flex max-w-md flex-col gap-3 p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <Wand2 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-base font-semibold">
            Visual Editor is unavailable for this project
          </h3>
          <p className="text-sm text-muted-foreground">{readiness.reason}</p>
          <p className="text-xs text-muted-foreground">{readiness.explanation}</p>
          <Button variant="outline" size="sm" onClick={() => setView("workspace")}>
            Switch to Workspace
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Support badge */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-2 text-xs">
          <Wand2 className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium">Visual Editor Studio</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{activeProject.name}</span>
        </div>
        <Badge variant={readiness.support === "full" ? "default" : "secondary"}>
          {readiness.supportLabel}
        </Badge>
      </div>

      {/* Three-pane layout */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* LEFT: Pages / Layers / Assets */}
          <Panel defaultSize={18} minSize={12} maxSize={28}>
            <div className="flex h-full flex-col">
              {/* Tab strip */}
              <div className="flex h-8 shrink-0 items-center gap-0.5 border-b bg-card px-1">
                <LeftTabBtn
                  active={leftTab === "pages"}
                  onClick={() => setLeftTab("pages")}
                  label="Pages"
                />
                <LeftTabBtn
                  active={leftTab === "layers"}
                  onClick={() => setLeftTab("layers")}
                  label="Layers"
                />
                <LeftTabBtn
                  active={leftTab === "assets"}
                  onClick={() => setLeftTab("assets")}
                  label="Assets"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {leftTab === "pages" ? (
                  <PagesPanel
                    entryFile={readiness.entryFile!}
                  />
                ) : leftTab === "layers" ? (
                  <LayersPanel
                    root={rootNode}
                    selectedId={selectedId}
                    onSelect={handleSelect}
                  />
                ) : (
                  <AssetsPanel />
                )}
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

          {/* CENTER: Canvas */}
          <Panel defaultSize={56} minSize={30}>
            <VisualCanvas
              entryFile={readiness.entryFile!}
              onInspection={handleInspection}
              onSelect={handleSelect}
              selectedId={selectedId}
            />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

          {/* RIGHT: Agent / Style */}
          <Panel defaultSize={26} minSize={18}>
            <div className="flex h-full flex-col">
              <div className="flex h-8 shrink-0 items-center gap-0.5 border-b bg-card px-1">
                <RightTabBtn
                  active={rightTab === "style"}
                  onClick={() => setRightTab("style")}
                  icon={Sliders}
                  label="Style"
                />
                <RightTabBtn
                  active={rightTab === "agent"}
                  onClick={() => setRightTab("agent")}
                  icon={Bot}
                  label="Agent"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {rightTab === "style" ? (
                  <div className="h-full overflow-y-auto">
                    <StyleInspector
                      node={selectedNode}
                      entryFile={readiness.entryFile!}
                      onPatched={handlePatched}
                    />
                  </div>
                ) : (
                  <AgentPanel compact title="Project Agent" />
                )}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function LeftTabBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function RightTabBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Bot;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function PagesPanel({ entryFile }: { entryFile: string }) {
  // Pages = all HTML files in the project. We let the user switch which
  // page the canvas shows in a future iteration; for now we just list
  // them and highlight the active entry.
  const project = useWorkspaceStore((s) => s.activeProject);
  if (!project) return null;
  const htmlFiles = project.files.filter(
    (f) => !f.binary && f.path.endsWith(".html"),
  );
  return (
    <ul className="space-y-0.5 p-2 text-xs">
      {htmlFiles.map((f) => (
        <li
          key={f.path}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            f.path === entryFile
              ? "bg-primary/15 text-foreground"
              : "text-muted-foreground hover:bg-accent",
          )}
        >
          <span className="truncate font-mono text-[11px]">{f.path}</span>
        </li>
      ))}
      {htmlFiles.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No HTML files</li>
      ) : null}
    </ul>
  );
}

function AssetsPanel() {
  // Assets = binary files (images, fonts) in the project.
  const project = useWorkspaceStore((s) => s.activeProject);
  if (!project) return null;
  const assets = project.files.filter((f) => f.binary);
  return (
    <ul className="space-y-0.5 p-2 text-xs">
      {assets.map((f) => (
        <li
          key={f.path}
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-muted-foreground hover:bg-accent"
        >
          <span className="truncate font-mono text-[11px]">{f.path}</span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {(f.size / 1024).toFixed(1)} KB
          </span>
        </li>
      ))}
      {assets.length === 0 ? (
        <li className="px-2 py-1.5 text-muted-foreground">No binary assets</li>
      ) : null}
    </ul>
  );
}

function findNode(root: VisualNode, id: string): VisualNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

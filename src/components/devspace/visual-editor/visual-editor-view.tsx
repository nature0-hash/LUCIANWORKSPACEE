"use client";

// Visual Editor Studio — main view.
//
// Three-pane layout when a project is loaded:
//   ┌───────────────┬─────────────────────────────┬───────────────┐
//   │ Pages/Layers/ │      Visual Canvas          │  Agent / Style│
//   │ Assets/Files  │  (live preview + click-     │               │
//   │ /Context      │   to-select, OR direct-edit  │               │
//   │               │   when no rendering)        │               │
//   └───────────────┴─────────────────────────────┴───────────────┘
//
// When NO project is loaded → Start Workspace (composer).
// When project can't render → Direct Edit canvas (never refuses).
// When project can render  → Live Canvas with element selection.

import { useCallback, useMemo, useState } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {
  Bot,
  FileCode2,
  FileText,
  FolderOpen,
  ImageIcon,
  Layers as LayersIcon,
  Sliders,
  Wand2,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import {
  analyzeProject,
  type VisualNode,
} from "@/lib/workspace/visual-editor";
import { VisualCanvas } from "./visual-canvas";
import { DirectEditCanvas } from "./direct-edit-canvas";
import { LayersPanel } from "./layers-panel";
import { StyleInspector } from "./style-inspector";
import { AgentPanel } from "@/components/devspace/agent/agent-panel";
import { VisualEditorStartWorkspace } from "./visual-editor-start-workspace";
import { cn } from "@/lib/utils";

type LeftTab = "pages" | "layers" | "assets" | "files";
type RightTab = "agent" | "style";

export function VisualEditorView() {
  const activeProject = useWorkspaceStore((s) => s.activeProject);

  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [rightTab, setRightTab] = useState<RightTab>("style");
  const [rootNode, setRootNode] = useState<VisualNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const analysis = useMemo(
    () => analyzeProject(activeProject),
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
    setRootNode(null);
  }, []);

  const selectedNode = useMemo(() => {
    if (!rootNode || !selectedId) return null;
    return findNode(rootNode, selectedId);
  }, [rootNode, selectedId]);

  // No active project → Start Workspace (composer).
  if (!activeProject || !analysis) {
    return <VisualEditorStartWorkspace />;
  }

  // Project loaded — choose canvas based on analysis mode.
  const isLiveCanvas = analysis.mode === "live-canvas";

  return (
    <div className="flex h-full flex-col">
      {/* Mode badge bar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line-muted bg-surface-2/40 px-3">
        <div className="flex items-center gap-2 text-xs">
          <Wand2 className="h-3.5 w-3.5 text-accent" />
          <span className="font-medium text-fg">Visual Editor Studio</span>
          <span className="text-fg-faint">·</span>
          <span className="text-fg-muted">{activeProject.name}</span>
        </div>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            isLiveCanvas
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400",
          )}
        >
          {analysis.modeLabel}
        </span>
      </div>

      {/* Three-pane layout */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* LEFT: Pages / Layers / Assets / Files */}
          <Panel defaultSize={18} minSize={12} maxSize={28}>
            <div className="flex h-full flex-col">
              <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line-muted bg-surface-2/40 px-1">
                <LeftTabBtn active={leftTab === "pages"} onClick={() => setLeftTab("pages")} icon={FileText} label="Pages" />
                <LeftTabBtn active={leftTab === "layers"} onClick={() => setLeftTab("layers")} icon={LayersIcon} label="Layers" disabled={!isLiveCanvas} />
                <LeftTabBtn active={leftTab === "assets"} onClick={() => setLeftTab("assets")} icon={ImageIcon} label="Assets" />
                <LeftTabBtn active={leftTab === "files"} onClick={() => setLeftTab("files")} icon={FolderOpen} label="Files" />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {leftTab === "pages" ? (
                  <PagesPanel analysis={analysis} />
                ) : leftTab === "layers" ? (
                  isLiveCanvas ? (
                    <LayersPanel
                      root={rootNode}
                      selectedId={selectedId}
                      onSelect={handleSelect}
                    />
                  ) : (
                    <DisabledPanel
                      label="Layers available in Live Canvas mode"
                      hint="Switch to a project with an HTML entry to enable element selection."
                    />
                  )
                ) : leftTab === "assets" ? (
                  <AssetsPanel />
                ) : (
                  <FilesContextPanel analysis={analysis} />
                )}
              </div>
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

          {/* CENTER: Canvas (Live or Direct Edit) */}
          <Panel defaultSize={56} minSize={30}>
            {isLiveCanvas && analysis.entryFile ? (
              <VisualCanvas
                entryFile={analysis.entryFile}
                onInspection={handleInspection}
                onSelect={handleSelect}
                selectedId={selectedId}
              />
            ) : (
              <DirectEditCanvas analysis={analysis} />
            )}
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />

          {/* RIGHT: Agent / Style */}
          <Panel defaultSize={26} minSize={18}>
            <div className="flex h-full flex-col">
              <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line-muted bg-surface-2/40 px-1">
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
                  isLiveCanvas && analysis.entryFile ? (
                    <div className="h-full overflow-y-auto">
                      <StyleInspector
                        node={selectedNode}
                        entryFile={analysis.entryFile}
                        onPatched={handlePatched}
                      />
                    </div>
                  ) : (
                    <DisabledPanel
                      label="Style inspector needs Live Canvas"
                      hint="Direct Edit mode doesn't expose element selection. Use the Agent or the Workspace Code editor."
                    />
                  )
                ) : (
                  <AgentPanel />
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
  icon: Icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof FileText;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `${label} (not available in Direct Edit mode)` : label}
      className={cn(
        "flex flex-1 items-center justify-center gap-1 rounded-sm px-1.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : disabled
          ? "text-fg-faint/50"
          : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      <span className="hidden truncate sm:inline">{label}</span>
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
          ? "bg-accent text-accent-fg"
          : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function PagesPanel({
  analysis,
}: {
  analysis: import("@/lib/workspace/visual-editor").ProjectAnalysis;
}) {
  // Pages = all HTML files in the project.
  if (analysis.htmlFiles.length === 0) {
    return (
      <DisabledPanel
        label="No HTML pages"
        hint="This project doesn't have an HTML entry file. Direct Edit mode is active."
      />
    );
  }
  return (
    <ul className="space-y-0.5 p-1.5 text-xs">
      {analysis.htmlFiles.map((p) => (
        <li
          key={p}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5",
            p === analysis.entryFile
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-fg"
              : "text-fg-muted hover:bg-hover hover:text-fg",
          )}
          title={p}
        >
          <FileText className="h-3 w-3 shrink-0 text-fg-faint" />
          <span className="truncate font-mono text-[11px]">{p}</span>
        </li>
      ))}
    </ul>
  );
}

function AssetsPanel() {
  const project = useWorkspaceStore((s) => s.activeProject);
  if (!project) return null;
  const assets = project.files.filter((f) => f.binary);
  if (assets.length === 0) {
    return (
      <DisabledPanel label="No assets" hint="No binary files in this project." />
    );
  }
  return (
    <ul className="space-y-0.5 p-1.5 text-xs">
      {assets.map((f) => (
        <li
          key={f.path}
          className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <span className="flex min-w-0 items-center gap-2">
            <ImageIcon className="h-3 w-3 shrink-0 text-fg-faint" />
            <span className="truncate font-mono text-[11px]">{f.path}</span>
          </span>
          <span className="shrink-0 text-[10px] text-fg-faint">
            {(f.size / 1024).toFixed(1)} KB
          </span>
        </li>
      ))}
    </ul>
  );
}

function FilesContextPanel({
  analysis,
}: {
  analysis: import("@/lib/workspace/visual-editor").ProjectAnalysis;
}) {
  // Files/Context = a flat overview of all source files (no full tree here;
  // the Workspace's File Explorer is the canonical tree view).
  const project = useWorkspaceStore((s) => s.activeProject);
  if (!project) return null;
  const sourceFiles = project.files.filter((f) => !f.binary);
  return (
    <ul className="space-y-0.5 p-1.5 text-xs">
      {sourceFiles.slice(0, 100).map((f) => (
        <li
          key={f.path}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-fg-muted hover:bg-hover hover:text-fg"
        >
          <FileCode2 className="h-3 w-3 shrink-0 text-fg-faint" />
          <span className="truncate font-mono text-[11px]">{f.path}</span>
        </li>
      ))}
      {sourceFiles.length > 100 ? (
        <li className="px-2 py-1 text-[10px] text-fg-faint">
          +{sourceFiles.length - 100} more files — use Workspace for the full tree.
        </li>
      ) : null}
    </ul>
  );
}

function DisabledPanel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-4 text-center">
      <p className="text-[11px] font-medium text-fg-faint">{label}</p>
      {hint ? <p className="mt-1 text-[10px] text-fg-faint/80">{hint}</p> : null}
    </div>
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

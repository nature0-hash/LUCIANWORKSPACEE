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
import { useSettingsStore } from "@/store/settings";
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
  const openTab = useWorkspaceStore((s) => s.openTab);

  // Settings → DevWorkspace → Visual Editor.
  // - snapshotBeforeStructuralEdit: when ON, create a project version
  //   snapshot before structural visual edits (reorder, resize). When
  //   OFF, skip the snapshot (the edit still happens, but there's no
  //   recoverable version). Default ON.
  // - showSourceMapping: passed to the canvas to control source-mapping
  //   UI visibility.
  const visualEditorPrefs = useSettingsStore((s) => s.devWorkspace.visualEditor);

  const [leftTab, setLeftTab] = useState<LeftTab>("layers");
  const [rightTab, setRightTab] = useState<RightTab>("style");
  const [rootNode, setRootNode] = useState<VisualNode | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Phase 12: source mapping from the preview instrumentation.
  const [selectedSourceFile, setSelectedSourceFile] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const analysis = useMemo(
    () => analyzeProject(activeProject),
    [activeProject],
  );

  const handleInspection = useCallback((root: VisualNode) => {
    setRootNode(root);
  }, []);

  const handleSelect = useCallback(
    (id: string | null, sourceFile?: string | null, sourceId?: string | null) => {
      setSelectedId(id);
      setSelectedSourceFile(sourceFile ?? null);
      setSelectedSourceId(sourceId ?? null);
      // Store on window so the canvas's SelectionInfoBar can read it.
      if (typeof window !== "undefined") {
        (window as unknown as { __lucianSelectedSourceFile?: string }).__lucianSelectedSourceFile = sourceFile ?? undefined;
        (window as unknown as { __lucianSelectedSourceId?: string }).__lucianSelectedSourceId = sourceId ?? undefined;
      }
      if (id) setRightTab("style");
    },
    [],
  );

  const handlePatched = useCallback(() => {
    setRootNode(null);
    // Phase 12: selection restoration — keep the same sourceId selected
    // after a hot reload so the user sees their edit applied to the
    // same element. The canvas will re-resolve the source mapping on
    // the next inspection message.
  }, []);

  // Phase 12: Direct Edit — open Monaco at the source location.
  const handleDirectEdit = useCallback(
    (sourceFile: string, sourceId: string) => {
      // Open the file in the workspace editor.
      openTab(sourceFile);
      // Switch to the Workspace view so the user sees Monaco.
      useWorkspaceStore.getState().setView("workspace");
      // The Monaco editor's reveal/selection is handled by the
      // workspace-view component, which reads the source-id from a
      // shared store on mount. We stash it on the workspace store via
      // a transient field — the editor picks it up on next render.
      if (typeof window !== "undefined") {
        (window as unknown as { __lucianRevealSourceId?: string }).__lucianRevealSourceId = sourceId;
      }
    },
    [openTab],
  );

  // Phase 12 final: canvas drag/drop reorder — uses the existing AST
  // reorderJsxElement() function. Creates a snapshot before the reorder
  // (gated by Settings → DevWorkspace → Visual Editor → snapshotBeforeStructuralEdit).
  const handleCanvasReorder = useCallback(
    async (sourceId: string, targetSourceId: string, position: "before" | "after") => {
      if (!activeProject) return;
      const sourceFile =
        (typeof window !== "undefined" ? (window as unknown as { __lucianSelectedSourceFile?: string }).__lucianSelectedSourceFile : undefined) ??
        "";
      if (!sourceFile) return;
      try {
        const { reorderJsxElement } = await import("@/lib/workspace/jsx-ast");
        const { saveVersion, trimProjectHistory } = await import("@/lib/workspace/db");
        const { newId } = await import("@/lib/workspace/project");
        const store = useWorkspaceStore.getState();
        const source = await store.loadFileContent(activeProject.id, sourceFile);
        if (typeof source !== "string") return;
        // Snapshot before reorder (gated by Settings).
        if (visualEditorPrefs.snapshotBeforeStructuralEdit) {
          const files = await store.getActiveProjectFiles();
          await saveVersion({
            id: newId("ver"),
            projectId: activeProject.id,
            label: `Visual Edit — Reordered element`,
            createdAt: Date.now(),
            files,
            previewMode: store.previewMode,
          });
          // Enforce maxLocalHistory retention (Settings → DevWorkspace → Projects).
          await trimProjectHistory(activeProject.id, useSettingsStore.getState().devWorkspace.projects.maxLocalHistory);
        }
        const result = reorderJsxElement(source, sourceId, sourceFile, {
          kind: position,
          targetSourceId,
        });
        if (result.status === "ok") {
          await store.writeFile(sourceFile, result.source);
          store.refreshPreview();
        }
      } catch {
        // Non-fatal — the reorder failed, but the preview is unchanged.
      }
    },
    [activeProject, visualEditorPrefs.snapshotBeforeStructuralEdit],
  );

  // Phase 12 final integration pass: canvas resize is strategy-aware.
  //
  // Before committing the resize, we resolve the element's source mapping
  // (just like the Style Inspector does) and choose the appropriate mutator:
  //
  //   A. Tailwind static className  → setTailwindUtility for `width`/`height`
  //                                    at the active breakpoint. The user
  //                                    can set the breakpoint in the inspector
  //                                    before resizing; we read the inspector's
  //                                    choice via the shared window slot.
  //                                    If the exact pixel size has no clean
  //                                    Tailwind equivalent, we use the
  //                                    arbitrary value form `w-[517px]`.
  //   B. CSS / CSS Module rule        → setCssDeclaration on the isolated
  //                                    local CSS rule that owns the element.
  //                                    Broad selectors (`div {}`, `* {}`)
  //                                    are rejected → Direct Edit.
  //   C. Inline `style`               → setInlineStyle on the `style`
  //                                    attribute (object expression).
  //   D. Dynamic className / dynamic
  //      style / unknown source       → Direct Edit (no silent source
  //                                    mutation that would conflict with
  //                                    the existing styling strategy).
  const handleCanvasResize = useCallback(
    async (sourceId: string, width: number | null, height: number | null) => {
      if (!activeProject) return;
      const sourceFile =
        (typeof window !== "undefined" ? (window as unknown as { __lucianSelectedSourceFile?: string }).__lucianSelectedSourceFile : undefined) ??
        "";
      if (!sourceFile) return;
      try {
        const { resolveSourceMapping } = await import("@/lib/workspace/source-map");
        const { setInlineStyle, isJsxFile } = await import("@/lib/workspace/jsx-ast");
        const { setTailwindUtility, suggestTailwindBody } = await import("@/lib/workspace/tailwind-mutator");
        const { saveVersion, trimProjectHistory } = await import("@/lib/workspace/db");
        const { newId } = await import("@/lib/workspace/project");
        const store = useWorkspaceStore.getState();
        let source = await store.loadFileContent(activeProject.id, sourceFile);
        if (typeof source !== "string") return;
        // Snapshot before resize (gated by Settings).
        if (visualEditorPrefs.snapshotBeforeStructuralEdit) {
          const files = await store.getActiveProjectFiles();
          await saveVersion({
            id: newId("ver"),
            projectId: activeProject.id,
            label: `Visual Edit — Resized element`,
            createdAt: Date.now(),
            files,
            previewMode: store.previewMode,
          });
          // Enforce maxLocalHistory retention.
          await trimProjectHistory(activeProject.id, useSettingsStore.getState().devWorkspace.projects.maxLocalHistory);
        }

        // Resolve the source mapping to pick the right mutator.
        const mapping = await resolveSourceMapping(
          activeProject,
          sourceFile,
          sourceId,
          null, // no VisualNode available here — mapping falls back to AST
          async (path) => store.loadFileContent(activeProject.id, path),
        );
        if (!mapping) {
          // No mapping → fall back to inline style on the source file
          // (only if it's a JSX/HTML file we can write to).
          if (isJsxFile(sourceFile)) {
            if (width !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "width", `${width}px`);
              if (r.status === "ok") source = r.source;
            }
            if (height !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "height", `${height}px`);
              if (r.status === "ok") source = r.source;
            }
          } else {
            // Can't safely mutate — Direct Edit.
            openTab(sourceFile);
            useWorkspaceStore.getState().setView("workspace");
            return;
          }
        } else if (mapping.strategy === "tailwind-static" && mapping.jsxElement) {
          // ── A. Tailwind static className ──
          // Use the inspector's current breakpoint (default "base").
          const bp = (typeof window !== "undefined"
            ? (window as unknown as { __lucianResizeBreakpoint?: string }).__lucianResizeBreakpoint
            : undefined) as
            | "base" | "sm" | "md" | "lg" | "xl" | "2xl" | undefined;
          const breakpoint = bp ?? "base";
          const currentClassName = mapping.jsxElement.className ?? "";
          let newClassName = currentClassName;
          if (width !== null) {
            const wBody = suggestTailwindBody("width", `${width}px`) || `w-[${width}px]`;
            newClassName = setTailwindUtility(newClassName, wBody, "width", breakpoint);
          }
          if (height !== null) {
            const hBody = suggestTailwindBody("height", `${height}px`) || `h-[${height}px]`;
            newClassName = setTailwindUtility(newClassName, hBody, "height", breakpoint);
          }
          const { setClassName } = await import("@/lib/workspace/jsx-ast");
          const r = setClassName(source, sourceId, sourceFile, newClassName);
          if (r.status === "ok") source = r.source;
        } else if (mapping.strategy === "css-rule") {
          // ── B. CSS / CSS Module rule ──
          //
          // The Style Inspector's CSS-row UI is the canonical path for
          // explicit CSS edits — it has access to the VisualNode (and
          // thus the element's className) which the resize handler
          // does NOT have. To avoid guessing the wrong CSS rule from
          // an unknown className, we conservatively fall back to inline
          // style on the JSX element (when the source IS a JSX file)
          // or Direct Edit. The user can then use the CSS-row UI to
          // move the resize into the proper CSS rule if desired.
          if (isJsxFile(sourceFile)) {
            if (width !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "width", `${width}px`);
              if (r.status === "ok") source = r.source;
            }
            if (height !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "height", `${height}px`);
              if (r.status === "ok") source = r.source;
            }
          } else {
            // CSS file directly — we don't know which rule to mutate.
            openTab(sourceFile);
            useWorkspaceStore.getState().setView("workspace");
            return;
          }
        } else if (mapping.strategy === "jsx-ast" || mapping.strategy === "html-dom") {
          // ── C. Inline style ──
          if (isJsxFile(sourceFile)) {
            if (width !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "width", `${width}px`);
              if (r.status === "ok") source = r.source;
            }
            if (height !== null) {
              const r = setInlineStyle(source, sourceId, sourceFile, "height", `${height}px`);
              if (r.status === "ok") source = r.source;
            }
          } else if (sourceFile.endsWith(".html") || sourceFile.endsWith(".htm")) {
            // HTML — patch the inline style attribute via DOMParser.
            const { patchFileContent } = await import("@/lib/workspace/visual-editor");
            if (width !== null) {
              source = patchFileContent(sourceFile, source, sourceId, { kind: "style", property: "width", value: `${width}px` });
            }
            if (height !== null) {
              source = patchFileContent(sourceFile, source, sourceId, { kind: "style", property: "height", value: `${height}px` });
            }
          }
        } else {
          // ── D. Dynamic / Direct Edit ──
          openTab(sourceFile);
          useWorkspaceStore.getState().setView("workspace");
          if (typeof window !== "undefined") {
            (window as unknown as { __lucianRevealSourceId?: string }).__lucianRevealSourceId = sourceId;
          }
          return;
        }
        await store.writeFile(sourceFile, source);
        store.refreshPreview();
      } catch {
        // Non-fatal.
      }
    },
    [activeProject, openTab, visualEditorPrefs.snapshotBeforeStructuralEdit],
  );

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
                      hint="This project doesn't have a previewable entry — use Direct Edit or the Workspace Code editor."
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
                onDirectEdit={handleDirectEdit}
                onCanvasReorder={handleCanvasReorder}
                onCanvasResize={handleCanvasResize}
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
                        sourceFile={selectedSourceFile}
                        sourceId={selectedSourceId}
                        onDirectEdit={handleDirectEdit}
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
  // Pages = all HTML files in the project (HTML projects) OR the detected
  // entry component (React/Vite/Next.js projects).
  if (analysis.htmlFiles.length === 0) {
    return (
      <DisabledPanel
        label={analysis.entryFile ? "Entry" : "No previewable entry"}
        hint={
          analysis.entryFile
            ? `Active entry: ${analysis.entryFile}`
            : "Add an index.html, App.tsx, or app/page.tsx to enable the visual preview."
        }
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

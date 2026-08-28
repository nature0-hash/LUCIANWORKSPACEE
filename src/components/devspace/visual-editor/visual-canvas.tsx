"use client";

// Visual Editor Canvas — Phase 12 final integration pass.
//
// Active rendering path:
//   - HTML projects   → `buildActivePreviewDoc()` → buildHtmlPreview.
//   - React / Vite    → `buildActivePreviewDoc()` → buildReactPreview
//                        (Babel JSX source-instrumentation plugin runs).
//   - Next.js         → `buildActivePreviewDoc()` → buildReactPreview
//                        (Next.js subset; server-only APIs mocked).
//   - Vue             → `buildActivePreviewDoc()` → buildVuePreview.
//
// The same `preview-engine.ts:buildPreviewDoc()` pipeline powers every
// framework — VisualCanvas no longer has its own `inlineAssets()` path.
//
// Coordinate system:
//   The overlay layer is a sibling of the iframe INSIDE the scaled
//   wrapper (the div with `transform: scale(zoom)`). All overlay
//   coordinates are in CANVAS space = pre-transform CSS pixels / zoom.
//   We use the helpers in `canvas-coords.ts` to convert pointer events
//   and iframe rects.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ZoomIn, ZoomOut, Monitor, Tablet, Smartphone } from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { useWorkspaceStore } from "@/store/workspace";
import { useSettingsStore } from "@/store/settings";
import {
  type VisualNode,
} from "@/lib/workspace/visual-editor";
import { buildActivePreviewDoc } from "@/lib/workspace/active-preview";
import {
  canvasDeltaFromPointerDelta,
  iframeRectToOverlayRect,
} from "@/lib/workspace/canvas-coords";
import { cn } from "@/lib/utils";

interface VisualCanvasProps {
  entryFile: string;
  onInspection: (root: VisualNode) => void;
  onSelect: (nodeId: string | null, sourceFile: string | null, sourceId: string | null) => void;
  selectedId: string | null;
  onDirectEdit: (sourceFile: string, sourceId: string) => void;
  /** Phase 12 final: callback for canvas-driven source mutations. */
  onCanvasReorder: (sourceId: string, targetSourceId: string, position: "before" | "after") => void;
  onCanvasResize: (sourceId: string, width: number | null, height: number | null) => void;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

/** Resize handle positions. */
type HandlePos = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const HANDLES: HandlePos[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** A rect in CANVAS-space (already divided by zoom). */
interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function VisualCanvas({
  entryFile,
  onInspection,
  onSelect,
  selectedId,
  onDirectEdit,
  onCanvasReorder,
  onCanvasResize,
}: VisualCanvasProps) {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const previewKey = useWorkspaceStore((s) => s.previewKey);
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview);
  const previewMode = useWorkspaceStore((s) => s.previewMode);
  const getActiveProjectFiles = useWorkspaceStore((s) => s.getActiveProjectFiles);

  // Settings → DevWorkspace → Visual Editor → defaultResponsiveBreakpoint.
  // Sets the initial device mode for the canvas. "auto" maps to "desktop".
  const defaultBreakpoint = useSettingsStore((s) => s.devWorkspace.visualEditor.defaultResponsiveBreakpoint);
  const [device, setDevice] = useState<DeviceMode>(
    defaultBreakpoint === "tablet" ? "tablet" : defaultBreakpoint === "mobile" ? "mobile" : "desktop"
  );
  const [zoom, setZoom] = useState(1);
  const [doc, setDoc] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Drag/resize interaction state.
  const [selectedRect, setSelectedRect] = useState<CanvasRect | null>(null);
  const [dragState, setDragState] = useState<{
    sourceId: string;
    sourceFile: string;
    startX: number;
    startY: number;
    dropTargetId: string | null;
    dropPosition: "before" | "after" | null;
    dropRect: CanvasRect | null;
  } | null>(null);
  const [resizeState, setResizeState] = useState<{
    handle: HandlePos;
    sourceId: string;
    sourceFile: string;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
  } | null>(null);
  const [tempDims, setTempDims] = useState<{ width: number; height: number } | null>(null);

  // Load + transpile the active preview through the unified preview-engine pipeline.
  const loadDoc = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const files = await getActiveProjectFiles();
      const doc = buildActivePreviewDoc({
        project: activeProject,
        files,
        framework: activeProject.framework,
        mode: previewMode,
        envVars: activeProject.envVars,
        entryFile,
      });
      setDoc(doc);
    } finally {
      setLoading(false);
    }
  }, [activeProject, entryFile, previewMode, getActiveProjectFiles]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadDoc();
    });
    return () => {
      cancelled = true;
    };
  }, [loadDoc, previewKey]);

  // Listen for messages from the iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "lucian-visual-inspection" && data.root) {
        onInspection(data.root as VisualNode);
      } else if (data.type === "lucian-visual-select") {
        onSelect(
          typeof data.id === "string" ? data.id : null,
          typeof data.sourceFile === "string" ? data.sourceFile : null,
          typeof data.sourceId === "string" ? data.sourceId : null,
        );
        // Update selectedRect by querying the iframe DOM.
        if (iframeRef.current?.contentWindow && data.id) {
          try {
            const raw = (iframeRef.current.contentWindow as unknown as {
              __lucianGetElementRect?: (id: string) => {
                left: number; top: number; width: number; height: number;
                right: number; bottom: number; x: number; y: number;
              } | null;
            }).__lucianGetElementRect?.(data.id);
            if (raw) {
              // The iframe returns pre-transform CSS pixels (IFRAME-LOCAL space).
              // Convert to CANVAS space (what the overlay lives in).
              setSelectedRect(iframeRectToOverlayRect(raw, zoom));
            }
          } catch {
            // Cross-origin — ignore.
          }
        }
      } else if (data.type === "lucian-visual-drag-target") {
        // Drop target candidate during drag — the iframe returns rect
        // in IFRAME-LOCAL space; convert to CANVAS space.
        const rawRect = data.rect as
          | { left: number; top: number; width: number; height: number; right: number; bottom: number; x: number; y: number }
          | null;
        const canvasRect = rawRect ? iframeRectToOverlayRect(rawRect, zoom) : null;
        setDragState((prev) =>
          prev
            ? {
                ...prev,
                dropTargetId: typeof data.targetId === "string" ? data.targetId : null,
                dropPosition: data.position === "before" || data.position === "after" ? data.position : null,
                dropRect: canvasRect,
              }
            : null,
        );
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onInspection, onSelect, zoom]);

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "lucian-visual-request-inspection" },
      "*",
    );
  }, []);

  // Highlight selected element in the iframe + refresh its overlay rect.
  useEffect(() => {
    if (!selectedId) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: "lucian-visual-highlight", id: selectedId },
      "*",
    );
    if (iframeRef.current?.contentWindow) {
      try {
        const raw = (iframeRef.current.contentWindow as unknown as {
          __lucianGetElementRect?: (id: string) => {
            left: number; top: number; width: number; height: number;
            right: number; bottom: number; x: number; y: number;
          } | null;
        }).__lucianGetElementRect?.(selectedId);
        if (raw) {
          setSelectedRect(iframeRectToOverlayRect(raw, zoom));
        }
      } catch {
        // ignore
      }
    }
  }, [selectedId, previewKey, zoom]);

  // Re-fetch the selected element's rect when zoom or device changes.
  // (The iframe-local rect stays the same in CSS pixels, but the CANVAS-
  // space overlay rect changes because we divide by zoom.)
  useEffect(() => {
    if (!selectedId || !iframeRef.current?.contentWindow) return;
    try {
      const raw = (iframeRef.current.contentWindow as unknown as {
        __lucianGetElementRect?: (id: string) => {
          left: number; top: number; width: number; height: number;
          right: number; bottom: number; x: number; y: number;
        } | null;
      }).__lucianGetElementRect?.(selectedId);
      if (raw) setSelectedRect(iframeRectToOverlayRect(raw, zoom));
    } catch {
      // ignore
    }
  }, [zoom, device, selectedId]);

  // ── Drag/resize pointer handlers ──
  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!selectedId || !selectedRect) return;
      e.stopPropagation();
      e.preventDefault();
      const w = window as unknown as { __lucianSelectedSourceFile?: string; __lucianSelectedSourceId?: string };
      const sourceFile = w.__lucianSelectedSourceFile ?? "";
      const sourceId = w.__lucianSelectedSourceId ?? selectedId;
      if (!sourceFile || !sourceId) return;
      setDragState({
        sourceId,
        sourceFile,
        startX: e.clientX,
        startY: e.clientY,
        dropTargetId: null,
        dropPosition: null,
        dropRect: null,
      });
    },
    [selectedId, selectedRect],
  );

  const startResize = useCallback(
    (e: React.PointerEvent, handle: HandlePos) => {
      if (!selectedId || !selectedRect) return;
      e.stopPropagation();
      e.preventDefault();
      const w = window as unknown as { __lucianSelectedSourceFile?: string; __lucianSelectedSourceId?: string };
      const sourceFile = w.__lucianSelectedSourceFile ?? "";
      const sourceId = w.__lucianSelectedSourceId ?? selectedId;
      if (!sourceFile || !sourceId) return;
      setResizeState({
        handle,
        sourceId,
        sourceFile,
        startWidth: selectedRect.width,
        startHeight: selectedRect.height,
        startX: e.clientX,
        startY: e.clientY,
      });
      setTempDims({ width: selectedRect.width, height: selectedRect.height });
    },
    [selectedId, selectedRect],
  );

  // Global pointermove + pointerup handlers during drag/resize.
  useEffect(() => {
    if (!dragState && !resizeState) return;

    function onPointerMove(e: PointerEvent) {
      if (resizeState) {
        // Compute pointer delta in CLIENT space, then convert to CANVAS space.
        const delta = canvasDeltaFromPointerDelta(
          e.clientX - resizeState.startX,
          e.clientY - resizeState.startY,
          zoom,
        );
        let newWidth = resizeState.startWidth;
        let newHeight = resizeState.startHeight;
        const h = resizeState.handle;
        if (h.includes("e")) newWidth = Math.max(20, resizeState.startWidth + delta.x);
        if (h.includes("s")) newHeight = Math.max(20, resizeState.startHeight + delta.y);
        if (h.includes("w")) newWidth = Math.max(20, resizeState.startWidth - delta.x);
        if (h.includes("n")) newHeight = Math.max(20, resizeState.startHeight - delta.y);
        setTempDims({ width: newWidth, height: newHeight });
        return;
      }
      if (dragState) {
        // Ask the iframe to find the drop target under the pointer.
        // The iframe's elementFromPoint wants IFRAME-LOCAL coords
        // (pre-transform), which is CLIENT minus iframe's origin.
        const iframeEl = iframeRef.current;
        if (!iframeEl) return;
        const iframeRect = iframeEl.getBoundingClientRect();
        const localX = e.clientX - iframeRect.left;
        const localY = e.clientY - iframeRect.top;
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: "lucian-visual-find-drop-target",
            clientX: e.clientX,
            clientY: e.clientY,
            localX,
            localY,
            excludeSourceId: dragState.sourceId,
          },
          "*",
        );
        return;
      }
    }

    function onPointerUp() {
      if (resizeState) {
        // Commit ONE final source mutation. The new width/height is in
        // CANVAS space (CSS pixels pre-zoom), which is what the source
        // file expects — `width: 200px` means 200 CSS pixels regardless
        // of the preview's zoom.
        onCanvasResize(
          resizeState.sourceId,
          Math.round(tempDims?.width ?? resizeState.startWidth),
          Math.round(tempDims?.height ?? resizeState.startHeight),
        );
        setResizeState(null);
        setTempDims(null);
        return;
      }
      if (dragState) {
        if (dragState.dropTargetId && dragState.dropPosition) {
          onCanvasReorder(
            dragState.sourceId,
            dragState.dropTargetId,
            dragState.dropPosition,
          );
        }
        setDragState(null);
        return;
      }
    }

    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragState, resizeState, tempDims, zoom, onCanvasReorder, onCanvasResize]);

  // Derived overlay rect for the selected element. Both selectedRect and
  // tempDims are already in CANVAS space, so no further zoom math.
  const overlayRect = useMemo<CanvasRect | null>(() => {
    if (!selectedRect) return null;
    return {
      left: selectedRect.left,
      top: selectedRect.top,
      width: tempDims?.width ?? selectedRect.width,
      height: tempDims?.height ?? selectedRect.height,
    };
  }, [selectedRect, tempDims]);

  return (
    <div className="relative flex h-full flex-col bg-zinc-100 dark:bg-zinc-900">
      {/* Canvas toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-1">
          <Button variant={device === "desktop" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setDevice("desktop")} title="Desktop (1280px)">
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button variant={device === "tablet" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setDevice("tablet")} title="Tablet (768px)">
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button variant={device === "mobile" ? "default" : "ghost"} size="sm" className="h-7 px-2" onClick={() => setDevice("mobile")} title="Mobile (375px)">
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
          <span className="ml-2 text-[10px] text-muted-foreground">{DEVICE_WIDTHS[device]}px</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} title="Zoom out">
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center font-mono text-[10px]">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} title="Zoom in">
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { void loadDoc(); refreshPreview(); }} title="Refresh preview">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
      >
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading preview…</div>
        ) : (
          <div
            ref={wrapperRef}
            style={{
              width: `${DEVICE_WIDTHS[device]}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
            className="relative h-full max-h-[2000px] rounded-md border border-border/50 bg-background shadow-lg"
          >
            <iframe
              ref={iframeRef}
              title="visual-editor-canvas"
              srcDoc={doc}
              onLoad={handleIframeLoad}
              className="h-full w-full border-0 bg-background"
              sandbox="allow-scripts allow-same-origin"
            />
            {/* Overlay layer for selection, resize handles, drag/drop indicators. */}
            {overlayRect && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${overlayRect.left}px`,
                  top: `${overlayRect.top}px`,
                  width: `${overlayRect.width}px`,
                  height: `${overlayRect.height}px`,
                }}
              >
                {/* Selection outline */}
                <div
                  className={cn(
                    "absolute inset-0 border-2 transition-colors",
                    dragState
                      ? "border-blue-500 cursor-grabbing"
                      : "border-blue-500/80 cursor-grab",
                  )}
                  onPointerDown={startDrag}
                  style={{ pointerEvents: dragState || resizeState ? "none" : "auto" }}
                />
                {/* Resize handles (8) */}
                {!dragState && HANDLES.map((h) => (
                  <ResizeHandle
                    key={h}
                    handle={h}
                    onPointerDown={(e) => startResize(e, h)}
                  />
                ))}
              </div>
            )}
            {/* Drag/drop insertion indicator */}
            {dragState?.dropTargetId && dragState?.dropPosition && dragState.dropRect ? (
              <DropIndicator
                position={dragState.dropPosition}
                rect={dragState.dropRect}
              />
            ) : null}
          </div>
        )}
      </div>

      {/* Selection info bar */}
      {selectedId ? (
        <SelectionInfoBar selectedId={selectedId} onDirectEdit={onDirectEdit} />
      ) : null}
    </div>
  );
}

/** A single resize handle (small square at the element's edge/corner). */
function ResizeHandle({
  handle,
  onPointerDown,
}: {
  handle: HandlePos;
  onPointerDown: (e: React.PointerEvent) => void;
}) {
  const position: Record<HandlePos, React.CSSProperties> = {
    n: { top: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    s: { bottom: -4, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    e: { right: -4, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
    w: { left: -4, top: "50%", transform: "translateY(-50%)", cursor: "ew-resize" },
    ne: { top: -4, right: -4, cursor: "nesw-resize" },
    nw: { top: -4, left: -4, cursor: "nwse-resize" },
    se: { bottom: -4, right: -4, cursor: "nwse-resize" },
    sw: { bottom: -4, left: -4, cursor: "nesw-resize" },
  };
  return (
    <div
      onPointerDown={onPointerDown}
      className="absolute z-10 h-2 w-2 rounded-sm border border-white bg-blue-500 shadow-sm"
      style={{
        ...position[handle],
        pointerEvents: "auto",
      }}
    />
  );
}

/** Drop insertion indicator — a colored line showing where the element will land. */
function DropIndicator({
  position,
  rect,
}: {
  position: "before" | "after";
  rect: CanvasRect;
}) {
  const indicatorStyle: React.CSSProperties =
    position === "before"
      ? { top: `${rect.top - 1}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: "2px" }
      : { top: `${rect.top + rect.height - 1}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: "2px" };
  return (
    <div
      className="pointer-events-none absolute z-20 bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]"
      style={indicatorStyle}
    />
  );
}

/**
 * Selection info bar — shows the source mapping + Direct Edit button.
 */
function SelectionInfoBar({
  selectedId,
  onDirectEdit,
}: {
  selectedId: string;
  onDirectEdit: (sourceFile: string, sourceId: string) => void;
}) {
  const sourceFile = typeof window !== "undefined" ? (window as unknown as { __lucianSelectedSourceFile?: string }).__lucianSelectedSourceFile : undefined;
  const sourceId = typeof window !== "undefined" ? (window as unknown as { __lucianSelectedSourceId?: string }).__lucianSelectedSourceId : undefined;
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0">Selected:</span>
        <code className="font-mono text-[10px]">{selectedId}</code>
        {sourceFile ? (
          <>
            <span className="text-fg-faint">·</span>
            <span className="truncate font-mono text-[10px] text-fg-muted">{sourceFile}</span>
          </>
        ) : null}
        {sourceId ? <code className="font-mono text-[9px] text-fg-faint">{sourceId}</code> : null}
      </div>
      {sourceFile && sourceId ? (
        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => onDirectEdit(sourceFile, sourceId)}>
          Direct Edit →
        </Button>
      ) : null}
    </div>
  );
}

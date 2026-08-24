"use client";

// Visual Editor Canvas.
//
// Renders the project's current page in an iframe with an injected
// inspection script. The script assigns stable data-lucid-id attributes
// to every element, listens for clicks, and posts the full DOM tree
// back to the parent.
//
// The canvas also handles:
//   - zoom / pan
//   - responsive breakpoint switching (desktop/tablet/mobile)
//   - click → selection (via postMessage from the iframe)
//   - sending "request inspection" messages to refresh the Layers tree

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { useWorkspaceStore } from "@/store/workspace";
import {
  buildInspectionScript,
  type IframeInspectionMessage,
  type VisualNode,
} from "@/lib/workspace/visual-editor";
import { cn } from "@/lib/utils";

interface VisualCanvasProps {
  /** Path of the HTML file to render. */
  entryFile: string;
  /** Called when the iframe sends a fresh DOM inspection. */
  onInspection: (root: VisualNode) => void;
  /** Called when the user clicks an element inside the iframe. */
  onSelect: (nodeId: string | null) => void;
  /** Currently selected element id (for highlight overlay). */
  selectedId: string | null;
}

type DeviceMode = "desktop" | "tablet" | "mobile";

const DEVICE_WIDTHS: Record<DeviceMode, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

export function VisualCanvas({
  entryFile,
  onInspection,
  onSelect,
  selectedId,
}: VisualCanvasProps) {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const previewKey = useWorkspaceStore((s) => s.previewKey);
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview);
  const loadAllFileContents = useWorkspaceStore((s) => s.loadAllFileContents);

  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [zoom, setZoom] = useState(1);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load the entry file's content.
  const loadHtml = useCallback(async () => {
    if (!activeProject) return;
    setLoading(true);
    try {
      const contents = await loadAllFileContents(activeProject.id);
      const content = contents.get(entryFile);
      if (typeof content !== "string") {
        setHtml("<!DOCTYPE html><body>Entry file not found.</body>");
        return;
      }
      // Inline CSS and JS so the iframe is fully self-contained.
      const inlined = inlineAssets(content, contents);
      setHtml(inlined);
    } finally {
      setLoading(false);
    }
  }, [activeProject, entryFile, loadAllFileContents]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadHtml();
    });
    return () => {
      cancelled = true;
    };
  }, [loadHtml, previewKey]);

  // Inject the inspection script into the HTML.
  const srcDoc = useMemo(() => {
    if (!html) return "";
    const script = `<script>${buildInspectionScript()}</script>`;
    // Inject the script right before </body> (or append if no body).
    if (/<\/body>/i.test(html)) {
      return html.replace(/<\/body>/i, `${script}</body>`);
    }
    return html + script;
  }, [html]);

  // Listen for messages from the iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "lucian-visual-inspection" && data.root) {
        onInspection(data.root as VisualNode);
      } else if (data.type === "lucian-visual-select") {
        onSelect(typeof data.id === "string" ? data.id : null);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onInspection, onSelect]);

  // Request inspection when iframe loads + when previewKey changes.
  const handleIframeLoad = useCallback(() => {
    setLoading(false);
    iframeRef.current?.contentWindow?.postMessage(
      { type: "lucian-visual-request-inspection" },
      "*",
    );
  }, []);

  return (
    <div className="relative flex h-full flex-col bg-zinc-100 dark:bg-zinc-900">
      {/* Canvas toolbar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-1">
          {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((d) => (
            <Button
              key={d}
              variant={device === d ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs capitalize"
              onClick={() => setDevice(d)}
            >
              {d}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-10 text-center font-mono text-[10px]">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => {
              void loadHtml();
              refreshPreview();
            }}
            title="Refresh preview"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading preview…</div>
        ) : (
          <div
            style={{
              width: `${DEVICE_WIDTHS[device]}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "top center",
            }}
            className="h-full max-h-[2000px] rounded-md border border-border/50 bg-background shadow-lg"
          >
            <iframe
              ref={iframeRef}
              title="visual-editor-canvas"
              srcDoc={srcDoc}
              onLoad={handleIframeLoad}
              className="h-full w-full border-0 bg-background"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}
      </div>

      {/* Selection info bar */}
      {selectedId ? (
        <div className="shrink-0 border-t bg-card px-3 py-1.5 text-xs text-muted-foreground">
          Selected: <code className="font-mono">{selectedId}</code>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Inline CSS and JS references into the HTML so the iframe is fully
 * self-contained (no need for a web server to serve the project files).
 *
 * Supports:
 *   <link rel="stylesheet" href="./styles.css">  → <style>...</style>
 *   <script src="./script.js"></script>           → <script>...</script>
 *   <img src="./logo.png">                        → <img src="data:...">
 *
 * References that we can't resolve (cross-origin, not in the project) are
 * left untouched.
 */
function inlineAssets(
  html: string,
  contents: Map<string, string>,
): string {
  let out = html;

  // <link rel="stylesheet" href="X">
  out = out.replace(
    /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const path = normalizePath(href);
      const content = contents.get(path);
      if (typeof content === "string") {
        return `<style>\n${content}\n</style>`;
      }
      return match;
    },
  );

  // <script src="X"></script>
  out = out.replace(
    /<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi,
    (match, src) => {
      const path = normalizePath(src);
      const content = contents.get(path);
      if (typeof content === "string") {
        return `<script>\n${content}\n</script>`;
      }
      return match;
    },
  );

  // <img src="X"> — base64-inline binary files stored as data URLs.
  out = out.replace(
    /(<img[^>]*src=["'])([^"']+)(["'][^>]*>)/gi,
    (match, prefix, src, suffix) => {
      if (src.startsWith("data:") || src.startsWith("http")) return match;
      const path = normalizePath(src);
      const content = contents.get(path);
      if (typeof content === "string" && content.startsWith("data:")) {
        return `${prefix}${content}${suffix}`;
      }
      return match;
    },
  );

  return out;
}

function normalizePath(href: string): string {
  return href.replace(/^\.?\//, "").replace(/^\.\\/, "");
}

void cn; // (silence unused-import warnings when not used elsewhere)

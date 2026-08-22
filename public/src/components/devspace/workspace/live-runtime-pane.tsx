"use client";

// Live Runtime pane — runs the active project inside a WebContainer and
// shows the real dev server in an iframe, with a collapsible terminal.
// This is the "any project runs for real" engine. Honest states only:
// every status shown reflects the actual container state.

import { useEffect, useRef, useState } from "react";
import {
  Play,
  Square,
  RefreshCw,
  Loader2,
  TerminalSquare,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  MousePointerClick,
  X,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui-devspace/button";
import { Badge } from "@/components/ui-devspace/badge";
import { cn } from "@/lib/utils";
import {
  getRuntimeState,
  isRuntimeSupported,
  startRuntime,
  stopRuntime,
  subscribeRuntime,
  subscribeTerminal,
  type RuntimeState,
} from "@/lib/workspace/webcontainer";
import { findElementInSource, type InspectedElement } from "@/lib/workspace/inspector";
import type { ProjectFile } from "@/types/workspace";

const STATUS_LABELS: Record<RuntimeState["status"], string> = {
  idle: "Not started",
  unsupported: "Unsupported browser",
  booting: "Booting runtime…",
  mounting: "Mounting files…",
  installing: "Installing dependencies…",
  starting: "Starting dev server…",
  running: "Running",
  error: "Error",
  stopped: "Stopped",
};

export function LiveRuntimePane() {
  const { activeProject, activeProjectId, loadAllFileContents } = useWorkspaceStore();
  const [runtime, setRuntime] = useState<RuntimeState>(getRuntimeState());
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalText, setTerminalText] = useState("");
  const [launching, setLaunching] = useState(false);
  const [inspectMode, setInspectMode] = useState(false);
  const [inspectHits, setInspectHits] = useState<{
    element: InspectedElement;
    matches: { path: string; line: number; preview: string }[];
  } | null>(null);
  const terminalRef = useRef<HTMLPreElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const openTab = useWorkspaceStore((s) => s.openTab);

  // Toggle inspect mode inside the running project.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: "lucian-inspect-toggle", enabled: inspectMode },
      "*",
    );
  }, [inspectMode]);

  // Receive clicked-element reports from the injected inspector.
  useEffect(() => {
    const onMessage = async (e: MessageEvent) => {
      if (e.data?.type !== "lucian-inspect-click" || !e.data.element) return;
      const element = e.data.element as InspectedElement;
      const state = useWorkspaceStore.getState();
      if (!state.activeProject || !state.activeProjectId) return;
      await state.loadAllFileContents(state.activeProjectId);
      const cache = useWorkspaceStore.getState().contentCache;
      const files = state.activeProject.files.map((f) => ({
        path: f.path,
        binary: f.binary,
        content: f.binary ? "" : (cache.get(f.path) ?? ""),
      }));
      const matches = findElementInSource(element, files);
      setInspectHits({ element, matches });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => subscribeRuntime(setRuntime), []);
  useEffect(
    () =>
      subscribeTerminal((chunk) => {
        setTerminalText((t) => {
          const next = t + chunk;
          // Keep the buffer bounded (~200KB).
          return next.length > 200_000 ? next.slice(-150_000) : next;
        });
      }),
    [],
  );

  // Auto-scroll terminal.
  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [terminalText]);

  const supported = isRuntimeSupported();

  const handleStart = async () => {
    if (!activeProject || !activeProjectId) return;
    setLaunching(true);
    setTerminalText("");
    try {
      await loadAllFileContents(activeProjectId);
      const { getManyFileContents } = await import("@/lib/workspace/db");
      const binaryPaths = activeProject.files.filter((f) => f.binary).map((f) => f.path);
      const binaryContents = await getManyFileContents(activeProjectId, binaryPaths);
      const cache = useWorkspaceStore.getState().contentCache;
      const files: ProjectFile[] = activeProject.files.map((f) => ({
        ...f,
        content: f.binary
          ? (binaryContents.get(f.path) ?? "")
          : (cache.get(f.path) ?? ""),
      }));
      await startRuntime({
        projectId: activeProjectId,
        files,
        envVars: activeProject.envVars,
      });
    } finally {
      setLaunching(false);
    }
  };

  if (!activeProject) return null;

  const busy =
    launching ||
    runtime.status === "booting" ||
    runtime.status === "mounting" ||
    runtime.status === "installing" ||
    runtime.status === "starting";

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <div className="flex h-9 shrink-0 items-center justify-between border-b bg-card px-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live Runtime
          </span>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              runtime.status === "running" && "border-emerald-500/40 text-emerald-600",
              runtime.status === "error" && "border-destructive/40 text-destructive",
              busy && "border-amber-500/40 text-amber-600",
            )}
          >
            {busy && <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />}
            {STATUS_LABELS[runtime.status]}
          </Badge>
          {runtime.strategy && (
            <Badge variant="secondary" className="text-[10px]">{runtime.strategy}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {runtime.status === "running" ? (
            <>
              <Button
                variant={inspectMode ? "default" : "ghost"}
                size="icon"
                className="h-7 w-7"
                title={inspectMode ? "Exit inspect mode" : "Inspect element (click any element in the preview to find its source)"}
                onClick={() => setInspectMode((v) => !v)}
              >
                <MousePointerClick className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Restart" onClick={handleStart}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {runtime.serverUrl && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  title="Open in new tab"
                  onClick={() => window.open(runtime.serverUrl!, "_blank", "noopener,noreferrer")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Stop" onClick={() => stopRuntime()}>
                <Square className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button size="sm" className="h-7 gap-1.5 px-2.5 text-xs" disabled={busy || !supported} onClick={handleStart}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run Project
            </Button>
          )}
        </div>
      </div>

      {/* Unsupported browser — honest message, no fakery */}
      {!supported && (
        <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            The live runtime needs a Chromium browser (Chrome/Edge) with cross-origin isolation.
            Use the Preview tab for the instant static engine instead.
          </span>
        </div>
      )}

      {/* Error banner */}
      {runtime.status === "error" && runtime.error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <span className="font-semibold">Runtime error: </span>
          {runtime.error}
        </div>
      )}

      {/* Server iframe */}
      <div className="relative flex-1 overflow-hidden bg-background">
        {runtime.status === "running" && runtime.serverUrl ? (
          <iframe
            ref={iframeRef}
            src={runtime.serverUrl}
            className="h-full w-full border-0"
            title="Live project"
            allow="cross-origin-isolated"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-sm text-muted-foreground">
              {busy ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>{STATUS_LABELS[runtime.status]}</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 px-6">
                  <TerminalSquare className="h-8 w-8 opacity-40" />
                  <span>
                    Press <strong>Run Project</strong> to boot a real dev server for this
                    project — npm install, hot reload, real APIs.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Inspect results — clicked element → source locations */}
      {inspectHits && (
        <div className="shrink-0 border-t bg-card px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold">
              <MousePointerClick className="mr-1 inline h-3 w-3 text-primary" />
              &lt;{inspectHits.element.tag}&gt;
              {inspectHits.element.id && `#${inspectHits.element.id}`}
              {inspectHits.element.text && (
                <span className="ml-1.5 font-normal text-muted-foreground">
                  &quot;{inspectHits.element.text.slice(0, 50)}{inspectHits.element.text.length > 50 ? "…" : ""}&quot;
                </span>
              )}
            </span>
            <button onClick={() => setInspectHits(null)} className="rounded p-0.5 hover:bg-accent">
              <X className="h-3 w-3" />
            </button>
          </div>
          {inspectHits.matches.length === 0 ? (
            <p className="mt-1 text-[10px] text-muted-foreground">
              No matching source lines found (dynamic content or generated markup).
            </p>
          ) : (
            <div className="mt-1 max-h-24 space-y-0.5 overflow-y-auto">
              {inspectHits.matches.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { openTab(m.path); setInspectHits(null); setInspectMode(false); }}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-[10px] hover:bg-accent"
                  title="Open in editor"
                >
                  <span className="shrink-0 font-mono text-primary">{m.path}:{m.line}</span>
                  <span className="truncate font-mono text-muted-foreground">{m.preview}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Terminal */}
      <div className="shrink-0 border-t bg-card">
        <button
          className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50"
          onClick={() => setTerminalOpen((o) => !o)}
        >
          <span className="flex items-center gap-1.5">
            <TerminalSquare className="h-3.5 w-3.5" /> Terminal
          </span>
          {terminalOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>
        {terminalOpen && (
          <pre
            ref={terminalRef}
            className="max-h-40 min-h-24 overflow-auto whitespace-pre-wrap break-words border-t bg-black/90 px-3 py-2 font-mono text-[11px] leading-snug text-green-400"
          >
            {terminalText || "[lucian] Terminal output will appear here when the runtime starts.\n"}
          </pre>
        )}
      </div>
    </div>
  );
}

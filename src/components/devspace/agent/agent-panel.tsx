"use client";

// Project Agent panel.
//
// ONE single header at the top — no nested "Project Agent" rows.
// All controls (model selector, tools menu, settings) live NEXT to the
// composer at the bottom — closer to the action surface, like a real
// professional coding-assistant pane.
//
// This is the same Agent component used in both the Workspace AND the
// Visual Editor Studio. It is project-scoped: it reads the active project
// from the DevWorkspace Zustand store, loads the conversation for that
// project from IndexedDB, and submits messages through the currently
// registered ModelProvider. The conversation follows the project across
// Workspace ↔ Visual Editor Studio.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Cpu,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { Textarea } from "@/components/ui-devspace/textarea";
import { Badge } from "@/components/ui-devspace/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-devspace/dialog";
import { useWorkspaceStore } from "@/store/workspace";
import {
  getModelProvider,
  runAgentTurn,
  type AgentMessage,
  type AgentTool,
  type ToolContext,
} from "@/lib/agent/types";
import { buildProjectTools } from "@/lib/agent/tools";
import { loadConversation, saveConversation, deleteConversation } from "@/lib/agent/persistence";
import { frameworkLabel, formatBytes } from "@/lib/workspace/filesystem";
import { cn } from "@/lib/utils";

const SYSTEM_PROMPT = `You are the LUCIAN Project Agent.
You are scoped to a single user project that lives in the browser (IndexedDB).
You have access to a curated set of project-aware tools. Use them to inspect the project, answer questions, propose changes, and help the user get the project running.
When you make file changes, call the write_file tool with the full new file content — never partial patches.
When you don't know something, say so honestly. Never fabricate framework errors, npm output, or AI responses.`;

interface AgentPanelProps {
  /**
   * When true, the panel renders in a tighter form factor. The composer
   * + message list still occupy the full height; only the typography
   * is slightly smaller. Defaults to false (full).
   */
  compact?: boolean;
}

export function AgentPanel({ compact = false }: AgentPanelProps) {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const loadFileContent = useWorkspaceStore((s) => s.loadFileContent);
  const getActiveProjectFiles = useWorkspaceStore((s) => s.getActiveProjectFiles);
  const writeFile = useWorkspaceStore((s) => s.writeFile);
  const rescanActiveProject = useWorkspaceStore((s) => s.rescanActiveProject);
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview);

  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsMenuOpen, setToolsMenuOpen] = useState(false);
  const [provider, setProvider] = useState(getModelProvider());
  const scrollRef = useRef<HTMLDivElement>(null);

  const tools = useMemo(() => buildProjectTools(), []);

  const toolContext: ToolContext = useMemo(
    () => ({
      project: activeProject,
      files: [],
      readFile: async (path) => {
        if (!activeProject) return undefined;
        return loadFileContent(activeProject.id, path);
      },
      writeFile: async (path, content) => {
        await writeFile(path, content);
        refreshPreview();
      },
      scanProject: async () => {
        await rescanActiveProject();
      },
      getRuntimeStatus: async () => {
        const { getRuntimeState } = await import("@/lib/workspace/webcontainer");
        const s = getRuntimeState();
        return {
          status: s.status,
          serverUrl: s.serverUrl,
          error: s.error,
        };
      },
      getTerminalOutput: async () => {
        const { getTerminalBuffer } = await import("@/lib/workspace/webcontainer");
        return getTerminalBuffer();
      },
    }),
    [activeProject, loadFileContent, writeFile, refreshPreview, rescanActiveProject],
  );

  const loadConversationForProject = useCallback(async () => {
    if (!activeProject) {
      setMessages([]);
      return;
    }
    const conv = await loadConversation(activeProject.id);
    setMessages(conv?.messages ?? []);
  }, [activeProject]);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      void loadConversationForProject();
    });
    return () => {
      cancelled = true;
    };
  }, [loadConversationForProject]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  // Close popovers on outside click / Escape.
  useEffect(() => {
    if (!toolsMenuOpen) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      const menu = document.querySelector('[data-agent-tools-menu="true"]');
      if (menu && !menu.contains(target)) setToolsMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setToolsMenuOpen(false);
    }
    const t = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKey);
    }, 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [toolsMenuOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    try {
      if (activeProject) {
        await getActiveProjectFiles();
      }
      const newMessages = await runAgentTurn(
        text,
        toolContext,
        tools,
        messages,
        SYSTEM_PROMPT,
      );
      const next = [...messages, ...newMessages];
      setMessages(next);
      if (activeProject) {
        await saveConversation({
          projectId: activeProject.id,
          messages: next,
          updatedAt: Date.now(),
        });
      }
      setProvider(getModelProvider());
    } catch (err) {
      const errorMsg: AgentMessage = {
        id: `msg_err_${Date.now()}`,
        role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: Date.now(),
        fromModel: false,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setBusy(false);
    }
  };

  const handleClearConversation = async () => {
    if (!activeProject) return;
    await deleteConversation(activeProject.id);
    setMessages([]);
  };

  return (
    <div className="themed flex h-full flex-col bg-surface text-fg">
      {/* Single header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate text-xs font-medium">Project Agent</span>
          {activeProject ? (
            <span className="hidden truncate text-[10px] text-fg-faint lg:inline">
              · {activeProject.name}
            </span>
          ) : null}
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            title="Clear conversation"
            onClick={handleClearConversation}
            className="focus-ring themed inline-flex h-5 w-5 items-center justify-center rounded text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {/* Provider status (only when no provider configured) */}
      {!provider.configured ? (
        <div className="border-b border-amber-500/30 bg-amber-500/5 px-3 py-1.5 text-[10px] text-amber-600 dark:text-amber-400">
          No model provider configured — agent can use tools on request, but AI replies are disabled.
        </div>
      ) : null}

      {/* Messages */}
      <div
        ref={scrollRef}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto px-3 py-2",
          compact && "text-xs",
        )}
      >
        {messages.length === 0 ? (
          <EmptyConversation hasProject={!!activeProject} providerConfigured={provider.configured} />
        ) : (
          <ul className="space-y-2">
            {messages.map((m) => (
              <MessageRow key={m.id} message={m} />
            ))}
            {busy ? (
              <li className="flex items-center gap-2 text-[11px] text-fg-muted">
                <Sparkles className="h-3 w-3 animate-pulse text-accent" /> Thinking…
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Composer (with model/tools/settings controls at the bottom) */}
      <div className="shrink-0 border-t border-line-muted bg-surface-2/40 p-2">
        <div className="themed rounded-md border border-line bg-surface">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              activeProject
                ? "Ask about this project, or instruct the agent…"
                : "Open a project to start a conversation…"
            }
            disabled={busy}
            className="block w-full resize-none border-0 bg-transparent px-2.5 py-2 text-xs text-fg placeholder:text-fg-faint focus:outline-none"
            rows={2}
          />

          {/* Composer control row */}
          <div className="flex items-center justify-between gap-1 border-t border-line-muted px-1.5 py-1">
            <div className="flex min-w-0 items-center gap-0.5">
              {/* Model / provider selector */}
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                title={`Provider: ${provider.label}`}
                className={cn(
                  "focus-ring themed inline-flex h-6 max-w-[140px] items-center gap-1 rounded px-1.5 text-[10px] transition-colors",
                  provider.configured
                    ? "text-fg-muted hover:bg-hover hover:text-fg"
                    : "text-amber-600 dark:text-amber-400",
                )}
              >
                <Cpu className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{provider.configured ? provider.label : "No model"}</span>
                <ChevronDown className="h-2 w-2 shrink-0" />
              </button>

              {/* Tools menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setToolsMenuOpen((v) => !v)}
                  title="Available tools"
                  className="focus-ring themed inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-fg-muted transition-colors hover:bg-hover hover:text-fg"
                >
                  <Wrench className="h-2.5 w-2.5 shrink-0" />
                  <span className="hidden sm:inline">Tools</span>
                  <span className="rounded bg-surface-2 px-1 text-[9px] tabular-nums text-fg-faint">{tools.length}</span>
                  <ChevronDown className="h-2 w-2.5 shrink-0" />
                </button>
                {toolsMenuOpen ? (
                  <div
                    data-agent-tools-menu="true"
                    role="menu"
                    className="themed absolute bottom-full left-0 z-30 mb-1 w-56 rounded-md border border-line bg-overlay p-1 shadow-pop"
                  >
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
                      Project-aware tools
                    </div>
                    {tools.map((t) => (
                      <ToolRow key={t.name} tool={t} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={busy || !input.trim()}
              title="Send (Enter)"
              className={cn(
                "focus-ring themed inline-flex h-6 w-6 items-center justify-center rounded transition-colors",
                input.trim() && !busy
                  ? "bg-accent text-accent-fg hover:bg-accent-hover"
                  : "text-fg-faint",
              )}
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Project status (sub-label below the composer) */}
        {activeProject ? (
          <div className="mt-1 truncate text-[10px] text-fg-faint">
            {frameworkLabel(activeProject.framework)} · {activeProject.fileCount} files · {formatBytes(activeProject.totalSize)}
          </div>
        ) : null}
      </div>

      <AgentSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        provider={provider}
      />
    </div>
  );
}

function EmptyConversation({
  hasProject,
  providerConfigured,
}: {
  hasProject: boolean;
  providerConfigured: boolean;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center text-[11px] text-fg-faint">
      <Bot className="mb-2 h-7 w-7 opacity-40" />
      {!hasProject ? (
        <p>No active project. Open one to start a conversation.</p>
      ) : !providerConfigured ? (
        <p>Agent UI is ready. Connect a model provider to enable AI replies — or use Tools to inspect the project directly.</p>
      ) : (
        <p>Ask anything about this project. The agent can read files, scan services, edit files, and check the runtime.</p>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: AgentMessage }) {
  if (message.role === "tool") {
    return (
      <li className="themed rounded-md border border-line-muted bg-surface-2/40 px-2 py-1.5 text-[11px]">
        <div className="mb-0.5 flex items-center gap-1 font-medium text-fg-muted">
          <Wrench className="h-3 w-3 text-fg-faint" />
          Tool result: <code className="font-mono text-[10px] text-fg-faint">{message.toolName}</code>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-fg-muted">
          {message.content.slice(0, 1500)}
          {message.content.length > 1500 ? "\n…[truncated]" : ""}
        </pre>
      </li>
    );
  }
  const isUser = message.role === "user";
  return (
    <li
      className={cn(
        "flex flex-col gap-1",
        isUser ? "items-end" : "items-start",
      )}
    >
      <div className="flex items-center gap-1 text-[9px] text-fg-faint">
        {!isUser && !message.fromModel ? (
          <Badge variant="outline" className="h-3.5 px-1 text-[9px]">system</Badge>
        ) : null}
        {isUser ? "You" : "Agent"}
      </div>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-md px-2.5 py-1.5 text-xs",
          isUser
            ? "bg-accent text-accent-fg"
            : message.fromModel
            ? "bg-surface-2 text-fg"
            : "bg-surface-2/60 text-fg-muted italic",
        )}
      >
        {message.content}
      </div>
    </li>
  );
}

function ToolRow({ tool }: { tool: AgentTool }) {
  return (
    <div
      role="menuitem"
      className="themed rounded-sm px-2 py-1.5 text-left text-[11px]"
    >
      <div className="flex items-center gap-1.5">
        <Plus className="h-2.5 w-2.5 shrink-0 text-fg-faint" />
        <code className="font-mono text-[10px] text-fg">{tool.name}</code>
      </div>
      <p className="mt-0.5 pl-4 text-[10px] text-fg-faint">{tool.description}</p>
    </div>
  );
}

function AgentSettingsDialog({
  open,
  onOpenChange,
  provider,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  provider: ReturnType<typeof getModelProvider>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-4 py-2.5">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Cpu className="h-4 w-4" /> Agent provider
          </DialogTitle>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Close"
            className="focus-ring themed inline-flex h-6 w-6 items-center justify-center rounded text-fg-muted hover:bg-hover hover:text-fg"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </DialogHeader>
        <div className="space-y-3 px-4 py-4 text-sm">
          <div className="themed rounded-md border border-line bg-surface px-3 py-2">
            <p className="font-medium text-fg">{provider.label}</p>
            <p className="mt-1 text-xs text-fg-muted">
              Status: {provider.configured ? "Configured" : "Not configured"}
              {" · "}ID: <code className="font-mono">{provider.id}</code>
            </p>
          </div>
          <p className="text-xs text-fg-muted">
            The LUCIAN Project Agent is provider-independent. To connect a real
            model (OpenAI, Anthropic, a local LLM, etc.), implement the{" "}
            <code>ModelProvider</code> interface from{" "}
            <code>@/lib/agent/types</code> and register it via{" "}
            <code>setModelProvider()</code>. A future LUCIAN phase will add a
            built-in provider configuration UI; for now, the agent honestly
            refuses to fabricate responses when no provider is registered.
          </p>
          <p className="text-xs text-fg-muted">
            Available project-aware tools are listed in the Tools menu next to
            the composer. Each tool runs against the active project and
            returns real results — never fabricated.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

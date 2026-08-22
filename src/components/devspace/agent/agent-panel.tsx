"use client";

// Project Agent panel.
//
// This is the same Agent component used in both the Workspace AND the
// Visual Editor Studio. It is project-scoped: it reads the active project
// from the DevWorkspace Zustand store, loads the conversation for that
// project from IndexedDB, and submits messages through the currently
// registered ModelProvider.
//
// When no provider is configured, the UI says so honestly — no fake AI
// responses. The user can still see the tool list and conversation history.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Send,
  Settings2,
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
import { useTheme } from "@/components/theme/ThemeProvider";
import {
  getModelProvider,
  runAgentTurn,
  type AgentMessage,
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
  /** Compact height when embedded in a tight column (e.g. Visual Editor right pane). */
  compact?: boolean;
  /** Optional title shown above the messages. */
  title?: string;
}

export function AgentPanel({ compact = false, title }: AgentPanelProps) {
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
  const [provider, setProvider] = useState(getModelProvider());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build a fresh ToolContext whenever the active project changes.
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

  // Load the conversation for the active project.
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

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || !activeProject) return;
    setInput("");
    setBusy(true);
    try {
      // Make sure file contents are loaded so tools can read them.
      await getActiveProjectFiles();
      const tools = buildProjectTools();
      const newMessages = await runAgentTurn(
        text,
        toolContext,
        tools,
        messages,
        SYSTEM_PROMPT,
      );
      const next = [...messages, ...newMessages];
      setMessages(next);
      await saveConversation({
        projectId: activeProject.id,
        messages: next,
        updatedAt: Date.now(),
      });
      // Refresh the provider reference in case the user just configured one.
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
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-xs font-medium">
            {title ?? "Project Agent"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              title="Clear conversation"
              onClick={handleClearConversation}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            title="Provider settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Provider status banner */}
      {!provider.configured ? (
        <div className="border-b border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-600 dark:text-amber-400">
          No model provider configured. The Agent UI is ready, but AI
          responses are disabled until you connect a provider.{" "}
          <button
            className="underline"
            onClick={() => setSettingsOpen(true)}
          >
            Configure
          </button>
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
              <li className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3 w-3 animate-pulse" /> Thinking…
              </li>
            ) : null}
          </ul>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 border-t p-2">
        <Textarea
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
              : "Open a project first…"
          }
          disabled={!activeProject || busy}
          className="min-h-[60px] resize-none text-xs"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            {activeProject
              ? `${frameworkLabel(activeProject.framework)} · ${activeProject.fileCount} files · ${formatBytes(activeProject.totalSize)}`
              : "No project"}
          </span>
          <Button
            size="sm"
            className="h-7"
            disabled={!activeProject || busy || !input.trim()}
            onClick={() => void handleSend()}
          >
            <Send className="mr-1.5 h-3 w-3" />
            Send
          </Button>
        </div>
      </div>

      <AgentSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} provider={provider} onProviderChange={setProvider} />
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
    <div className="flex h-full flex-col items-center justify-center px-4 text-center text-xs text-muted-foreground">
      <Bot className="mb-2 h-8 w-8 opacity-50" />
      {!hasProject ? (
        <p>No active project. Open one from Project Library to start chatting.</p>
      ) : !providerConfigured ? (
        <p>Agent UI is ready. Connect a model provider to start chatting.</p>
      ) : (
        <p>Ask anything about this project. The agent can read files, scan services, edit files, and check the runtime.</p>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: AgentMessage }) {
  if (message.role === "tool") {
    return (
      <li className="rounded-md border bg-muted/40 px-2 py-1.5 text-[11px]">
        <div className="mb-0.5 flex items-center gap-1 font-medium text-muted-foreground">
          <Wrench className="h-3 w-3" />
          Tool result: {message.toolName}
        </div>
        <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-muted-foreground">
          {message.content.slice(0, 2000)}
          {message.content.length > 2000 ? "\n…[truncated]" : ""}
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
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {!isUser && !message.fromModel ? (
          <Badge variant="outline" className="h-4 px-1 text-[9px]">system</Badge>
        ) : null}
        {isUser ? "You" : "Agent"}
      </div>
      <div
        className={cn(
          "max-w-[88%] whitespace-pre-wrap break-words rounded-md px-2.5 py-1.5 text-xs",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.fromModel
            ? "bg-muted"
            : "bg-muted/50 italic",
        )}
      >
        {message.content}
      </div>
    </li>
  );
}

function AgentSettingsDialog({
  open,
  onOpenChange,
  provider,
  onProviderChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  provider: ReturnType<typeof getModelProvider>;
  onProviderChange: (p: ReturnType<typeof getModelProvider>) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agent provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="font-medium">{provider.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Status: {provider.configured ? "Configured" : "Not configured"}
              {" · "}ID: <code className="font-mono">{provider.id}</code>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            The LUCIAN Project Agent is provider-independent. To connect a real
            model (OpenAI, Anthropic, a local LLM, etc.), implement the{" "}
            <code>ModelProvider</code> interface from{" "}
            <code>@/lib/agent/types</code> and register it via{" "}
            <code>setModelProvider()</code>. A future LUCIAN phase will add a
            built-in provider configuration UI; for now, the agent honestly
            refuses to fabricate responses when no provider is registered.
          </p>
          <p className="text-xs text-muted-foreground">
            Available project-aware tools: <code>list_files</code>,{" "}
            <code>read_file</code>, <code>write_file</code>,{" "}
            <code>scan_project</code>, <code>get_framework</code>,{" "}
            <code>get_runtime_status</code>, <code>get_terminal_output</code>,{" "}
            <code>summarize_structure</code>.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => onOpenChange(false)}>
              <X className="mr-1.5 h-3 w-3" /> Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

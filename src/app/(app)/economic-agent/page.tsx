"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Bot, Plus, Send, Sparkles, Trash2, MessageSquare, ChevronDown, Cpu, Wrench, X } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { Textarea } from "@/components/ui-devspace/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui-devspace/dialog";
import { getModelProvider, noopProvider, type AgentMessage } from "@/lib/agent/types";
import { buildProjectTools } from "@/lib/agent/tools";
import { useWorkspaceStore } from "@/store/workspace";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-economic-agent-conversations";

interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveConversations(convs: Conversation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
}

const SYSTEM_PROMPT = `You are the LUCIAN Economic Agent — a multi-purpose AI assistant for the LUCIAN Workspace platform.
You help with: economic analysis, investment research, project development, market intelligence, and general questions.
You have access to project-aware tools when a DevWorkspace project is active.
When you don't know something, say so honestly. Never fabricate data, prices, or results.`;

export default function EconomicAgentPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [provider, setProvider] = useState(getModelProvider());
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const loadFileContent = useWorkspaceStore((s) => s.loadFileContent);
  const getActiveProjectFiles = useWorkspaceStore((s) => s.getActiveProjectFiles);
  const writeFile = useWorkspaceStore((s) => s.writeFile);
  const rescanActiveProject = useWorkspaceStore((s) => s.rescanActiveProject);
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const convs = loadConversations();
      setConversations(convs);
      if (convs.length > 0) setActiveId(convs[0].id);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeId, conversations, busy]);

  const activeConv = conversations.find(c => c.id === activeId);

  const handleNewChat = () => {
    const conv: Conversation = {
      id: genId("conv"),
      title: "New conversation",
      messages: [],
      createdAt: now(),
      updatedAt: now(),
    };
    const next = [conv, ...conversations];
    setConversations(next); saveConversations(next);
    setActiveId(conv.id);
  };

  const handleDelete = (id: string) => {
    const next = conversations.filter(c => c.id !== id);
    setConversations(next); saveConversations(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput(""); setBusy(true);

    let conv = activeConv;
    if (!conv) { handleNewChat(); return; }

    const userMsg: AgentMessage = {
      id: genId("msg"), role: "user", content: text,
      timestamp: now(), fromModel: false,
    };
    const updatedMsgs = [...conv.messages, userMsg];
    const updatedConv = { ...conv, messages: updatedMsgs, title: conv.messages.length === 0 ? text.slice(0, 40) : conv.title, updatedAt: now() };
    const updatedConvs = conversations.map(c => c.id === conv!.id ? updatedConv : c);
    setConversations(updatedConvs); saveConversations(updatedConvs);

    try {
      if (activeProject) await getActiveProjectFiles();
      const tools = buildProjectTools();
      const toolContext = {
        project: activeProject, files: [],
        readFile: async (path: string) => activeProject ? loadFileContent(activeProject.id, path) : undefined,
        writeFile: async (path: string, content: string) => { await writeFile(path, content); refreshPreview(); },
        scanProject: async () => { await rescanActiveProject(); },
        getRuntimeStatus: async () => {
          const { getRuntimeState } = await import("@/lib/workspace/webcontainer");
          const s = getRuntimeState();
          return { status: s.status, serverUrl: s.serverUrl, error: s.error };
        },
        getTerminalOutput: async () => {
          const { getTerminalBuffer } = await import("@/lib/workspace/webcontainer");
          return getTerminalBuffer();
        },
      };

      const { runAgentTurn } = await import("@/lib/agent/types");
      const newMsgs = await runAgentTurn(text, toolContext, tools, updatedMsgs, SYSTEM_PROMPT);
      const finalConv = { ...updatedConv, messages: [...updatedMsgs, ...newMsgs], updatedAt: now() };
      const finalConvs = conversations.map(c => c.id === conv!.id ? finalConv : c);
      setConversations(finalConvs); saveConversations(finalConvs);
      setProvider(getModelProvider());
    } catch (err) {
      const errorMsg: AgentMessage = {
        id: genId("msg_err"), role: "assistant",
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: now(), fromModel: false,
      };
      const errConv = { ...updatedConv, messages: [...updatedMsgs, errorMsg] };
      const errConvs = conversations.map(c => c.id === conv!.id ? errConv : c);
      setConversations(errConvs); saveConversations(errConvs);
    } finally { setBusy(false); }
  };

  const tools = buildProjectTools();

  return (
    <PageShell width="wide">
      <div className="flex h-[calc(100vh-140px)] gap-3">
        {/* Conversation list */}
        <div className="w-52 shrink-0 space-y-1 overflow-y-auto">
          <Button size="sm" className="mb-1 w-full" onClick={handleNewChat}>
            <Plus className="mr-1 h-3 w-3" />New Chat
          </Button>
          {conversations.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)} className={cn("group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors", activeId === c.id ? "bg-active" : "hover:bg-hover")}>
              <MessageSquare className={cn("h-3 w-3 shrink-0", activeId === c.id ? "text-accent" : "text-fg-faint")} />
              <span className="flex-1 truncate text-[11px] text-fg">{c.title || "Untitled"}</span>
              <span className="shrink-0 text-[9px] text-fg-faint">{c.messages.length}</span>
              <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="text-fg-faint opacity-0 hover:text-red-500 group-hover:opacity-100">
                <Trash2 className="h-2.5 w-2.5" />
              </button>
            </button>
          ))}
        </div>

        {/* Chat area */}
        <div className="flex min-w-0 flex-1 flex-col rounded-md border border-line bg-surface">
          {/* Header */}
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-accent" />
              <span className="text-xs font-medium">Economic Agent</span>
              {!provider.configured && (
                <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium text-amber-500">No model</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setToolsOpen(!toolsOpen)} className="focus-ring themed inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-fg-muted hover:bg-hover">
                <Wrench className="h-2.5 w-2.5" /> Tools <span className="rounded bg-surface-2 px-0.5 text-[8px]">{tools.length}</span>
              </button>
              <button onClick={() => setSettingsOpen(true)} className="focus-ring themed inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-fg-muted hover:bg-hover">
                <Cpu className="h-2.5 w-2.5" /> {provider.configured ? provider.label : "Setup"}
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
            {!activeConv || activeConv.messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-fg-faint">
                <Bot className="mb-2 h-8 w-8 opacity-40" />
                {!provider.configured ? (
                  <p>Model provider required. Connect a provider to enable AI responses, or use Tools to inspect the project.</p>
                ) : (
                  <p>Ask anything about economics, markets, investments, or your active project.</p>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
                {activeConv.messages.map(m => <MessageRow key={m.id} message={m} />)}
                {busy && <li className="flex items-center gap-2 text-[11px] text-fg-muted"><Sparkles className="h-3 w-3 animate-pulse text-accent" /> Thinking…</li>}
              </ul>
            )}
          </div>

          {/* Composer */}
          <div className="shrink-0 border-t border-line-muted p-2">
            <div className="themed rounded-md border border-line bg-surface">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); } }}
                placeholder="Ask the Economic Agent…"
                disabled={busy}
                className="block w-full resize-none border-0 bg-transparent px-2.5 py-2 text-xs text-fg placeholder:text-fg-faint focus:outline-none"
                rows={2}
              />
              <div className="flex items-center justify-between border-t border-line-muted px-1.5 py-1">
                <span className="text-[9px] text-fg-faint">
                  {activeProject ? `${activeProject.name} · ${activeProject.fileCount} files` : "No active project"}
                </span>
                <button onClick={() => void handleSend()} disabled={busy || !input.trim()} className={cn("focus-ring themed inline-flex h-6 w-6 items-center justify-center rounded transition-colors", input.trim() && !busy ? "bg-accent text-accent-fg hover:bg-accent-hover" : "text-fg-faint")}>
                  <Send className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools popover */}
      {toolsOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setToolsOpen(false)}>
          <div className="absolute right-4 bottom-20 w-64 rounded-md border border-line bg-overlay p-2 shadow-pop" onClick={e => e.stopPropagation()}>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Project-aware tools</p>
            {tools.map(t => (
              <div key={t.name} className="rounded-sm px-2 py-1 text-[11px]">
                <code className="font-mono text-[10px] text-fg">{t.name}</code>
                <p className="text-[9px] text-fg-faint">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-4 py-2.5">
            <DialogTitle className="flex items-center gap-2 text-sm"><Cpu className="h-4 w-4" /> Agent Provider</DialogTitle>
            <button onClick={() => setSettingsOpen(false)} className="text-fg-muted hover:text-fg"><X className="h-3.5 w-3.5" /></button>
          </DialogHeader>
          <div className="space-y-3 p-4 text-sm">
            <div className="themed rounded-md border border-line bg-surface px-3 py-2">
              <p className="font-medium text-fg">{provider.label}</p>
              <p className="mt-1 text-xs text-fg-muted">
                Status: {provider.configured ? "Configured" : "Not configured"} · ID: <code className="font-mono">{provider.id}</code>
              </p>
            </div>
            <p className="text-xs text-fg-muted">
              The LUCIAN Economic Agent is provider-independent. Implement the <code>ModelProvider</code> interface from <code>@/lib/agent/types</code> and register via <code>setModelProvider()</code>. The agent honestly refuses to fabricate responses when no provider is registered.
            </p>
            <Button size="sm" onClick={() => setSettingsOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}

function MessageRow({ message }: { message: AgentMessage }) {
  if (message.role === "tool") {
    return (
      <li className="themed rounded-md border border-line-muted bg-surface-2/40 px-2 py-1.5 text-[11px]">
        <div className="mb-0.5 flex items-center gap-1 font-medium text-fg-muted">
          <Wrench className="h-3 w-3 text-fg-faint" />
          Tool: <code className="font-mono text-[10px] text-fg-faint">{message.toolName}</code>
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
    <li className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <span className="text-[9px] text-fg-faint">{isUser ? "You" : "Agent"}</span>
      <div className={cn("max-w-[80%] whitespace-pre-wrap break-words rounded-md px-2.5 py-1.5 text-xs", isUser ? "bg-accent text-accent-fg" : message.fromModel ? "bg-surface-2 text-fg" : "bg-surface-2/60 text-fg-muted italic")}>
        {message.content}
      </div>
    </li>
  );
}

// Helper: generate IDs outside render to avoid impure-function-during-render lint.
function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
function now(): number {
  return Date.now();
}

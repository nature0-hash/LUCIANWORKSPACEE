"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Send,
  ChevronDown,
  MoreHorizontal,
  Pin,
  Archive,
  Trash2,
  Edit3,
  X,
  Bot,
  Sparkles,
  Paperclip,
  FileText,
  Folder,
  MessageSquare,
  StickyNote,
  TrendingUp,
  LineChart,
  Wallet,
  Building2,
  Check,
  Menu,
  Cpu,
} from "lucide-react";
import {
  useEconomicAgentStore,
  groupConversationsByDate,
  filterConversations,
  type Conversation,
  type AgentMessage,
  type ContextItem,
  type ModelSelection,
} from "@/store/economic-agent";
import { useEconomicAgentConnection, getProviderInfo } from "@/store/economic-agent-connection";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────── */
/* Main page                                                          */
/* ────────────────────────────────────────────────────────────────── */

export default function EconomicAgentPage() {
  const conversations = useEconomicAgentStore((s) => s.conversations);
  const activeId = useEconomicAgentStore((s) => s.activeId);
  const searchQuery = useEconomicAgentStore((s) => s.searchQuery);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeConv = conversations.find((c) => c.id === activeId);
  const hasActiveConv = !!activeConv && activeConv.messages.length > 0;

  return (
    <div className="themed flex h-full min-h-0 overflow-hidden bg-canvas text-fg">
      {/* ── Mobile sidebar toggle ── */}
      {!sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-fg-muted lg:hidden"
          aria-label="Open conversation list"
        >
          <Menu className="h-4 w-4" />
        </button>
      )}

      {/* ── Mobile backdrop ── */}
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Conversation sidebar ── */}
      <ConversationSidebar
        className={cn(
          "z-30 transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
        onSelect={() => setSidebarOpen(false)}
      />

      {/* ── Main workspace ── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {hasActiveConv ? (
          <ConversationView conversation={activeConv!} />
        ) : (
          <WelcomeView />
        )}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Conversation sidebar                                               */
/* ────────────────────────────────────────────────────────────────── */

function ConversationSidebar({
  className,
  onSelect,
}: {
  className?: string;
  onSelect?: () => void;
}) {
  const conversations = useEconomicAgentStore((s) => s.conversations);
  const activeId = useEconomicAgentStore((s) => s.activeId);
  const searchQuery = useEconomicAgentStore((s) => s.searchQuery);
  const setSearchQuery = useEconomicAgentStore((s) => s.setSearchQuery);
  const newConversation = useEconomicAgentStore((s) => s.newConversation);
  const selectConversation = useEconomicAgentStore((s) => s.selectConversation);

  const filtered = useMemo(
    () => filterConversations(conversations, searchQuery),
    [conversations, searchQuery],
  );
  const groups = useMemo(() => groupConversationsByDate(filtered), [filtered]);

  return (
    <aside
      className={cn(
        "themed absolute flex h-full w-[240px] shrink-0 flex-col border-r border-line-muted bg-surface-2/60 lg:static lg:z-0",
        className,
      )}
    >
      {/* New conversation button */}
      <div className="shrink-0 p-2">
        <button
          type="button"
          onClick={() => {
            newConversation();
            onSelect?.();
          }}
          className="flex w-full items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-[12px] font-medium text-fg transition-colors hover:bg-hover"
        >
          <Plus className="h-3.5 w-3.5" />
          New conversation
        </button>
      </div>

      {/* Search */}
      <div className="shrink-0 px-2 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations"
            className="w-full rounded-md border border-line bg-surface py-1.5 pl-7 pr-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        {groups.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-fg-faint">
            {searchQuery ? "No matches found." : "No conversations yet."}
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.label} className="mb-2">
              <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-fg-faint">
                {group.label}
              </div>
              {group.items.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conv={conv}
                  active={conv.id === activeId}
                  onClick={() => {
                    selectConversation(conv.id);
                    onSelect?.();
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </aside>
  );
}

function ConversationItem({
  conv,
  active,
  onClick,
}: {
  conv: Conversation;
  active: boolean;
  onClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const togglePin = useEconomicAgentStore((s) => s.togglePin);
  const toggleArchive = useEconomicAgentStore((s) => s.toggleArchive);
  const deleteConversation = useEconomicAgentStore((s) => s.deleteConversation);
  const renameConversation = useEconomicAgentStore((s) => s.renameConversation);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv.title);

  return (
    <div className="group relative">
      {renaming ? (
        <input
          autoFocus
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => {
            renameConversation(conv.id, nameDraft);
            setRenaming(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              renameConversation(conv.id, nameDraft);
              setRenaming(false);
            }
            if (e.key === "Escape") {
              setNameDraft(conv.title);
              setRenaming(false);
            }
          }}
          className="w-full rounded-md border border-[var(--accent)] bg-surface px-2 py-1.5 text-[11px] text-fg focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors",
            active ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg",
          )}
        >
          {conv.pinned && <Pin className="h-2.5 w-2.5 shrink-0 text-[var(--accent)]" />}
          <span className="flex-1 truncate text-[11px]">{conv.title}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="shrink-0 rounded p-0.5 text-fg-faint opacity-0 hover:bg-hover hover:text-fg group-hover:opacity-100"
          >
            <MoreHorizontal className="h-3 w-3" />
          </span>
        </button>
      )}

      {/* Context menu */}
      {menuOpen && (
        <ConversationMenu
          conv={conv}
          onClose={() => setMenuOpen(false)}
          onRename={() => {
            setNameDraft(conv.title);
            setRenaming(true);
            setMenuOpen(false);
          }}
          onPin={() => {
            togglePin(conv.id);
            setMenuOpen(false);
          }}
          onArchive={() => {
            toggleArchive(conv.id);
            setMenuOpen(false);
          }}
          onDelete={() => {
            deleteConversation(conv.id);
            setMenuOpen(false);
          }}
        />
      )}
    </div>
  );
}

function ConversationMenu({
  conv,
  onClose,
  onRename,
  onPin,
  onArchive,
  onDelete,
}: {
  conv: Conversation;
  onClose: () => void;
  onRename: () => void;
  onPin: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute right-0 top-7 z-30 w-40 overflow-hidden rounded-md border border-line bg-overlay shadow-pop"
    >
      <MenuItem icon={Edit3} label="Rename" onClick={onRename} />
      <MenuItem icon={Pin} label={conv.pinned ? "Unpin" : "Pin"} onClick={onPin} />
      <MenuItem icon={Archive} label={conv.archived ? "Unarchive" : "Archive"} onClick={onArchive} />
      <div className="my-0.5 border-t border-line-muted" />
      <MenuItem icon={Trash2} label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Edit3;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] transition-colors",
        danger
          ? "text-[#f23645] hover:bg-[#f23645]/10"
          : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Welcome view (no active conversation)                              */
/* ────────────────────────────────────────────────────────────────── */

function WelcomeView() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Title */}
        <div className="mb-6 text-center">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Bot className="h-6 w-6 text-[var(--accent)]" />
            <h1 className="text-[20px] font-semibold tracking-tight text-fg">
              Economic Agent
            </h1>
          </div>
          <p className="text-[13px] text-fg-muted">
            Ask anything, research something, or add context.
          </p>
        </div>

        {/* Composer */}
        <AgentComposer mode="welcome" />
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Conversation view (active conversation)                           */
/* ────────────────────────────────────────────────────────────────── */

function ConversationView({ conversation }: { conversation: Conversation }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messages = conversation.messages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <>
      {/* Conversation header */}
      <ConversationHeader conv={conversation} />

      {/* Messages */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto max-w-3xl px-4 py-4">
          {messages.map((m) => (
            <MessageRow key={m.id} message={m} />
          ))}
        </div>
      </div>

      {/* Bottom composer */}
      <div className="shrink-0 border-t border-line-muted p-3">
        <div className="mx-auto max-w-3xl">
          <AgentComposer mode="conversation" />
        </div>
      </div>
    </>
  );
}

function ConversationHeader({ conv }: { conv: Conversation }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const togglePin = useEconomicAgentStore((s) => s.togglePin);
  const toggleArchive = useEconomicAgentStore((s) => s.toggleArchive);
  const deleteConversation = useEconomicAgentStore((s) => s.deleteConversation);
  const renameConversation = useEconomicAgentStore((s) => s.renameConversation);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv.title);

  return (
    <div className="themed relative flex h-10 shrink-0 items-center justify-between border-b border-line-muted px-4">
      <div className="flex items-center gap-2">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              renameConversation(conv.id, nameDraft);
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                renameConversation(conv.id, nameDraft);
                setRenaming(false);
              }
              if (e.key === "Escape") {
                setNameDraft(conv.title);
                setRenaming(false);
              }
            }}
            className="rounded border border-[var(--accent)] bg-surface px-2 py-0.5 text-[13px] font-medium text-fg focus:outline-none"
          />
        ) : (
          <span className="truncate text-[13px] font-medium text-fg">
            {conv.title}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ModelSelector compact />
        <div className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded text-fg-faint hover:bg-hover hover:text-fg"
            aria-label="Conversation menu"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <ConversationMenu
              conv={conv}
              onClose={() => setMenuOpen(false)}
              onRename={() => {
                setNameDraft(conv.title);
                setRenaming(true);
                setMenuOpen(false);
              }}
              onPin={() => {
                togglePin(conv.id);
                setMenuOpen(false);
              }}
              onArchive={() => {
                toggleArchive(conv.id);
                setMenuOpen(false);
              }}
              onDelete={() => {
                deleteConversation(conv.id);
                setMenuOpen(false);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Message rendering                                                 */
/* ────────────────────────────────────────────────────────────────── */

function MessageRow({ message }: { message: AgentMessage }) {
  if (message.role === "tool") {
    return (
      <div className="my-2 rounded-md border border-line-muted bg-surface-2/40 px-3 py-2 text-[11px]">
        <div className="mb-1 flex items-center gap-1.5 text-[9px] uppercase tracking-wide text-fg-faint">
          <Paperclip className="h-3 w-3" />
          Tool result: <code className="font-mono text-fg-muted">{message.toolName}</code>
        </div>
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] text-fg-muted">
          {message.content.slice(0, 1500)}
          {message.content.length > 1500 ? "\n…[truncated]" : ""}
        </pre>
      </div>
    );
  }

  const isUser = message.role === "user";
  return isUser ? <UserMessage message={message} /> : <AgentMessageView message={message} />;
}

function UserMessage({ message }: { message: AgentMessage }) {
  return (
    <div className="flex justify-end py-2">
      <div className="max-w-[80%]">
        <div className="mb-1 text-right text-[9px] uppercase tracking-wide text-fg-faint">
          You
        </div>
        <div className="rounded-lg bg-[var(--accent)]/15 px-3 py-2 text-[13px] text-fg">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    </div>
  );
}

function AgentMessageView({ message }: { message: AgentMessage }) {
  return (
    <div className="py-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
        <span className="text-[10px] font-medium uppercase tracking-wide text-fg-faint">
          Economic Agent
        </span>
        {!message.fromModel && (
          <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[8px] font-bold uppercase text-amber-500">
            unconfigured
          </span>
        )}
      </div>
      <div className="prose prose-sm max-w-none text-[13px] leading-relaxed text-fg">
        <MarkdownContent content={message.content} />
      </div>
    </div>
  );
}

/** Lightweight markdown renderer — handles headings, lists, code blocks,
    bold, and basic formatting without adding a markdown dependency. */
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${i}`}
            className="my-2 overflow-auto rounded-md border border-line-muted bg-surface-2 p-2 font-mono text-[11px] text-fg"
          >
            <code>{codeLines.join("\n")}</code>
          </pre>,
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={`h3-${i}`} className="mt-3 mb-1 text-[14px] font-semibold text-fg">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={`h2-${i}`} className="mt-3 mb-1 text-[15px] font-semibold text-fg">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={`h1-${i}`} className="mt-3 mb-1 text-[16px] font-bold text-fg">
          {line.slice(2)}
        </h1>,
      );
    } else if (/^\d+\.\s/.test(line)) {
      // Numbered list
      elements.push(
        <div key={`ol-${i}`} className="ml-4 text-[13px] text-fg">
          {renderInline(line)}
        </div>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <div key={`ul-${i}`} className="ml-4 flex gap-1.5 text-[13px] text-fg">
          <span className="text-fg-faint">•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>,
      );
    } else if (line.trim() === "") {
      elements.push(<div key={`br-${i}`} className="h-2" />);
    } else {
      elements.push(
        <p key={`p-${i}`} className="text-[13px] text-fg">
          {renderInline(line)}
        </p>,
      );
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    elements.push(
      <pre
        key="code-final"
        className="my-2 overflow-auto rounded-md border border-line-muted bg-surface-2 p-2 font-mono text-[11px] text-fg"
      >
        <code>{codeLines.join("\n")}</code>
      </pre>,
    );
  }

  return <>{elements}</>;
}

/** Render inline markdown: **bold**, `code`, [link](url). */
function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
    // Code `text`
    const codeMatch = remaining.match(/`(.+?)`/);
    // Link [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/);

    const matches = [
      boldMatch ? { type: "bold" as const, match: boldMatch, index: boldMatch.index! } : null,
      codeMatch ? { type: "code" as const, match: codeMatch, index: codeMatch.index! } : null,
      linkMatch ? { type: "link" as const, match: linkMatch, index: linkMatch.index! } : null,
    ].filter(Boolean) as { type: "bold" | "code" | "link"; match: RegExpMatchArray; index: number }[];

    if (matches.length === 0) {
      parts.push(remaining);
      break;
    }

    matches.sort((a, b) => a.index - b.index);
    const first = matches[0];

    if (first.index > 0) {
      parts.push(remaining.slice(0, first.index));
    }

    if (first.type === "bold") {
      parts.push(
        <strong key={key++} className="font-semibold text-fg">
          {first.match[1]}
        </strong>,
      );
    } else if (first.type === "code") {
      parts.push(
        <code
          key={key++}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[11px] text-fg"
        >
          {first.match[1]}
        </code>,
      );
    } else if (first.type === "link") {
      parts.push(
        <a
          key={key++}
          href={first.match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--accent)] underline hover:opacity-80"
        >
          {first.match[1]}
        </a>,
      );
    }

    remaining = remaining.slice(first.index + first.match[0].length);
  }

  return parts;
}

/* ────────────────────────────────────────────────────────────────── */
/* Composer                                                          */
/* ────────────────────────────────────────────────────────────────── */

function AgentComposer({ mode }: { mode: "welcome" | "conversation" }) {
  const draftText = useEconomicAgentStore((s) => s.draftText);
  const setDraftText = useEconomicAgentStore((s) => s.setDraftText);
  const busy = useEconomicAgentStore((s) => s.busy);
  const setBusy = useEconomicAgentStore((s) => s.setBusy);
  const activeId = useEconomicAgentStore((s) => s.activeId);
  const newConversation = useEconomicAgentStore((s) => s.newConversation);
  const addMessage = useEconomicAgentStore((s) => s.addMessage);
  const contextItems = useEconomicAgentStore((s) => s.contextItems);
  const clearContext = useEconomicAgentStore((s) => s.clearContext);
  const modelSelection = useEconomicAgentStore((s) => s.modelSelection);
  const connectionProvider = useEconomicAgentConnection((s) => s.provider);
  const connectionModel = useEconomicAgentConnection((s) => s.model);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand textarea up to a max height.
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [draftText]);

  const handleSend = useCallback(async () => {
    const text = draftText.trim();
    if (!text || busy) return;

    // Ensure we have a conversation.
    let convId = activeId;
    if (!convId) {
      convId = newConversation();
    }

    setDraftText("");
    setBusy(true);

    // Add user message.
    addMessage(convId, { role: "user", content: text, fromModel: false });

    try {
      const res = await fetch("/api/economic-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          provider: connectionProvider,
          model: connectionModel,
          contextItems,
        }),
      });
      const data = (await res.json()) as { content: string; fromModel: boolean };
      addMessage(convId, {
        role: "assistant",
        content: data.content,
        fromModel: data.fromModel,
      });
      clearContext();
    } catch {
      addMessage(convId, {
        role: "assistant",
        content:
          "I couldn't reach the model provider. Please try again in a moment.",
        fromModel: false,
      });
    } finally {
      setBusy(false);
    }
  }, [
    draftText,
    busy,
    activeId,
    newConversation,
    addMessage,
    setDraftText,
    setBusy,
    connectionProvider,
    connectionModel,
    contextItems,
    clearContext,
  ]);

  return (
    <div className="rounded-lg border border-line bg-surface shadow-sm">
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={draftText}
        onChange={(e) => setDraftText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void handleSend();
          }
        }}
        placeholder={
          mode === "welcome"
            ? "Ask anything, research something, or add context..."
            : "Ask a follow-up..."
        }
        disabled={busy}
        rows={mode === "welcome" ? 3 : 2}
        className="block w-full resize-none border-0 bg-transparent px-3 py-2.5 text-[13px] text-fg placeholder:text-fg-faint focus:outline-none"
      />

      {/* Control row */}
      <div className="flex items-center gap-1.5 border-t border-line-muted px-2 py-1.5">
        {/* Agent dropdown */}
        <ComposerDropdown
          label="Agent"
          icon={Bot}
        />

        {/* Context dropdown */}
        <ContextSelector />

        {/* Add context button */}
        <AddContextButton />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Model selector */}
        <ModelSelector compact={false} />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!draftText.trim() || busy}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            draftText.trim() && !busy
              ? "bg-[var(--accent)] text-[var(--accent-fg)] hover:opacity-90"
              : "bg-surface-2 text-fg-faint",
          )}
          aria-label="Send"
        >
          {busy ? (
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Dropdowns                                                         */
/* ────────────────────────────────────────────────────────────────── */

function ComposerDropdown({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof Bot;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Icon className="h-3 w-3" />
        {label}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          {children}
        </div>
      )}
    </div>
  );
}

function ContextSelector() {
  const contextItems = useEconomicAgentStore((s) => s.contextItems);
  const removeContextItem = useEconomicAgentStore((s) => s.removeContextItem);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const label = contextItems.length > 0
    ? `${contextItems.length} context${contextItems.length > 1 ? "s" : ""}`
    : "Context";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"
      >
        <Paperclip className="h-3 w-3" />
        {label}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-64 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Context
          </div>
          <div className="max-h-[200px] overflow-y-auto p-1">
            {contextItems.length === 0 ? (
              <div className="px-2 py-3 text-center text-[11px] text-fg-faint">
                No context attached
              </div>
            ) : (
              contextItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-[11px] text-fg hover:bg-hover"
                >
                  <ContextIcon type={item.type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{item.label}</div>
                    {item.description && (
                      <div className="truncate text-[9px] text-fg-faint">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeContextItem(item.id)}
                    className="text-fg-faint hover:text-[#f23645]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddContextButton() {
  const addContextItem = useEconomicAgentStore((s) => s.addContextItem);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const sources: { type: ContextItem["type"]; label: string; icon: typeof FileText; available: boolean }[] = [
    { type: "file", label: "Files", icon: FileText, available: true },
    { type: "project", label: "Projects", icon: Folder, available: true },
    { type: "research", label: "Chat History", icon: MessageSquare, available: true },
    { type: "note", label: "Notes", icon: StickyNote, available: true },
    { type: "market", label: "Markets", icon: TrendingUp, available: true },
    { type: "investment", label: "Investments", icon: LineChart, available: false },
    { type: "vault", label: "Vault", icon: Wallet, available: true },
    { type: "business", label: "Businesses", icon: Building2, available: false },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg"
        aria-label="Add context"
        title="Add context"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-48 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Add Context
          </div>
          <div className="p-1">
            {sources.map((src) => {
              const Icon = src.icon;
              return (
                <button
                  key={src.type}
                  type="button"
                  disabled={!src.available}
                  onClick={() => {
                    addContextItem({
                      type: src.type,
                      label: src.label,
                      description: src.available ? "Attached as context" : "Not yet available",
                    });
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] transition-colors",
                    src.available
                      ? "text-fg-muted hover:bg-hover hover:text-fg"
                      : "cursor-not-allowed text-fg-faint opacity-50",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {src.label}
                  {!src.available && (
                    <span className="ml-auto text-[8px] uppercase text-fg-faint">
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ModelSelector({ compact }: { compact: boolean }) {
  const modelSelection = useEconomicAgentStore((s) => s.modelSelection);
  const setModelSelection = useEconomicAgentStore((s) => s.setModelSelection);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [open]);

  const models: { id: ModelSelection; label: string; group: string }[] = [
    { id: "auto", label: "Auto", group: "" },
    { id: "fast", label: "Fast", group: "Fast" },
    { id: "general", label: "General", group: "General" },
    { id: "reasoning", label: "Reasoning", group: "Reasoning" },
    { id: "coding", label: "Coding", group: "Coding" },
    { id: "research", label: "Research", group: "Research" },
  ];

  const currentLabel = models.find((m) => m.id === modelSelection)?.label ?? "Auto";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 rounded-md text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg",
          compact ? "px-1.5 py-0.5" : "px-2 py-1",
        )}
      >
        <Cpu className="h-3 w-3" />
        {currentLabel}
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-48 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Models
          </div>
          <div className="p-1">
            {/* Auto */}
            <button
              type="button"
              onClick={() => {
                setModelSelection("auto");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-fg-muted hover:bg-hover hover:text-fg"
            >
              <span className="flex-1">Auto</span>
              {modelSelection === "auto" && <Check className="h-3 w-3 text-[var(--accent)]" />}
            </button>
            {/* Groups */}
            {["Fast", "General", "Reasoning", "Coding", "Research"].map((group) => {
              const model = models.find((m) => m.group === group);
              if (!model) return null;
              return (
                <div key={group}>
                  <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-fg-faint">
                    {group}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModelSelection(model.id);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] text-fg-muted hover:bg-hover hover:text-fg"
                  >
                    <span className="flex-1">{model.label}</span>
                    {modelSelection === model.id && (
                      <Check className="h-3 w-3 text-[var(--accent)]" />
                    )}
                  </button>
                </div>
              );
            })}
            <div className="border-t border-line-muted px-2 py-1.5 text-[9px] text-fg-faint">
            No model provider configured. Connect one in Settings → Lilith → Economic Agent Connection.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── */
/* Helpers                                                           */
/* ────────────────────────────────────────────────────────────────── */

function ContextIcon({ type }: { type: ContextItem["type"] }) {
  const className = "h-3 w-3 text-fg-faint";
  switch (type) {
    case "file":
      return <FileText className={className} />;
    case "project":
      return <Folder className={className} />;
    case "research":
      return <MessageSquare className={className} />;
    case "note":
      return <StickyNote className={className} />;
    case "market":
      return <TrendingUp className={className} />;
    case "investment":
      return <LineChart className={className} />;
    case "vault":
      return <Wallet className={className} />;
    case "business":
      return <Building2 className={className} />;
    default:
      return <Paperclip className={className} />;
  }
}

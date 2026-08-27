"use client";

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  type AgentError,
} from "@/store/economic-agent";
import { useEconomicAgentConnection, getProviderInfo, PROVIDERS } from "@/store/economic-agent-connection";
import { getAvailableContextSources, attachContext, type ContextSource } from "@/lib/agent/context-providers";
import { readAIBehaviorWire } from "@/lib/ai-behavior";
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
      {/* Phase 8: Handoff receiver */}
      <Suspense fallback={null}>
        <EconomicAgentHandoffReceiver />
      </Suspense>
      {/* Phase 9: deep-link receiver for ?conversation=<id> */}
      <Suspense fallback={null}>
        <EconomicAgentDeepLinkReceiver />
      </Suspense>
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
        {/* Phase 6: old ModelSelector removed — replaced by ProviderModelSelector
            in the composer which actually affects the API request. */}
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
  const error = useEconomicAgentStore((s) => s.error);
  const setError = useEconomicAgentStore((s) => s.setError);
  const activeId = useEconomicAgentStore((s) => s.activeId);
  const conversations = useEconomicAgentStore((s) => s.conversations);
  const newConversation = useEconomicAgentStore((s) => s.newConversation);
  const addMessage = useEconomicAgentStore((s) => s.addMessage);
  const contextItems = useEconomicAgentStore((s) => s.contextItems);
  const clearContext = useEconomicAgentStore((s) => s.clearContext);
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

  // Phase 6: the core send function. Now sends full conversation history
  // (bounded to the last 20 messages) so the model can understand references
  // like "continue" or "what about the second option?".
  const handleSend = useCallback(async () => {
    const text = draftText.trim();
    if (!text || busy) return;

    // Ensure we have a conversation.
    let convId = activeId;
    if (!convId) {
      convId = newConversation();
    }

    // Phase 6: clear any previous error state.
    setError(null);
    setDraftText("");
    setBusy(true);

    // Add user message.
    addMessage(convId, { role: "user", content: text, fromModel: false });

    // Phase 6: build the conversation history to send.
    // Take the current conversation's messages + the new user message,
    // bounded to the last 20 messages to stay within provider context limits.
    const conv = useEconomicAgentStore.getState().conversations.find((c) => c.id === convId);
    const allMessages = conv ? [...conv.messages] : [];
    // The new user message was just added by addMessage above, so
    // allMessages already includes it. Take the last 20.
    const historyWindow = allMessages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyWindow,
          provider: connectionProvider,
          model: connectionModel,
          // Phase 7: system prompt is now built client-side and passed to
          // the shared API route. Context items are also passed with
          // real data (rebuilt at send time by the context-provider layer).
          systemPrompt: [
            "You are the LUCIAN Economic Agent — a multi-purpose AI assistant for the LUCIAN Workspace platform.",
            "You help with: economic analysis, investment research, project development, market intelligence, business ideas, and general questions.",
            "When you don't know something, say so honestly. Never fabricate data, prices, or results.",
            "Format responses with markdown where helpful (headings, lists, tables, code blocks).",
          ].join("\n"),
          contextItems: contextItems.map((c) => ({
            type: c.type,
            label: c.label,
            description: c.description,
            data: c.data,
          })),
          // Settings → AI Behavior: response style + context level +
          // remember conversations. The server enforces these. The
          // allowProjectContext flag is irrelevant for the Economic Agent
          // (it has no project context) but is sent for consistency.
          behavior: readAIBehaviorWire(),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        content: string;
        provider?: string;
        model?: string;
        errorType?: string;
        message?: string;
        statusCode?: number;
      };

      if (data.success) {
        // Phase 6: only create an assistant message when an actual
        // provider/model response is returned successfully.
        addMessage(convId, {
          role: "assistant",
          content: data.content,
          fromModel: true,
        });
        clearContext();
      } else {
        // Phase 6: do NOT insert failure text as a fake assistant message.
        // Set the error state so the UI can display it + offer Retry.
        const errorType = (data.errorType as AgentError["type"]) ?? "unknown";
        setError({
          type: errorType,
          message: data.message ?? "An unknown error occurred.",
        });
        // Phase 10: fire a deduped notification for meaningful provider
        // failures (not for "provider-not-configured" — that's surfaced
        // inline already and would spam the bell on every render).
        try {
          const { notifyAiProviderFailure } = await import("@/lib/notification-producers");
          notifyAiProviderFailure({
            provider: connectionProvider,
            errorType,
            interface: "economic-agent",
          });
        } catch { /* non-fatal */ }
      }
    } catch {
      // Network error — the fetch itself failed (provider unreachable,
      // DNS failure, CORS, etc.).
      setError({
        type: "network-error",
        message: "Could not reach the model provider. Check your network connection and try again.",
      });
      // Phase 10: notify on network errors too (deduped by provider + errorType).
      try {
        const { notifyAiProviderFailure } = await import("@/lib/notification-producers");
        notifyAiProviderFailure({
          provider: connectionProvider,
          errorType: "network-error",
          interface: "economic-agent",
        });
      } catch { /* non-fatal */ }
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
    setError,
    connectionProvider,
    connectionModel,
    contextItems,
    clearContext,
  ]);

  // Phase 6: retry the last failed request. Reuses the same user message
  // and context — does NOT duplicate the user message in history.
  const handleRetry = useCallback(async () => {
    if (busy || !error || !activeId) return;

    const conv = useEconomicAgentStore.getState().conversations.find((c) => c.id === activeId);
    if (!conv || conv.messages.length === 0) return;

    // The last user message is the one to retry.
    const lastUserMsg = [...conv.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setError(null);
    setBusy(true);

    // Rebuild the history window from the conversation (excluding any
    // error placeholder — there shouldn't be one since errors are
    // transient state, not messages).
    const historyWindow = conv.messages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyWindow,
          provider: connectionProvider,
          model: connectionModel,
          systemPrompt: [
            "You are the LUCIAN Economic Agent — a multi-purpose AI assistant for the LUCIAN Workspace platform.",
            "You help with: economic analysis, investment research, project development, market intelligence, business ideas, and general questions.",
            "When you don't know something, say so honestly. Never fabricate data, prices, or results.",
            "Format responses with markdown where helpful (headings, lists, tables, code blocks).",
          ].join("\n"),
          contextItems: contextItems.map((c) => ({
            type: c.type,
            label: c.label,
            description: c.description,
            data: c.data,
          })),
          behavior: readAIBehaviorWire(),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        content: string;
        errorType?: string;
        message?: string;
      };

      if (data.success) {
        addMessage(conv.id, {
          role: "assistant",
          content: data.content,
          fromModel: true,
        });
        clearContext();
      } else {
        setError({
          type: (data.errorType as AgentError["type"]) ?? "unknown",
          message: data.message ?? "An unknown error occurred.",
        });
      }
    } catch {
      setError({
        type: "network-error",
        message: "Could not reach the model provider. Check your network connection and try again.",
      });
    } finally {
      setBusy(false);
    }
  }, [busy, error, activeId, connectionProvider, connectionModel, contextItems, addMessage, clearContext, setBusy, setError]);

  return (
    <div className="rounded-lg border border-line bg-surface shadow-sm">
      {/* Phase 6: Error state display + Retry button */}
      {error && (
        <div className="border-b border-[#f23645]/20 bg-[#f23645]/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#f23645]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#f23645]">
                {error.type.replace(/-/g, " ")}
              </span>
              <p className="text-[11px] text-fg-muted">{error.message}</p>
            </div>
            <button
              type="button"
              onClick={() => void handleRetry()}
              disabled={busy}
              className="rounded border border-line-muted bg-surface-2 px-2 py-1 text-[10px] font-medium text-fg-muted hover:text-fg disabled:opacity-40"
            >
              Retry
            </button>
          </div>
        </div>
      )}

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
        {/* Phase 6: Agent dropdown removed — was empty/non-functional.
            Do not leave an empty clickable control. */}

        {/* Context dropdown */}
        <ContextSelector />

        {/* Add context button */}
        <AddContextButton />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Phase 6: Provider + Model selector — now genuinely functional.
            The model selected here is the model used in the API request. */}
        <ProviderModelSelector />

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

  // Phase 6: use real context sources from the context-provider layer.
  // Only sources that have actual data are shown — no fake "attached" labels.
  // The `open` dependency is intentional: it forces re-evaluation of
  // available context sources every time the menu opens so the user
  // sees fresh data.
  const sources = useMemo(() => {
    return getAvailableContextSources();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const iconForType = (type: ContextSource["type"]) => {
    switch (type) {
      case "market": return TrendingUp;
      case "investment": return LineChart;
      case "economy": return Building2;
      case "note": return StickyNote;
      default: return Paperclip;
    }
  };

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
        <div className="absolute bottom-full left-0 mb-1 w-56 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Add Real Context
          </div>
          <div className="p-1">
            {sources.length === 0 ? (
              <div className="px-3 py-3 text-center text-[10px] text-fg-faint">
                No usable context available.
                <br />
                Open Markets, Investing, or Economy Hub to attach real data.
              </div>
            ) : (
              sources.map((src) => {
                const Icon = iconForType(src.type);
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => {
                      addContextItem({
                        type: src.type,
                        label: src.label,
                        description: src.description,
                        data: src.data ?? undefined,
                      });
                      setOpen(false);
                    }}
                    className="flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[11px] text-fg-muted hover:bg-hover hover:text-fg"
                  >
                    <Icon className="mt-0.5 h-3 w-3 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{src.label}</div>
                      <div className="truncate text-[9px] text-fg-faint">{src.description}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* Phase 6: Provider + Model selector — genuinely functional.
   The provider + model selected here are what the API request uses.
   Changing the provider auto-fills the default model for that provider.
   The model input is a text field so the user can enter any model id
   supported by their provider. */
function ProviderModelSelector() {
  const provider = useEconomicAgentConnection((s) => s.provider);
  const model = useEconomicAgentConnection((s) => s.model);
  const setProvider = useEconomicAgentConnection((s) => s.setProvider);
  const setModel = useEconomicAgentConnection((s) => s.setModel);
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

  const providerInfo = getProviderInfo(provider);
  const displayLabel = model || providerInfo.defaultModel || "model";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-md text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg px-2 py-1"
      >
        <Cpu className="h-3 w-3" />
        <span className="max-w-[80px] truncate">{displayLabel}</span>
        <ChevronDown className="h-2.5 w-2.5" />
      </button>
      {open && (
        <div className="absolute bottom-full right-0 mb-1 w-64 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Provider & Model
          </div>
          <div className="space-y-2 p-2">
            {/* Provider dropdown */}
            <div>
              <label className="text-[9px] uppercase tracking-wide text-fg-faint">Provider</label>
              <select
                value={provider}
                onChange={(e) => {
                  const newProvider = e.target.value as typeof provider;
                  setProvider(newProvider);
                  // Auto-fill the default model for the new provider.
                  const info = getProviderInfo(newProvider);
                  setModel(info.defaultModel);
                }}
                className="mt-1 w-full rounded border border-line-muted bg-surface px-2 py-1 text-[11px] text-fg focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            {/* Model input */}
            <div>
              <label className="text-[9px] uppercase tracking-wide text-fg-faint">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={providerInfo.modelPlaceholder}
                className="mt-1 w-full rounded border border-line-muted bg-surface px-2 py-1 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <div className="text-[9px] text-fg-faint">
              The selected provider and model are used for every request.
              Configure API keys in Settings → Lilith → Economic Agent Connection.
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

/* ── Phase 8: Economic Agent handoff receiver ──
 * Reads ?handoff=<id> from the URL, consumes the handoff,
 * attaches context to the current conversation, and optionally sets the draft prompt.
 * Runs once on mount — does NOT duplicate on re-render. */
function EconomicAgentHandoffReceiver() {
  const searchParams = useSearchParams();
  const addContextItem = useEconomicAgentStore((s) => s.addContextItem);
  const setDraftText = useEconomicAgentStore((s) => s.setDraftText);
  const draftText = useEconomicAgentStore((s) => s.draftText);
  const consumedRef = useRef(false);

  useEffect(() => {
    if (consumedRef.current) return;
    const handoffId = searchParams.get("handoff");
    if (!handoffId) return;

    const { consumeHandoff } = require("@/lib/cross-module-bridge");
    const handoff = consumeHandoff(handoffId);
    if (!handoff) return;

    consumedRef.current = true;

    // Attach dynamic context refs as context items.
    for (const ref of handoff.contextRefs) {
      addContextItem({
        type: ref.entityType === "opportunity" ? "economy" : ref.entityType === "investment" ? "investment" : ref.entityType === "market-symbol" ? "market" : "business",
        label: ref.entityId,
        description: `Dynamic reference from ${ref.module}`,
        // Note: the data field is intentionally left empty here — it will
        // be resolved at send time by the context resolver.
      });
    }

    // Attach static context.
    for (const ctx of handoff.staticContext) {
      addContextItem({
        type: ctx.module === "economy-hub" ? "economy" : ctx.module === "investing" ? "investment" : ctx.module === "chess-academy" ? "market" : "business",
        label: ctx.label,
        description: `Static content from ${ctx.module}`,
        data: ctx.content,
      });
    }

    // Set the draft prompt if provided.
    if (handoff.prompt && !draftText) {
      setDraftText(handoff.prompt);
    }
  }, [searchParams, addContextItem, setDraftText, draftText]);

  return null;
}

/* ── Phase 9: Economic Agent deep-link receiver ──
 * Reads ?conversation=<id> from the URL, validates the conversation
 * exists in the store, selects it as active, and strips the param.
 *
 * Uses `selectConversation` from the store, which atomically sets
 * activeId + clears contextItems + error + busy. This is the same action
 * the sidebar uses when the user clicks a conversation.
 *
 * Runs once per unique conversation id (guarded by consumedRef). */
function EconomicAgentDeepLinkReceiver() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const consumedRef = useRef<string | null>(null);

  useEffect(() => {
    const conversationId = searchParams.get("conversation");
    if (!conversationId) return;
    if (consumedRef.current === conversationId) return;
    consumedRef.current = conversationId;

    const exists = useEconomicAgentStore.getState().conversations.some((c) => c.id === conversationId);
    if (exists) {
      useEconomicAgentStore.getState().selectConversation(conversationId);
    }
    // Strip the param regardless of whether the conversation exists.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("conversation");
    const qs = next.toString();
    router.replace(qs ? `/economic-agent?${qs}` : "/economic-agent");
  }, [searchParams, router]);

  return null;
}

"use client";

/* LUCIAN Economic Agent — state.
 *
 * Separate from the Project Agent (which is keyed by projectId in
 * IndexedDB). The Economic Agent is a broad-context AI workspace that
 * works WITHOUT any project being active. Conversations are persisted
 * to localStorage so they survive refreshes.
 *
 * State model:
 *   - conversations: Conversation[] (with messages, pinned, archived)
 *   - activeId: currently open conversation
 *   - searchQuery: filters the sidebar list
 *   - contextItems: attached context for the next message
 *   - modelSelection: "auto" | manual model id
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { syncChatMessage } from "@/lib/auth/live-sync";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  fromModel: boolean;
  toolName?: string;
}

/** Phase 6: real context data — not just labels. Each context item carries
 *  the actual serialized data the model needs, not just a description. */
export interface ContextItem {
  id: string;
  /** Source type — drives the icon + label. */
  type: "project" | "file" | "research" | "note" | "market" | "investment" | "vault" | "business" | "economy";
  /** Display label, e.g. "BTCUSD", "README.md". */
  label: string;
  /** Optional secondary descriptor for UI display. */
  description?: string;
  /** Phase 6: the actual serialized context data sent to the model.
   *  This is built by the context-provider layer and contains real
   *  market data, investment holdings, economy hub data, etc. */
  data?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
}

/** Phase 6: error state for failed provider requests. Transient — NOT persisted. */
export interface AgentError {
  type: "provider-not-configured" | "authentication-failed" | "rate-limit" | "provider-unavailable" | "timeout" | "invalid-model" | "invalid-response" | "network-error" | "unknown";
  message: string;
  /** ID of the user message that triggered the failed request. Used for retry. */
  triggerMessageId?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: AgentMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  archived: boolean;
}

interface EconomicAgentState {
  conversations: Conversation[];
  activeId: string | null;
  searchQuery: string;
  draftText: string;
  contextItems: ContextItem[];
  /** Phase 6: removed — model selection is now solely via the connection
   *  store (useEconomicAgentConnection). The old modelSelection field
   *  was decorative and never affected the API request. */
  busy: boolean;
  /** Phase 6: transient error state for failed provider requests.
   *  NOT persisted — cleared on conversation switch, new message, or retry. */
  error: AgentError | null;

  // Actions
  newConversation: () => string;
  selectConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  togglePin: (id: string) => void;
  toggleArchive: (id: string) => void;
  addMessage: (convId: string, message: Omit<AgentMessage, "id" | "timestamp">) => void;
  setDraftText: (t: string) => void;
  setSearchQuery: (q: string) => void;
  setBusy: (v: boolean) => void;
  setError: (e: AgentError | null) => void;
  addContextItem: (item: Omit<ContextItem, "id">) => void;
  removeContextItem: (id: string) => void;
  clearContext: () => void;
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function now(): number {
  return Date.now();
}

export const useEconomicAgentStore = create<EconomicAgentState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeId: null,
      searchQuery: "",
      draftText: "",
      contextItems: [],
      busy: false,
      error: null,

      newConversation: () => {
        const id = genId("conv");
        const conv: Conversation = {
          id,
          title: "New conversation",
          messages: [],
          createdAt: now(),
          updatedAt: now(),
          pinned: false,
          archived: false,
        };
        set((s) => ({
          conversations: [conv, ...s.conversations],
          activeId: id,
          contextItems: [],
          error: null,
          busy: false,
        }));
        return id;
      },

      selectConversation: (id) => set({ activeId: id, contextItems: [], error: null, busy: false }),

      deleteConversation: (id) =>
        set((s) => {
          const next = s.conversations.filter((c) => c.id !== id);
          return {
            conversations: next,
            activeId: s.activeId === id ? next[0]?.id ?? null : s.activeId,
            error: null,
            busy: false,
          };
        }),

      renameConversation: (id, title) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, title: title.trim() || "Untitled" } : c,
          ),
        })),

      togglePin: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, pinned: !c.pinned } : c,
          ),
        })),

      toggleArchive: (id) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === id ? { ...c, archived: !c.archived } : c,
          ),
        })),

      addMessage: (convId, message) => {
        const localId = genId("msg");
        const newMessage = { ...message, id: localId, timestamp: now() };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [...c.messages, newMessage],
                  updatedAt: now(),
                  // Auto-title from first user message.
                  title:
                    c.messages.length === 0 && message.role === "user"
                      ? message.content.slice(0, 40)
                      : c.title,
                }
              : c,
          ),
        }));
        // PHASE 16: live server-sync. Best-effort, non-blocking — the
        // local mutation already succeeded; the server write happens
        // in the background. Conversation id IS the local convId so
        // reloads continue the same server-side conversation.
        const conv = get().conversations.find(c => c.id === convId);
        if (conv) {
          void syncChatMessage({
            conversationId: convId,
            // Pass the local newMessage.id as the stable messageId —
            // retries of the SAME local message dedupe on the server.
            messageId: localId,
            source: "economic-agent",
            title: conv.title || "Economic Agent Conversation",
            role: message.role,
            content: message.content,
            // `fromModel` on the economic-agent store is a boolean flag
            // (was the message generated by the configured model?).
            // The server's ChatMessage.model field is a string. We
            // omit it — the conversation-level model field can be set
            // by the migration prompt.
            model: undefined,
            provider: undefined,
          }).catch(() => { /* non-fatal — local already succeeded */ });
        }
      },

      setDraftText: (t) => set({ draftText: t }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setBusy: (v) => set({ busy: v }),
      setError: (e) => set({ error: e }),

      addContextItem: (item) =>
        set((s) => ({
          contextItems: [
            ...s.contextItems,
            { ...item, id: genId("ctx") },
          ],
        })),

      removeContextItem: (id) =>
        set((s) => ({
          contextItems: s.contextItems.filter((c) => c.id !== id),
        })),

      clearContext: () => set({ contextItems: [] }),
    }),
    {
      name: "lucian-economic-agent",
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
        return localStorage;
      }),
      // Phase 6: do NOT persist transient runtime state.
      // `busy` and `error` are session-only — they must never survive
      // a page reload. If they did, the send button would be permanently
      // disabled after a refresh during a request.
      partialize: (s) => ({
        conversations: s.conversations,
        activeId: s.activeId,
        searchQuery: s.searchQuery,
        draftText: s.draftText,
        contextItems: s.contextItems,
        // Explicitly exclude: busy, error
      }),
    },
  ),
);

/* ── Derived helpers ── */

/** Group conversations by date: Today / Yesterday / Older. */
export function groupConversationsByDate(
  conversations: Conversation[],
): { label: string; items: Conversation[] }[] {
  const now = Date.now();
  const todayStart = new Date(now).setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - 86400000;

  const pinned = conversations.filter((c) => c.pinned && !c.archived);
  const today = conversations.filter(
    (c) => !c.pinned && !c.archived && c.updatedAt >= todayStart,
  );
  const yesterday = conversations.filter(
    (c) =>
      !c.pinned &&
      !c.archived &&
      c.updatedAt >= yesterdayStart &&
      c.updatedAt < todayStart,
  );
  const older = conversations.filter(
    (c) => !c.pinned && !c.archived && c.updatedAt < yesterdayStart,
  );
  const archived = conversations.filter((c) => c.archived);

  const groups: { label: string; items: Conversation[] }[] = [];
  if (pinned.length) groups.push({ label: "Pinned", items: pinned });
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  if (older.length) groups.push({ label: "Previous", items: older });
  if (archived.length) groups.push({ label: "Archived", items: archived });
  return groups;
}

/** Filter conversations by search query. */
export function filterConversations(
  conversations: Conversation[],
  query: string,
): Conversation[] {
  if (!query.trim()) return conversations;
  const q = query.toLowerCase();
  return conversations.filter(
    (c) =>
      c.title.toLowerCase().includes(q) ||
      c.messages.some((m) => m.content.toLowerCase().includes(q)),
  );
}

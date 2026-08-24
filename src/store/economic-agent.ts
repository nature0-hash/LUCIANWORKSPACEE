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

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  fromModel: boolean;
  toolName?: string;
}

export interface ContextItem {
  id: string;
  /** Source type — drives the icon + label. */
  type: "project" | "file" | "research" | "note" | "market" | "investment" | "vault" | "business";
  /** Display label, e.g. "Project Atlas", "BTCUSD", "README.md". */
  label: string;
  /** Optional secondary descriptor. */
  description?: string;
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

export type ModelSelection = "auto" | "fast" | "general" | "reasoning" | "coding" | "research";

interface EconomicAgentState {
  conversations: Conversation[];
  activeId: string | null;
  searchQuery: string;
  draftText: string;
  contextItems: ContextItem[];
  modelSelection: ModelSelection;
  busy: boolean;

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
  setModelSelection: (m: ModelSelection) => void;
  setBusy: (v: boolean) => void;
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
      modelSelection: "auto",
      busy: false,

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
        }));
        return id;
      },

      selectConversation: (id) => set({ activeId: id, contextItems: [] }),

      deleteConversation: (id) =>
        set((s) => {
          const next = s.conversations.filter((c) => c.id !== id);
          return {
            conversations: next,
            activeId: s.activeId === id ? next[0]?.id ?? null : s.activeId,
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

      addMessage: (convId, message) =>
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: [
                    ...c.messages,
                    { ...message, id: genId("msg"), timestamp: now() },
                  ],
                  updatedAt: now(),
                  // Auto-title from first user message.
                  title:
                    c.messages.length === 0 && message.role === "user"
                      ? message.content.slice(0, 40)
                      : c.title,
                }
              : c,
          ),
        })),

      setDraftText: (t) => set({ draftText: t }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setModelSelection: (m) => set({ modelSelection: m }),
      setBusy: (v) => set({ busy: v }),

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

"use client";

/* LUCIAN Notifications — shared notification system.
 *
 * Any LUCIAN module can push notifications via this store.
 * The notification bell in TopNav reads from this store.
 * Home "Needs Attention" section reads high-priority unread items.
 *
 * Persisted to localStorage via zustand persist.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface AppNotification {
  id: string;
  source: string; // module name e.g. "economic-agent", "investing"
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  priority: NotificationPriority;
  deepLink?: string;
}

interface NotificationState {
  notifications: AppNotification[];
  add: (n: Omit<AppNotification, "id" | "timestamp" | "read">) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clear: () => void;
  remove: (id: string) => void;
  unreadCount: () => number;
  urgentUnread: () => AppNotification[];
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      notifications: [],

      add: (n) =>
        set((s) => ({
          notifications: [
            { ...n, id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), read: false },
            ...s.notifications,
          ].slice(0, 100), // cap at 100
        })),

      markRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n,
          ),
        })),

      markAllRead: () =>
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        })),

      clear: () => set({ notifications: [] }),

      remove: (id) =>
        set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,

      urgentUnread: () =>
        get().notifications.filter(
          (n) => !n.read && (n.priority === "high" || n.priority === "urgent"),
        ),
    }),
    {
      name: "lucian-notifications",
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

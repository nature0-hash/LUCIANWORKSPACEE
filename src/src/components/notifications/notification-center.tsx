"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CheckCheck, Bell } from "lucide-react";
import { useNotificationStore } from "@/store/notifications";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationCenter({ open, onClose }: Props) {
  const router = useRouter();
  const notifications = useNotificationStore((s) => s.notifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const [filter, setFilter] = useFilter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const id = setTimeout(() => {
      document.addEventListener("mousedown", handler);
      document.addEventListener("keydown", keyHandler);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, [open, onClose]);

  if (!open) return null;

  const filtered = filter === "unread" ? notifications.filter(n => !n.read) : notifications;
  const unreadCount = notifications.filter(n => !n.read).length;

  // Group by date
  const today: typeof filtered = [];
  const yesterday: typeof filtered = [];
  const older: typeof filtered = [];
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  for (const n of filtered) {
    if (n.timestamp >= todayStart) today.push(n);
    else if (n.timestamp >= yesterdayStart) yesterday.push(n);
    else older.push(n);
  }

  const handleClick = (n: { id: string; deepLink?: string }) => {
    markRead(n.id);
    if (n.deepLink) router.push(n.deepLink);
    onClose();
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div className="fixed inset-0 z-[150] bg-black/30 md:hidden" onClick={onClose} />
      <div
        ref={ref}
        className="themed fixed right-0 top-14 z-[151] flex h-[calc(100vh-3.5rem)] w-full flex-col border-l border-line bg-surface shadow-pop md:w-[400px]"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-line-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-fg-muted" />
            <h2 className="text-[14px] font-semibold text-fg">Notifications</h2>
            {unreadCount > 0 && <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-bold text-[var(--accent-fg)]">{unreadCount}</span>}
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>

        {/* Filter + Mark all */}
        <div className="flex shrink-0 items-center justify-between border-b border-line-muted px-3 py-2">
          <div className="flex gap-1">
            <button onClick={() => setFilter("all")} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", filter === "all" ? "bg-active text-fg" : "text-fg-muted hover:text-fg")}>All</button>
            <button onClick={() => setFilter("unread")} className={cn("rounded px-2 py-0.5 text-[10px] font-medium", filter === "unread" ? "bg-active text-fg" : "text-fg-muted hover:text-fg")}>Unread</button>
          </div>
          <button onClick={markAllRead} disabled={unreadCount === 0} className="flex items-center gap-1 text-[10px] text-fg-muted hover:text-fg disabled:opacity-30">
            <CheckCheck className="h-3 w-3" /> Mark all read
          </button>
        </div>

        {/* List — independent scroll */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-8 w-8 text-fg-faint opacity-30" />
              <p className="mt-2 text-[12px] text-fg-muted">No notifications</p>
            </div>
          ) : (
            <div>
              {today.length > 0 && <DateGroup label="Today" items={today} onClick={handleClick} />}
              {yesterday.length > 0 && <DateGroup label="Yesterday" items={yesterday} onClick={handleClick} />}
              {older.length > 0 && <DateGroup label="Previous" items={older} onClick={handleClick} />}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function DateGroup({ label, items, onClick }: { label: string; items: any[]; onClick: (n: any) => void }) {
  return (
    <div>
      <div className="px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-fg-faint">{label}</div>
      {items.map(n => (
        <button key={n.id} onClick={() => onClick(n)} className="flex w-full items-start gap-2 border-b border-line-muted/60 px-3 py-2.5 text-left transition-colors hover:bg-hover">
          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-fg-faint" : n.priority === "urgent" ? "bg-red-500" : n.priority === "high" ? "bg-amber-500" : "bg-[var(--accent)]")} />
          <div className="min-w-0 flex-1">
            <p className={cn("text-[12px] font-medium", n.read ? "text-fg-muted" : "text-fg")}>{n.title}</p>
            <p className="text-[11px] text-fg-muted">{n.message}</p>
            <p className="mt-0.5 text-[9px] text-fg-faint">{formatTimeAgo(n.timestamp)}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 86400000 * 2) return "yesterday";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Small hook for filter state
function useFilter(): ["all" | "unread", (v: "all" | "unread") => void] {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  return [filter, setFilter];
}

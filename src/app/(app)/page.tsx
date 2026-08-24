"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, Bell, Bot, FileText, Plus, PieChart, Newspaper, FlaskConical } from "lucide-react";
import { useNotificationStore } from "@/store/notifications";
import { GlobalSearchOverlay } from "@/components/search/global-search-overlay";
import { cn } from "@/lib/utils";

interface RecentItem {
  id: string;
  module: string;
  moduleLabel: string;
  title: string;
  subtitle: string;
  timestamp: number;
  path: string;
}

export default function HomePage() {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  // Load recent activity from localStorage
  useEffect(() => {
    const items: RecentItem[] = [];
    // Notes
    try {
      const data = JSON.parse(localStorage.getItem("lucian-notes-v2") || "{}");
      for (const sec of data.sections ?? []) {
        for (const page of sec.pages ?? []) {
          if (page.updatedAt) items.push({
            id: `note-${page.id}`, module: "notes", moduleLabel: "Notes",
            title: page.title || "Untitled", subtitle: sec.name,
            timestamp: page.updatedAt, path: "/notes",
          });
        }
      }
    } catch { /* ignore */ }
    // Investing
    try {
      const data = JSON.parse(localStorage.getItem("lucian-investing") || "{}");
      for (const inv of data.investments ?? []) {
        items.push({
          id: `inv-${inv.id}`, module: "investing", moduleLabel: "Investing",
          title: inv.symbol, subtitle: inv.name,
          timestamp: inv.updatedAt ?? inv.createdAt, path: "/investing",
        });
      }
    } catch { /* ignore */ }
    // Economy Hub
    try {
      const data = JSON.parse(localStorage.getItem("lucian-economy-hub") || "{}");
      for (const opp of data.opportunities ?? []) {
        items.push({
          id: `opp-${opp.id}`, module: "economy-hub", moduleLabel: "Economy Hub",
          title: opp.name, subtitle: `Score: ${opp.score}`,
          timestamp: opp.updatedAt ?? opp.createdAt, path: "/economy-hub",
        });
      }
    } catch { /* ignore */ }
    // Economic Agent
    try {
      const data = JSON.parse(localStorage.getItem("lucian-economic-agent") || "{}");
      for (const conv of data.conversations ?? []) {
        items.push({
          id: `conv-${conv.id}`, module: "economic-agent", moduleLabel: "Economic Agent",
          title: conv.title || "Conversation", subtitle: `${conv.messages?.length ?? 0} messages`,
          timestamp: conv.updatedAt ?? conv.createdAt, path: "/economic-agent",
        });
      }
    } catch { /* ignore */ }
    // Sort by timestamp and take top 5
    items.sort((a, b) => b.timestamp - a.timestamp);
    setRecentItems(items.slice(0, 5));
  }, []);

  // Date + greeting
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  // Notifications (Needs Attention)
  const urgentUnread = useNotificationStore((s) => s.urgentUnread());

  const quickActions = [
    { label: "New Chat", icon: Bot, path: "/economic-agent" },
    { label: "New Note", icon: FileText, path: "/notes" },
    { label: "Open Project", icon: ChevronRight, path: "/dev-workspace" },
    { label: "Research", icon: FlaskConical, path: "/economy-hub" },
    { label: "Add Investment", icon: PieChart, path: "/investing" },
  ];

  return (
    <div className="themed flex h-full min-h-0 flex-col bg-canvas text-fg">
      {/* Main content */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          {/* Date + greeting */}
          <div className="mb-6">
            <p className="text-[12px] text-fg-faint">{dateStr}</p>
            <h1 className="mt-0.5 text-[22px] font-semibold tracking-tight text-fg">{greeting}</h1>
          </div>

          {/* Large search */}
          <div className="mb-8">
            <button onClick={() => setSearchOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-fg-faint">
              <Search className="h-4 w-4 text-fg-faint" />
              <span className="text-[14px] text-fg-faint">Search anything in LUCIAN...</span>
              <kbd className="ml-auto rounded border border-line px-1.5 py-0.5 font-sans text-[10px] text-fg-faint">/</kbd>
            </button>
          </div>

          {/* Continue section */}
          {recentItems.length > 0 && (
            <div className="mb-6">
              <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-fg-faint">Continue</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {recentItems.map(item => (
                  <button key={item.id} onClick={() => router.push(item.path)}
                    className="group flex items-center gap-3 rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-fg">{item.title}</p>
                      <p className="truncate text-[10px] text-fg-faint">{item.moduleLabel} · {item.subtitle}</p>
                      <p className="mt-0.5 text-[9px] text-fg-faint">{formatTimeAgo(item.timestamp)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-fg-faint transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity + Needs Attention */}
          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            {/* Recent Activity */}
            <div className="rounded-lg border border-line bg-surface p-4">
              <h2 className="mb-3 text-[12px] font-semibold text-fg">Recent Activity</h2>
              {recentItems.length === 0 ? (
                <p className="text-[11px] text-fg-faint">No recent activity yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentItems.map(item => (
                    <div key={item.id} className="flex items-center gap-2 text-[11px]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                      <span className="flex-1 truncate text-fg-muted">
                        <span className="text-fg">{item.title}</span>
                        <span className="ml-1 text-fg-faint">— {item.moduleLabel}</span>
                      </span>
                      <span className="shrink-0 text-[9px] text-fg-faint">{formatTimeAgo(item.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Needs Attention */}
            <div className="rounded-lg border border-line bg-surface p-4">
              <div className="mb-3 flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-fg-muted" />
                <h2 className="text-[12px] font-semibold text-fg">Needs Attention</h2>
              </div>
              {urgentUnread.length === 0 ? (
                <p className="text-[11px] text-fg-faint">No items need your attention.</p>
              ) : (
                <div className="space-y-2">
                  {urgentUnread.slice(0, 5).map(n => (
                    <div key={n.id} className="flex items-start gap-2 text-[11px]">
                      <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", n.priority === "urgent" ? "bg-red-500" : "bg-amber-500")} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-fg">{n.title}</p>
                        <p className="truncate text-[10px] text-fg-muted">{n.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-fg-faint">Quick Actions</h2>
            <div className="flex flex-wrap gap-2">
              {quickActions.map(action => (
                <button key={action.label} onClick={() => router.push(action.path)}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg">
                  <action.icon className="h-3.5 w-3.5" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Global Search overlay */}
      <GlobalSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} initialQuery={searchInput} />
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

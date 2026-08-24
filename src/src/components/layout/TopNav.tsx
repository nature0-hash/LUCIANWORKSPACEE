"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { IconButton } from "@/components/ui/IconButton";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useSidebar } from "@/components/layout/SidebarContext";
import { GlobalSearchOverlay } from "@/components/search/global-search-overlay";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { useNotificationStore } from "@/store/notifications";
import { cn } from "@/lib/utils";

function pathToCrumb(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Home";
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return "Home";
  const first = segments[0];
  return first.charAt(0).toUpperCase() + first.slice(1).replace(/-/g, " ");
}

interface TopNavProps {
  onOpenSettings: () => void;
}

export function TopNav({ onOpenSettings }: TopNavProps) {
  const { toggleCollapsed, toggleMobile, collapsed } = useSidebar();
  const pathname = usePathname();
  const crumb = pathToCrumb(pathname);

  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");

  // Select raw notifications array (stable reference) then derive count
  // with useMemo. Calling s.unreadCount() inside the selector creates a new
  // value every render → infinite loop in Zustand 5.
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  // Global keyboard shortcuts: / and Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing = el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable);
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleSearchInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (e.target.value.trim()) setSearchOpen(true);
  }, []);

  return (
    <>
      <header className="themed z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line-muted bg-surface-2/80 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={toggleCollapsed} className="hidden lg:inline-flex" aria-pressed={collapsed}>
            <Menu size={16} />
          </IconButton>
          <IconButton label="Open navigation" onClick={toggleMobile} className="lg:hidden">
            <Menu size={16} />
          </IconButton>
          <Link href="/" aria-label="Lucian home" className="focus-ring themed flex h-8 w-8 items-center justify-center rounded-lg transition-opacity hover:opacity-90">
            <BrandMark size={28} />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden text-sm font-semibold text-fg sm:block">Lucian</span>
            <span className="hidden text-fg-faint sm:block">/</span>
            <h1 className="truncate text-sm font-semibold text-fg">{crumb}</h1>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Compact search (desktop) */}
          <div className="relative hidden md:block">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint" />
            <input
              type="search"
              value={searchInput}
              onChange={handleSearchInput}
              onFocus={() => searchInput.trim() && setSearchOpen(true)}
              placeholder="Search or jump to…"
              className="focus-ring themed h-8 w-52 rounded-md border border-line bg-inset pl-8 pr-10 text-sm text-fg placeholder:text-fg-faint transition-[width,border-color] duration-200 focus:w-64 lg:w-64 lg:focus:w-80"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-px font-sans text-[10px] leading-4 text-fg-faint lg:block">/</kbd>
          </div>

          {/* Compact search (mobile) */}
          <IconButton label="Search" className="md:hidden" onClick={() => setSearchOpen(true)}>
            <Search size={16} />
          </IconButton>

          {/* Notifications */}
          <button
            onClick={() => setNotifOpen(v => !v)}
            className="relative flex h-8 w-8 items-center justify-center rounded-md text-fg-muted hover:bg-hover hover:text-fg"
            aria-label="Notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[8px] font-bold text-[var(--accent-fg)]">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

          <ProfileMenu onOpenSettings={onOpenSettings} />
        </div>
      </header>

      {/* Overlays */}
      <GlobalSearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} initialQuery={searchInput} />
      <NotificationCenter open={notifOpen} onClose={() => setNotifOpen(false)} />
    </>
  );
}

"use client";

import { Bell, Inbox, Menu, Plus, Search, Sparkles } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

interface TopNavProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function TopNav({ onToggleSidebar, onOpenSettings }: TopNavProps) {
  return (
    <header className="themed z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line-muted bg-surface-2/80 px-4 backdrop-blur">
      {/* Left cluster */}
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="lg:hidden"
        >
          <Menu size={16} />
        </IconButton>

        {/* Logo mark */}
        <a
          href="#"
          aria-label="Lucid home"
          className="focus-ring themed flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-fg shadow-sm transition-colors hover:bg-accent-hover"
        >
          <Sparkles size={16} strokeWidth={2.25} />
        </a>

        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm font-semibold text-fg sm:block">
            Lucid
          </span>
          <span className="hidden text-fg-faint sm:block">/</span>
          <h1 className="truncate text-sm font-semibold text-fg">Dashboard</h1>
        </div>
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        {/* Compact search */}
        <div className="relative hidden md:block">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            placeholder="Search or jump to…"
            className="focus-ring themed h-8 w-52 rounded-md border border-line bg-inset pl-8 pr-10 text-sm text-fg placeholder:text-fg-faint transition-[width,border-color] duration-200 focus:w-64 lg:w-64 lg:focus:w-80"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line px-1.5 py-px font-sans text-[10px] leading-4 text-fg-faint lg:block">
            /
          </kbd>
        </div>

        <IconButton label="Search" className="md:hidden">
          <Search size={16} />
        </IconButton>

        <div className="hidden items-center gap-2 sm:flex">
          <IconButton label="Create new">
            <Plus size={16} />
          </IconButton>
          <IconButton label="Inbox">
            <Inbox size={16} />
          </IconButton>
        </div>

        <IconButton label="Notifications" className="relative">
          <Bell size={16} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
        </IconButton>

        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <ProfileMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

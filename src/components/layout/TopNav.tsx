"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { LucianEmblem } from "@/components/layout/LucianLogo";

interface TopNavProps {
  onToggleSidebar: () => void;
  onOpenSettings: () => void;
}

export function TopNav({ onToggleSidebar, onOpenSettings }: TopNavProps) {
  return (
    <header className="themed z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line-muted bg-surface/80 px-3 backdrop-blur sm:px-4">
      {/* Left cluster */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <IconButton
          label="Toggle sidebar"
          onClick={onToggleSidebar}
          className="shrink-0"
        >
          <Menu size={18} />
        </IconButton>

        {/* Lucian emblem - replaces green Sparkles icon */}
        <Link
          href="/"
          aria-label="Lucian Workspace home"
          className="focus-ring themed shrink-0 rounded-lg"
        >
          <LucianEmblem size={32} />
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <Link href="/" className="hidden text-sm font-semibold text-fg hover:text-fg sm:block">
            Lucian
          </Link>
          <span className="hidden text-fg-faint sm:block">/</span>
          <h1 className="truncate text-sm font-semibold text-fg">Dashboard</h1>
        </div>
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        {/* Compact search - hidden on small screens, visible md+ */}
        <div className="relative hidden md:block">
          <Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint"
          />
          <input
            type="search"
            placeholder="Search or jump to…"
            aria-label="Search or jump to"
            className="focus-ring themed h-8 w-52 rounded-md border border-line bg-inset pl-8 pr-10 text-sm text-fg placeholder:text-fg-faint transition-[width,border-color] duration-200 focus:w-64 lg:w-64 lg:focus:w-80"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-px font-sans text-[10px] leading-4 text-fg-faint lg:block">
            /
          </kbd>
        </div>

        <IconButton label="Search" className="md:hidden">
          <Search size={16} />
        </IconButton>

        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <ProfileMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

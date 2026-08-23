"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Menu, Search } from "lucide-react";
import { BrandMark } from "@/components/branding/BrandMark";
import { IconButton } from "@/components/ui/IconButton";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useSidebar } from "@/components/layout/SidebarContext";

/** Map a pathname to the breadcrumb label we show in the top-nav. */
function pathToCrumb(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Home";
  if (pathname === "/projects" || pathname.startsWith("/projects/"))
    return "Projects";
  return "Workspace";
}

interface TopNavProps {
  onOpenSettings: () => void;
}

export function TopNav({ onOpenSettings }: TopNavProps) {
  const { toggleCollapsed, toggleMobile, collapsed } = useSidebar();
  const pathname = usePathname();
  const crumb = pathToCrumb(pathname);

  return (
    <header className="themed z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line-muted bg-surface-2/80 px-4 backdrop-blur">
      {/* Left cluster */}
      <div className="flex min-w-0 items-center gap-3">
        {/* Hamburger — controls desktop collapse AND mobile drawer */}
        <IconButton
          label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={toggleCollapsed}
          className="hidden lg:inline-flex"
          aria-pressed={collapsed}
        >
          <Menu size={16} />
        </IconButton>
        <IconButton
          label="Open navigation"
          onClick={toggleMobile}
          className="lg:hidden"
        >
          <Menu size={16} />
        </IconButton>

        {/* Brand mark + breadcrumb */}
        <Link
          href="/"
          aria-label="Lucian home"
          className="focus-ring themed flex h-8 w-8 items-center justify-center rounded-lg transition-opacity hover:opacity-90"
        >
          <BrandMark size={28} />
        </Link>

        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden text-sm font-semibold text-fg sm:block">
            Lucian
          </span>
          <span className="hidden text-fg-faint sm:block">/</span>
          <h1 className="truncate text-sm font-semibold text-fg">{crumb}</h1>
        </div>
      </div>

      {/* Right cluster */}
      <div className="ml-auto flex items-center gap-2">
        {/* Compact search (desktop) */}
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

        {/* Compact search (mobile) */}
        <IconButton label="Search" className="md:hidden">
          <Search size={16} />
        </IconButton>

        {/* Notifications — single utility icon kept for parity with the
            GitHub-inspired design. No badge dot is shown until a real
            notifications source exists. */}
        <IconButton label="Notifications">
          <Bell size={16} />
        </IconButton>

        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <ProfileMenu onOpenSettings={onOpenSettings} />
      </div>
    </header>
  );
}

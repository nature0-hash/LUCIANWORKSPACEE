"use client";

import { useEffect } from "react";
import { FolderKanban, Home, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { LucianEmblem } from "@/components/layout/LucianLogo";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

/**
 * Shared nav list used by both desktop sidebar and mobile drawer.
 */
function NavList({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="px-2 py-3">
      <p
        className={`mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-fg-faint ${
          collapsed ? "sr-only" : ""
        }`}
      >
        Workspace
      </p>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
          const content = (
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`focus-ring themed relative flex items-center rounded-md text-sm transition-colors ${
                collapsed ? "justify-center p-2.5" : "gap-2.5 px-2.5 py-1.5"
              } ${
                active
                  ? "bg-active font-medium text-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg"
              }`}
            >
              {!collapsed && active && (
                <span className="absolute -left-2 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-accent" />
              )}
              <Icon
                size={collapsed ? 18 : 15}
                className={active ? "text-accent" : "text-fg-faint"}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <li key={label} className="flex justify-center">
                <Tooltip label={label}>{content}</Tooltip>
              </li>
            );
          }
          return <li key={label}>{content}</li>;
        })}
      </ul>
    </nav>
  );
}

/* -------------------------------------------------- */
/* Desktop sidebar (collapsible)                      */
/* -------------------------------------------------- */

interface DesktopSidebarProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export function DesktopSidebar({ collapsed, onNavigate }: DesktopSidebarProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header spacer - aligns with top nav height when collapsed rail shows logo */}
      {collapsed ? (
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-line-muted">
          <LucianEmblem size={28} />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <NavList collapsed={collapsed} onNavigate={onNavigate} />
      </div>
      {!collapsed && (
        <div className="themed border-t border-line-muted px-4 py-3">
          <p className="text-[11px] leading-relaxed text-fg-faint">
            Lucian Workspace — clean foundation.
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------- */
/* Mobile drawer (slide-over)                         */
/* -------------------------------------------------- */

interface SidebarDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function SidebarDrawer({ open, onClose }: SidebarDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    // prevent body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Close on navigation
  const handleNavigate = () => onClose();

  return (
    <div
      className={`fixed inset-0 z-40 lg:hidden ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={`themed absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface shadow-pop transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line-muted px-4">
          <div className="flex items-center gap-2.5">
            <LucianEmblem size={28} />
            <span className="text-sm font-semibold text-fg">Lucian</span>
          </div>
          <IconButton label="Close navigation" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavList onNavigate={handleNavigate} />
        </div>
      </div>
    </div>
  );
}

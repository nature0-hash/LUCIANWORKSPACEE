"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

interface ProfileMenuProps {
  onOpenSettings: () => void;
}

export function ProfileMenu({ onOpenSettings }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and Escape.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const itemClass =
    "focus-ring flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-fg transition-colors hover:bg-hover";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open user menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`focus-ring themed rounded-full transition-shadow ${
          open ? "ring-2 ring-accent ring-offset-2 ring-offset-surface-2" : ""
        }`}
      >
        <Avatar size={30} />
      </button>

      {open && (
        <div
          role="menu"
          className="themed absolute right-0 top-full z-50 mt-2 w-64 origin-top-right rounded-lg border border-line bg-overlay p-1.5 shadow-pop"
        >
          {/* Header */}
          <div className="flex items-center gap-3 rounded-md px-2.5 py-2.5">
            <Avatar size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-fg">
                Lucian Mercer
              </p>
              <p className="truncate text-xs text-fg-muted">
                lucian@lucid.app
              </p>
            </div>
          </div>

          <div className="my-1 h-px bg-line-muted" />

          <button type="button" role="menuitem" className={itemClass}>
            <User size={15} className="text-fg-muted" />
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <Settings size={15} className="text-fg-muted" />
            Settings
          </button>

          <div className="my-1 h-px bg-line-muted" />

          <button type="button" role="menuitem" className={itemClass}>
            <LogOut size={15} className="text-fg-muted" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

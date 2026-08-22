"use client";

import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Home page — intentionally minimal.
 *
 * The homepage shows a search field and an open canvas area. Future modules
 * (Project Library, editor, etc.) will eventually occupy this space, but
 * Phase 2 leaves it intentionally empty rather than filling it with filler.
 */
export default function HomePage() {
  return (
    <PageShell width="default">
      <PageHeader title="Home" />

      {/* Search / jump-to bar */}
      <div className="mt-5">
        <div className="focus-within:outline-2 focus-within:outline-accent themed flex items-center gap-2 rounded-md border border-line bg-inset px-3 outline-offset-[-1px] transition-colors">
          <Search size={14} className="shrink-0 text-fg-faint" />
          <input
            type="search"
            placeholder="Search or jump to something…"
            className="h-10 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-faint"
          />
          <kbd className="pointer-events-none hidden rounded border border-line px-1.5 py-px font-sans text-[10px] leading-4 text-fg-faint sm:block">
            /
          </kbd>
        </div>
      </div>

      {/* Open canvas — intentionally empty for Phase 2.
          Future modules (projects, editor, etc.) will dock here. */}
    </PageShell>
  );
}

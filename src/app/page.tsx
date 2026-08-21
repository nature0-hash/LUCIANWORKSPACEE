import { PageShell } from "@/components/layout/PageShell";
import { Search } from "lucide-react";

export default function HomePage() {
  return (
    <PageShell title="Home">
      {/* Primary search / jump - the only interactive element on the clean home */}
      <div className="themed flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 shadow-sm">
        <Search size={16} className="shrink-0 text-fg-faint" />
        <input
          type="search"
          placeholder="Search or jump to something…"
          aria-label="Search or jump to something"
          className="w-full bg-transparent text-sm text-fg placeholder:text-fg-faint outline-none"
        />
        <kbd className="hidden rounded border border-line bg-surface-2 px-1.5 py-0.5 font-sans text-[11px] text-fg-faint sm:block">
          /
        </kbd>
      </div>

      {/* Intentionally spacious empty workspace - future modules will occupy this */}
      <div className="mt-8">
        <div className="themed rounded-lg border border-dashed border-line bg-surface-2/20 px-6 py-16 text-center">
          <p className="text-sm text-fg-muted">
            Your workspace is ready.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-fg-faint">
            Future modules — projects, editor, and tools — will appear here without changing the surrounding shell.
          </p>
        </div>
      </div>
    </PageShell>
  );
}

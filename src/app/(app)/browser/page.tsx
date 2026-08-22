"use client";

import { Monitor, Globe } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";

export default function BrowserPage() {
  return (
    <PageShell width="default">
      <div className="flex items-center gap-2">
        <Globe className="h-5 w-5 text-accent" />
        <h1 className="text-base font-semibold">Browser</h1>
      </div>
      <div className="mt-8 flex flex-col items-center justify-center rounded-md border border-dashed border-line-muted p-12 text-center">
        <Monitor className="mb-3 h-10 w-10 text-fg-faint" />
        <h2 className="text-sm font-medium text-fg">Desktop feature</h2>
        <p className="mt-1 max-w-sm text-xs text-fg-muted">
          The LUCIAN Browser provides real browser tabs (normal + private) with
          persistent sessions, navigation, and back/forward. This requires the
          LUCIAN desktop application — it cannot run in a web browser due to
          cross-origin and sandbox restrictions.
        </p>
        <p className="mt-3 text-[11px] text-fg-faint">
          Tor browsing is a future capability and is not yet implemented.
        </p>
      </div>
    </PageShell>
  );
}

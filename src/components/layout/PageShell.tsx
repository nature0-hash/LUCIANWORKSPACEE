"use client";

import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}

export function PageShell({ title, description, actions, children, maxWidth = "max-w-5xl" }: PageShellProps) {
  return (
    <div className={`mx-auto w-full ${maxWidth} px-4 py-6 sm:px-6 lg:px-8`}>
      <header className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
            {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      </header>
      <div>{children}</div>
    </div>
  );
}

export function Section({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title && <h2 className="mb-3 text-sm font-semibold text-fg">{title}</h2>}
      {children}
    </section>
  );
}

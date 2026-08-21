"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="themed flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface-2/30 px-6 py-14 text-center">
      {icon && (
        <div className="themed mb-4 flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-fg-faint">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-fg-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

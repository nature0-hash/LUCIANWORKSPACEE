"use client";

/**
 * Right context panel foundation.
 * Preserved architecture for future modules (visual-editor properties,
 * code information, Lilith context, trading information, inspector tools)
 * but currently hidden when unused so the main workspace expands naturally.
 *
 * Future features can conditionally render content here without rebuilding the global shell.
 */

interface RightPanelProps {
  children?: React.ReactNode;
  open?: boolean;
}

export function RightPanel({ children, open = false }: RightPanelProps) {
  if (!open || !children) return null;

  return (
    <div className="sticky top-0 w-80 shrink-0">
      <div className="themed rounded-lg border border-line bg-surface p-4">
        {children}
      </div>
    </div>
  );
}

/** Slot placeholder used only when needed by future modules */
export function RightPanelSlot() {
  return null;
}

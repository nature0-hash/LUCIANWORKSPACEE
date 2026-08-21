"use client";

import { useEffect } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { GeneralSettings } from "@/components/settings/GeneralSettings";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
      />

      {/* Dialog */}
      <div className="themed relative flex h-[min(680px,92dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        {/* Header */}
        <div className="themed flex h-13 shrink-0 items-center justify-between border-b border-line-muted px-4 sm:px-5">
          <h2 className="text-sm font-semibold text-fg">Settings</h2>
          <IconButton label="Close settings" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Settings navigation */}
          <nav className="themed shrink-0 border-b border-line-muted p-2 sm:w-44 sm:border-b-0 sm:border-r sm:p-3">
            <button
              type="button"
              aria-current="page"
              className="focus-ring themed flex w-full items-center gap-2.5 rounded-md bg-active px-2.5 py-1.5 text-left text-sm font-medium text-fg"
            >
              <SlidersHorizontal size={14} className="text-accent" />
              General
            </button>
          </nav>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            <GeneralSettings />
          </div>
        </div>
      </div>
    </div>
  );
}

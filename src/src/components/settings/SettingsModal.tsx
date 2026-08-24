"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, Sparkles, X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { LilithSettings } from "@/components/lilith/lilith-settings";
import { cn } from "@/lib/utils";

type SettingsTab = "general" | "lilith";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<SettingsTab>("general");

  // Escape to close, body scroll lock, and initial focus on the close button
  // (which gives an obvious escape hatch and avoids tab-leak to the page).
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog on open
    const focusTimer = window.setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
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
      <div
        ref={dialogRef}
        className="themed relative flex h-[min(680px,92dvh)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
      >
        {/* Header */}
        <div className="themed flex h-13 shrink-0 items-center justify-between border-b border-line-muted px-4 sm:px-5">
          <h2 className="text-sm font-semibold text-fg">Settings</h2>
          <IconButton ref={closeBtnRef} label="Close settings" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>

        {/* Body */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* Settings navigation */}
          <nav className="themed shrink-0 space-y-1 border-b border-line-muted p-2 sm:w-44 sm:border-b-0 sm:border-r sm:p-3">
            <button
              type="button"
              aria-current={tab === "general" ? "page" : undefined}
              onClick={() => setTab("general")}
              className={cn(
                "focus-ring themed flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                tab === "general"
                  ? "bg-active text-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg",
              )}
            >
              <SlidersHorizontal size={14} className={tab === "general" ? "text-accent" : ""} />
              General
            </button>
            <button
              type="button"
              aria-current={tab === "lilith" ? "page" : undefined}
              onClick={() => setTab("lilith")}
              className={cn(
                "focus-ring themed flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm font-medium transition-colors",
                tab === "lilith"
                  ? "bg-active text-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg",
              )}
            >
              <Sparkles size={14} className={tab === "lilith" ? "text-accent" : ""} />
              Lilith
            </button>
          </nav>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
            {tab === "general" && <GeneralSettings />}
            {tab === "lilith" && <LilithSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

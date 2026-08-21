"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export function Dialog({ open, onClose, title, children, maxWidth = "max-w-3xl" }: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      ref={overlayRef}
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className={`themed relative flex max-h-[92dvh] w-full ${maxWidth} flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop`}
      >
        <div className="themed flex h-[52px] shrink-0 items-center justify-between border-b border-line-muted px-4 sm:px-5">
          <h2 className="text-sm font-semibold text-fg">{title}</h2>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

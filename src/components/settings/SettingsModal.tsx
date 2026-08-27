"use client";

/* LUCIAN — Settings modal.
 *
 * Backward-compatibility shim. The full Settings experience now lives
 * at /settings (a real route — desktop fixed-nav + scrollable content,
 * mobile list-navigate, search). The old modal triggers in TopNav
 * and ProfileMenu still call openSettings(); this shim now redirects
 * them to /settings instead of opening the old two-tab modal.
 *
 * The old GeneralSettings + LilithSettings panels are preserved at
 * their original paths so existing imports don't break, but the user
 * is funneled to the unified Settings page.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    // Navigate to the full Settings page; close the modal trigger.
    router.push("/settings");
    onClose();
  }, [open, onClose, router]);

  // Render nothing — this is now a redirect shim.
  return null;
}

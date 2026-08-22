import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

/**
 * Application shell layout.
 *
 * This layout renders the persistent global chrome (top nav, sidebar,
 * settings modal) once, then mounts each route's content into the main
 * area via {children}. Because Next.js preserves layouts across route
 * changes, the shell never unmounts during in-app navigation — sidebar
 * state, theme state and settings state all carry over.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}

"use client";

import { FolderKanban } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageShell } from "@/components/ui/PageShell";

/**
 * Projects page — empty state for Phase 2.
 *
 * Project creation (ZIP upload, folder upload, GitHub import) is coming in
 * Phase 3. Until then, the page shows a clean empty state and intentionally
 * does not pretend that any projects exist.
 */
export default function ProjectsPage() {
  return (
    <PageShell width="default">
      <PageHeader
        title="Projects"
        description="Your local and imported projects will appear here."
      />

      <div className="mt-6">
        <EmptyState
          icon={<FolderKanban size={20} />}
          title="No projects yet"
          description="Project Library support — including ZIP upload, folder upload, and GitHub import — arrives in a later phase. For now, this space is intentionally empty."
        />
      </div>
    </PageShell>
  );
}

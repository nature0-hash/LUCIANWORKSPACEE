import { PageShell } from "@/components/layout/PageShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { FolderKanban } from "lucide-react";

export default function ProjectsPage() {
  return (
    <PageShell title="Projects">
      <EmptyState
        title="No projects yet."
        description="Projects you create or import will appear here. Project import and creation will be available in a later phase."
        icon={<FolderKanban size={18} />}
      />
    </PageShell>
  );
}

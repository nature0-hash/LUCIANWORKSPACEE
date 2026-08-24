"use client";

import {
  ArrowLeft,
  Save,
  Download,
  History,
  RefreshCw,
  Image as ImageIcon,
  Settings2,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useWorkspaceStore } from "@/store/workspace";
import { Button } from "@/components/ui-devspace/button";
import { Badge } from "@/components/ui-devspace/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-devspace/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-devspace/dropdown-menu";
import { saveAs } from "file-saver";
import { exportProjectToZip } from "@/lib/workspace/project";
import { toast } from "@/hooks/use-toast";
import type { PreviewMode, ResponsiveDevice } from "@/types/workspace";
import { useState } from "react";
import { HistoryDialog } from "./history-dialog";
import { AssetManagerDialog } from "./asset-manager-dialog";
import { EnvSettingsDialog } from "./env-settings-dialog";

const DEVICES: { id: ResponsiveDevice; label: string; icon: typeof Monitor; width: number }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: 1280 },
  { id: "tablet", label: "Tablet", icon: Tablet, width: 768 },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: 375 },
];

const MODE_LABELS: Record<PreviewMode, string> = {
  real: "Real",
  demo: "Demo",
  fake: "Fake",
};

const MODE_COLORS: Record<PreviewMode, string> = {
  real: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  demo: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  fake: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
};

export function WorkspaceToolbar() {
  const {
    activeProject,
    setView,
    previewMode,
    setPreviewMode,
    device,
    setDevice,
    refreshPreview,
    previewKey,
    persistActive,
    getActiveProjectFiles,
  } = useWorkspaceStore();

  const [historyOpen, setHistoryOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [envOpen, setEnvOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!activeProject) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Load all file contents before zipping.
      const files = await getActiveProjectFiles();
      const blob = await exportProjectToZip(files, activeProject.name);
      saveAs(blob, `${activeProject.name.replace(/[^a-z0-9-_]/gi, "_")}.zip`);
      toast({ title: "Download started", description: `${activeProject.name}.zip` });
    } catch (err) {
      console.error(err);
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setView("library")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Library
        </Button>
        <span className="text-sm font-medium">{activeProject.name}</span>
        <Badge variant="secondary" className="ml-2 hidden text-xs sm:inline-flex">
          {activeProject.files.length} files
        </Badge>
      </div>

      <div className="flex items-center gap-1">
        {/* Device toggle */}
        <div className="hidden items-center rounded-md border border-border/50 bg-background p-0.5 md:flex">
          {DEVICES.map((d) => {
            const Icon = d.icon;
            return (
              <Button
                key={d.id}
                variant={device === d.id ? "default" : "ghost"}
                size="sm"
                className={cn("h-7 px-2", device === d.id ? "" : "text-muted-foreground")}
                onClick={() => setDevice(d.id)}
                title={`${d.label} (${d.width}px)`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>

        {/* Preview mode selector */}
        <Select value={previewMode} onValueChange={(v) => setPreviewMode(v as PreviewMode)}>
          <SelectTrigger className="h-8 w-[110px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="real">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" /> Real
              </span>
            </SelectItem>
            <SelectItem value="demo">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Demo
              </span>
            </SelectItem>
            <SelectItem value="fake">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-500" /> Fake
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className={cn("hidden text-xs lg:inline-flex", MODE_COLORS[previewMode])}>
          {MODE_LABELS[previewMode]} mode
        </Badge>

        <Button variant="ghost" size="sm" onClick={() => refreshPreview()} title="Refresh preview">
          <RefreshCw className="h-4 w-4" />
          <span className="sr-only">Refresh</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Settings2 className="h-4 w-4" />
              <span className="sr-only">More</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAssetOpen(true)}>
              <ImageIcon className="mr-2 h-4 w-4" /> Manage Assets
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setEnvOpen(true)}>
              <Sparkles className="mr-2 h-4 w-4" /> Environment Variables
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await persistActive();
                toast({ title: "All changes saved" });
              }}
            >
              <Save className="mr-2 h-4 w-4" /> Save All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          <History className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">History</span>
        </Button>

        <Button size="sm" onClick={handleDownload} disabled={downloading}>
          <Download className="mr-1 h-4 w-4" />
          <span className="hidden sm:inline">{downloading ? "Packing..." : "Download"}</span>
        </Button>
      </div>

      <HistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
      <AssetManagerDialog open={assetOpen} onOpenChange={setAssetOpen} />
      <EnvSettingsDialog open={envOpen} onOpenChange={setEnvOpen} />

      {/* Hidden span to keep previewKey referenced for re-render tracking */}
      <span className="sr-only">preview build #{previewKey}</span>
    </div>
  );
}

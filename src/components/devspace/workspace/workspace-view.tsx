"use client";

import { useState } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { Zap, Eye } from "lucide-react";
import { FileExplorer } from "./file-explorer";
import { CodeEditorPane } from "./code-editor-pane";
import { PreviewPane } from "./preview-pane";
import { LiveRuntimePane } from "./live-runtime-pane";
import { WorkspaceToolbar } from "./workspace-toolbar";
import { cn } from "@/lib/utils";

type RightPane = "preview" | "runtime";

export function WorkspaceView() {
  // "preview" = instant static/Babel engine; "runtime" = real WebContainer
  // dev server. Both are honest about what they are.
  const [rightPane, setRightPane] = useState<RightPane>("preview");

  return (
    <div className="flex h-full flex-col">
      <WorkspaceToolbar />
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={20} minSize={12} maxSize={40}>
            <FileExplorer />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={40} minSize={20}>
            <CodeEditorPane />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-primary/30 transition-colors" />
          <Panel defaultSize={40} minSize={20}>
            <div className="flex h-full flex-col">
              {/* Pane switcher */}
              <div className="flex h-8 shrink-0 items-center gap-1 border-b bg-card px-2">
                <PaneTab
                  active={rightPane === "preview"}
                  onClick={() => setRightPane("preview")}
                  icon={Eye}
                  label="Preview"
                  hint="Instant static preview (Babel engine)"
                />
                <PaneTab
                  active={rightPane === "runtime"}
                  onClick={() => setRightPane("runtime")}
                  icon={Zap}
                  label="Live Runtime"
                  hint="Real dev server via WebContainer (npm install + hot reload)"
                />
              </div>
              <div className="flex-1 overflow-hidden">
                {rightPane === "preview" ? <PreviewPane /> : <LiveRuntimePane />}
              </div>
            </div>
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

function PaneTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  label: string;
  hint: string;
}) {
  return (
    <button
      onClick={onClick}
      title={hint}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

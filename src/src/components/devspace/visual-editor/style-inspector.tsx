"use client";

// Style Inspector for the Visual Editor.
//
// Shows properties of the currently selected element. Edits write back
// to the REAL source file (HTML/CSS) via the project-service writeFile
// action — no fake overlay.

import { useEffect, useState } from "react";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import { Button } from "@/components/ui-devspace/button";
import { useWorkspaceStore } from "@/store/workspace";
import {
  patchFileContent,
  type VisualNode,
} from "@/lib/workspace/visual-editor";
import { toast } from "@/hooks/use-toast";

interface StyleInspectorProps {
  /** Currently selected node from the iframe (or null). */
  node: VisualNode | null;
  /** Path of the file the canvas is currently rendering. */
  entryFile: string;
  /** Called after a successful source patch — the caller refreshes the canvas. */
  onPatched: () => void;
}

/**
 * Find a VisualNode by id anywhere in the tree.
 */
function findNode(root: VisualNode, id: string): VisualNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function StyleInspector({ node, entryFile, onPatched }: StyleInspectorProps) {
  const activeProject = useWorkspaceStore((s) => s.activeProject);
  const loadFileContent = useWorkspaceStore((s) => s.loadFileContent);
  const writeFile = useWorkspaceStore((s) => s.writeFile);
  const refreshPreview = useWorkspaceStore((s) => s.refreshPreview);
  const [saving, setSaving] = useState(false);

  // Local editable copies of the node's text + key style properties.
  const [textDraft, setTextDraft] = useState("");
  const [styleDraft, setStyleDraft] = useState<Record<string, string>>({});

  // Sync drafts when the selected node changes. We use a deferred effect
  // to avoid the set-state-in-render lint rule (this would otherwise be a
  // useMemo that mutates state, which is forbidden).
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setTextDraft(node?.text ?? "");
      setStyleDraft(node?.style ? { ...node.style } : {});
    });
    return () => {
      cancelled = true;
    };
  }, [node?.id]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        Select an element on the canvas or in the Layers panel to inspect its properties.
      </div>
    );
  }

  const handleApplyText = async () => {
    if (!activeProject) return;
    setSaving(true);
    try {
      const source = await loadFileContent(activeProject.id, entryFile);
      if (typeof source !== "string") {
        toast({ title: "Source file not loaded", variant: "destructive" });
        return;
      }
      const patched = patchFileContent(entryFile, source, node.id, {
        kind: "text",
        value: textDraft,
      });
      await writeFile(entryFile, patched);
      refreshPreview();
      onPatched();
      toast({ title: "Text updated" });
    } catch (err) {
      toast({
        title: "Couldn't update text",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyStyle = async (property: string, value: string) => {
    if (!activeProject) return;
    setSaving(true);
    try {
      const source = await loadFileContent(activeProject.id, entryFile);
      if (typeof source !== "string") return;
      const patched = patchFileContent(entryFile, source, node.id, {
        kind: "style",
        property,
        value,
      });
      await writeFile(entryFile, patched);
      refreshPreview();
      onPatched();
    } catch (err) {
      toast({
        title: "Couldn't update style",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAttribute = async (attribute: string, value: string) => {
    if (!activeProject) return;
    setSaving(true);
    try {
      const source = await loadFileContent(activeProject.id, entryFile);
      if (typeof source !== "string") return;
      const patched = patchFileContent(entryFile, source, node.id, {
        kind: "attribute",
        property: attribute,
        value,
      });
      await writeFile(entryFile, patched);
      refreshPreview();
      onPatched();
    } catch (err) {
      toast({
        title: "Couldn't update attribute",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 text-xs">
      {/* Element header */}
      <div className="rounded-md border border-border/50 bg-muted/40 px-2 py-1.5">
        <div className="flex items-center justify-between">
          <code className="font-mono text-[11px]">{node.tag}</code>
          <code className="text-[10px] text-muted-foreground">#{node.id}</code>
        </div>
        {node.className ? (
          <p className="mt-1 truncate text-[10px] text-muted-foreground">
            .{node.className.split(" ").slice(0, 3).join(" .")}
          </p>
        ) : null}
      </div>

      {/* Text content */}
      <section>
        <Label className="mb-1 text-[11px]">Text content</Label>
        <textarea
          value={textDraft}
          onChange={(e) => setTextDraft(e.target.value)}
          className="w-full rounded-md border bg-input/30 px-2 py-1.5 text-xs"
          rows={2}
        />
        <Button
          size="sm"
          className="mt-1 h-6 w-full"
          disabled={saving || textDraft === node.text}
          onClick={handleApplyText}
        >
          Apply text
        </Button>
      </section>

      {/* Inline styles (key subset) */}
      <section>
        <Label className="mb-1 text-[11px]">Inline styles</Label>
        <div className="space-y-1">
          {[
            "color",
            "background-color",
            "font-size",
            "font-weight",
            "padding",
            "margin",
            "border",
            "border-radius",
            "width",
            "height",
          ].map((prop) => (
            <div key={prop} className="flex items-center gap-1">
              <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">
                {prop}
              </span>
              <Input
                value={styleDraft[prop] ?? ""}
                onChange={(e) =>
                  setStyleDraft((s) => ({ ...s, [prop]: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleApplyStyle(prop, styleDraft[prop] ?? "");
                  }
                }}
                className="h-6 flex-1 text-[11px]"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                disabled={saving}
                onClick={() => void handleApplyStyle(prop, styleDraft[prop] ?? "")}
                title="Apply"
              >
                ✓
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Attributes */}
      {Object.keys(node.attributes).length > 0 ? (
        <section>
          <Label className="mb-1 text-[11px]">Attributes</Label>
          <div className="space-y-1">
            {Object.entries(node.attributes)
              .slice(0, 6)
              .map(([name, value]) => (
                <div key={name} className="flex items-center gap-1">
                  <span className="w-28 shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {name}
                  </span>
                  <Input
                    defaultValue={value}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const target = e.target as HTMLInputElement;
                        void handleApplyAttribute(name, target.value);
                      }
                    }}
                    className="h-6 flex-1 text-[11px]"
                  />
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <p className="rounded-md bg-muted/40 px-2 py-1.5 text-[10px] text-muted-foreground">
        Edits write back to <code className="font-mono">{entryFile}</code> in
        the real project source. The canvas refreshes to reflect the change.
      </p>
    </div>
  );
}

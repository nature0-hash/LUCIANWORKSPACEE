"use client";

// Layers panel — renders the iframe's element tree (VisualNode).
//
// Selecting a node in the layers panel selects it in the iframe and loads
// its properties in the Style inspector. Built from the actual DOM tree
// posted by the iframe — never fabricated.

import { ChevronDown, ChevronRight, type LucideIcon } from "lucide-react";
import { useState } from "react";
import type { VisualNode } from "@/lib/workspace/visual-editor";
import { cn } from "@/lib/utils";

interface LayersPanelProps {
  root: VisualNode | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function LayersPanel({ root, selectedId, onSelect }: LayersPanelProps) {
  if (!root) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-xs text-muted-foreground">
        No elements loaded. The canvas will populate this list when it renders.
      </div>
    );
  }
  return (
    <ul className="space-y-0.5 p-1 text-xs">
      {root.children.map((child) => (
        <LayerNode
          key={child.id}
          node={child}
          depth={0}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function LayerNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: VisualNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(isSelected ? null : node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(isSelected ? null : node.id);
          }
        }}
        style={{ paddingLeft: 6 + depth * 12 }}
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-sm py-1 pr-2 transition-colors",
          isSelected
            ? "bg-primary/15 text-primary-foreground"
            : "hover:bg-accent hover:text-accent-foreground",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex h-3 w-3 shrink-0 items-center justify-center text-muted-foreground"
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {node.tag}
        </span>
        <span className="truncate text-[11px]">
          {node.text || <span className="text-muted-foreground">(no text)</span>}
        </span>
      </div>
      {hasChildren && expanded ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <LayerNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// Suppress unused-import warning for LucideIcon (kept for type compatibility).
void (undefined as unknown as LucideIcon);

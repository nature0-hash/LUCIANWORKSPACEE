"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  File as FileIconLucide,
  FileCode,
  FileJson,
  FileText,
  FolderClosed,
  FolderOpen,
  Image as ImageIcon,
} from "lucide-react";
import { buildFileTree, formatBytes } from "@/lib/projects";
import type { ProjectFile, ProjectTreeNode } from "@/lib/projects";

interface FileTreeProps {
  files: ProjectFile[];
  /** Currently selected file path (controlled). */
  selectedPath: string | null;
  /** Called when a file is clicked. */
  onSelect: (file: ProjectFile) => void;
}

/**
 * Expandable file/folder tree for a project.
 *
 * - Folders expand/collapse on click; clicking a folder does not select it.
 * - Files become selected on click and are highlighted with the accent color.
 * - Default behavior: all top-level folders collapsed; user expands what they want.
 *   This avoids the "everything is open" wall of text for big projects.
 * - Theme-aware — uses `--line`, `--fg`, `--accent` etc. throughout.
 *
 * The tree is built from a flat list of ProjectFile rows using buildFileTree
 * from the project service. We memoize so re-renders (e.g. parent state
 * changes) don't rebuild the tree.
 */
export function FileTree({ files, selectedPath, onSelect }: FileTreeProps) {
  const tree = useMemo(() => buildFileTree(files), [files]);
  // Track expanded folder paths in a Set so toggle is O(1).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (tree.children?.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-xs text-fg-faint">
        This project has no files.
      </p>
    );
  }

  return (
    <ul role="tree" className="space-y-0.5 text-sm">
      {tree.children!.map((child) => (
        <FileTreeNode
          key={child.path}
          node={child}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          selectedPath={selectedPath}
          onSelect={onSelect}
          filesByPath={filesByPath(files)}
        />
      ))}
    </ul>
  );
}

interface FileTreeNodeProps {
  node: ProjectTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedPath: string | null;
  onSelect: (file: ProjectFile) => void;
  filesByPath: Map<string, ProjectFile>;
}

function FileTreeNode({
  node,
  depth,
  expanded,
  onToggle,
  selectedPath,
  onSelect,
  filesByPath,
}: FileTreeNodeProps) {
  const paddingLeft = 8 + depth * 14;
  const isExpanded = expanded.has(node.path);
  const isSelected = selectedPath === node.path;

  if (node.type === "folder") {
    return (
      <li role="treeitem" aria-expanded={isExpanded} aria-selected={false}>
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="focus-ring themed flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-fg-muted transition-colors hover:bg-hover hover:text-fg"
          style={{ paddingLeft }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-faint">
            {isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
          </span>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-accent">
            {isExpanded ? <FolderOpen size={14} /> : <FolderClosed size={14} />}
          </span>
          <span className="truncate">{node.name}</span>
        </button>
        {isExpanded ? (
          <ul role="group" className="space-y-0.5">
            {node.children?.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                expanded={expanded}
                onToggle={onToggle}
                selectedPath={selectedPath}
                onSelect={onSelect}
                filesByPath={filesByPath}
              />
            ))}
          </ul>
        ) : null}
      </li>
    );
  }

  // File row
  const file = filesByPath.get(node.path);
  return (
    <li role="treeitem" aria-selected={isSelected}>
      <button
        type="button"
        onClick={() => {
          if (file) onSelect(file);
        }}
        className={`focus-ring themed flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left transition-colors ${
          isSelected
            ? "bg-active text-fg"
            : "text-fg-muted hover:bg-hover hover:text-fg"
        }`}
        style={{ paddingLeft: paddingLeft + 18 }}
        title={node.path}
      >
        <span
          className={`flex h-4 w-4 shrink-0 items-center justify-center ${
            isSelected ? "text-accent" : "text-fg-faint"
          }`}
        >
          <FileIcon extension={node.extension} kind={node.kind} size={13} />
        </span>
        <span className="truncate">{node.name}</span>
        {typeof node.size === "number" && node.size > 0 ? (
          <span className="ml-auto shrink-0 pl-2 text-[10px] tabular-nums text-fg-faint">
            {formatBytes(node.size)}
          </span>
        ) : null}
      </button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function filesByPath(files: ProjectFile[]): Map<string, ProjectFile> {
  const map = new Map<string, ProjectFile>();
  for (const f of files) map.set(f.path, f);
  return map;
}

interface FileIconProps {
  extension?: string;
  kind?: string;
  size: number;
}

/**
 * Render a file-type icon based on the file's extension + kind.
 *
 * Declared as a stable top-level component (NOT inside FileTreeNode) so the
 * `react-hooks/static-components` lint rule is satisfied and React doesn't
 * recreate the component identity on each render (which would lose any
 * internal state the icon component might hold).
 */
function FileIcon({ extension, kind, size }: FileIconProps) {
  if (kind === "image") return <ImageIcon size={size} />;
  if (kind === "json") return <FileJson size={size} />;
  if (kind === "markdown") return <FileText size={size} />;
  if (
    kind === "text" &&
    [
      "ts",
      "tsx",
      "js",
      "jsx",
      "mjs",
      "cjs",
      "vue",
      "svelte",
      "astro",
      "py",
      "rb",
      "go",
      "rs",
      "java",
    ].includes(extension ?? "")
  ) {
    return <FileCode size={size} />;
  }
  if (kind === "text") return <FileText size={size} />;
  return <FileIconLucide size={size} />;
}



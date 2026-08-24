// Project-aware tools the LUCIAN Project Agent can call.
//
// Each tool is project-scoped: it operates on the currently active project
// from the DevWorkspace Zustand store. Tools deliberately do NOT have
// access to other LUCIAN systems (no auth, no Settings, no profile).

import type { AgentTool, ToolContext } from "./types";
import {
  detectFramework,
  frameworkLabel,
  formatBytes,
} from "@/lib/workspace/filesystem";
import { scanProject } from "@/lib/workspace/project-scanner";
import { countMissing } from "@/lib/workspace/project-scanner";

/** Build a file tree as an indented text representation for the model. */
function filesAsTree(paths: string[]): string {
  const sorted = [...paths].sort();
  return sorted.join("\n");
}

/** Pick the most relevant files for the model to inspect (skip large + binary). */
function pickRelevantFiles(
  files: { path: string; size: number; binary: boolean }[],
  limit = 40,
): { path: string; size: number; binary: boolean }[] {
  return files
    .filter((f) => !f.binary)
    .filter((f) => !f.path.startsWith("node_modules/"))
    .filter((f) => !f.path.startsWith(".next/"))
    .filter((f) => !f.path.startsWith("dist/"))
    .filter((f) => !f.path.startsWith("build/"))
    .sort((a, b) => a.path.localeCompare(b.path))
    .slice(0, limit);
}

/**
 * The full set of project-aware tools.
 *
 * Returned as a function so we always see the latest ctx (the active project
 * changes when the user opens a different one).
 */
export function buildProjectTools(): AgentTool[] {
  return [
    {
      name: "list_files",
      description:
        "List all files in the active project, with their sizes. Returns a plain text list. Useful for understanding project structure.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const lines = ctx.project.files.map(
          (f) => `${f.path} (${formatBytes(f.size)})${f.binary ? " [binary]" : ""}`,
        );
        return `Project: ${ctx.project.name}\nFiles (${ctx.project.fileCount}):\n${lines.join("\n")}`;
      },
    },
    {
      name: "read_file",
      description:
        "Read the full text content of a single file from the active project by its path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The file path inside the project, e.g. 'src/App.tsx'.",
          },
        },
        required: ["path"],
      },
      async execute(args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const path = String(args.path ?? "");
        if (!path) return "Error: 'path' is required.";
        const file = ctx.project.files.find((f) => f.path === path);
        if (!file) return `Error: file "${path}" not found in project.`;
        if (file.binary) return `Error: "${path}" is a binary file and cannot be read as text.`;
        const content = await ctx.readFile(path);
        if (content === undefined) return `Error: content for "${path}" could not be loaded.`;
        const truncated = content.length > 16000
          ? content.slice(0, 16000) + "\n... [truncated]"
          : content;
        return truncated;
      },
    },
    {
      name: "write_file",
      description:
        "Write text content to a file in the active project. Persists to IndexedDB AND hot-syncs to a running WebContainer. Use carefully.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The file path to write." },
          content: { type: "string", description: "The new file content." },
        },
        required: ["path", "content"],
      },
      async execute(args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const path = String(args.path ?? "");
        const content = String(args.content ?? "");
        if (!path) return "Error: 'path' is required.";
        await ctx.writeFile(path, content);
        return `Wrote ${content.length} chars to ${path}.`;
      },
    },
    {
      name: "scan_project",
      description:
        "Scan the active project for required environment variables and external services (Supabase, Stripe, Postgres, etc.) and report what's needed to go live.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        await ctx.scanProject();
        const scan = ctx.project.scanResult;
        if (!scan) return "Scan completed but produced no result.";
        const missing = countMissing(scan);
        const envLines = scan.envVars.map(
          (e) => `  ${e.key}${e.configured ? " ✓" : " ✗ missing"} — ${e.hint ?? ""}`,
        );
        const serviceLines = scan.services.map(
          (s) =>
            `  ${s.name} (${s.type})${s.configured ? " ✓ configured" : " ✗ missing"} — needs: ${s.requiredEnvVars.join(", ") || "n/a"}`,
        );
        return `Scan complete (${missing.total} missing items).
Environment variables:
${envLines.join("\n") || "  none"}
External services:
${serviceLines.join("\n") || "  none"}`;
      },
    },
    {
      name: "get_framework",
      description:
        "Return the detected framework of the active project (e.g. 'nextjs', 'react-vite', 'html'). Includes file count and total size.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        return `Framework: ${frameworkLabel(ctx.project.framework)} (raw: ${ctx.project.framework})
Files: ${ctx.project.fileCount}
Size: ${formatBytes(ctx.project.totalSize)}
Detected from ${ctx.project.files.length} file entries.`;
      },
    },
    {
      name: "get_runtime_status",
      description:
        "Get the current state of the live runtime (WebContainer) — status, server URL if running, and any error.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const r = await ctx.getRuntimeStatus();
        return `Runtime status: ${r.status}\nServer URL: ${r.serverUrl ?? "—"}\nError: ${r.error ?? "—"}`;
      },
    },
    {
      name: "get_terminal_output",
      description:
        "Return the most recent terminal output (npm install / dev server logs). Useful for diagnosing why a project won't run.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const out = await ctx.getTerminalOutput();
        if (!out) return "Terminal output is empty (no runtime session yet).";
        const truncated = out.length > 8000 ? out.slice(-8000) : out;
        return truncated;
      },
    },
    {
      name: "summarize_structure",
      description:
        "Summarize the active project's structure: top-level files and folders, package.json name/scripts, detected framework. Faster than list_files for large projects.",
      parameters: { type: "object", properties: {} },
      async execute(_args, ctx: ToolContext) {
        if (!ctx.project) return "No active project.";
        const relevant = pickRelevantFiles(
          ctx.project.files.map((f) => ({ path: f.path, size: f.size, binary: f.binary })),
        );
        const top = new Set<string>();
        for (const f of relevant) {
          const seg = f.path.split("/")[0];
          top.add(seg.includes(".") ? seg : `${seg}/`);
        }
        let pkgSummary = "";
        const pkgFile = ctx.project.files.find((f) => f.path === "package.json");
        if (pkgFile) {
          const content = await ctx.readFile("package.json");
          if (content) {
            try {
              const pkg = JSON.parse(content);
              pkgSummary = `package.json:
  name: ${pkg.name ?? "—"}
  scripts: ${Object.keys(pkg.scripts ?? {}).join(", ") || "—"}
  dependencies: ${Object.keys(pkg.dependencies ?? {}).length}
  devDependencies: ${Object.keys(pkg.devDependencies ?? {}).length}`;
            } catch {
              pkgSummary = "package.json: (could not parse)";
            }
          }
        }
        return `Project: ${ctx.project.name}
Framework: ${frameworkLabel(ctx.project.framework)}
Top-level entries: ${Array.from(top).sort().join(", ")}

${pkgSummary}

Relevant files (${relevant.length} shown):
${filesAsTree(relevant.map((f) => f.path))}`;
      },
    },
  ];
}

// Re-export framework helpers for the agent's convenience
export { detectFramework };

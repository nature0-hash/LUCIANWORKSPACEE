/**
 * Lightweight, file-only framework detection.
 *
 * No code is executed — we only look at filenames and parse package.json
 * dependencies. The result is a coarse label that surfaces in the UI.
 *
 * Detection order matters: Next.js depends on React, so we look for
 * Next.js markers before falling back to plain React.
 */
import type { FrameworkType } from "./types";

interface NormalizedPackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  name?: unknown;
  scripts?: Record<string, string>;
}

/**
 * Try to parse `package.json` text into a normalized shape, ignoring any
 * fields we don't care about. Returns null when invalid.
 */
export function tryParsePackageJson(text: string): NormalizedPackageJson | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as NormalizedPackageJson;
  } catch {
    return null;
  }
}

/**
 * Detect framework from a list of project file paths + an optional parsed
 * package.json (already in object form).
 *
 * The detection is intentionally conservative — when we cannot confidently
 * say what the project is, we return `null` and the UI shows "Unknown".
 */
export function classifyFramework(
  filePaths: string[],
  packageJson: unknown
): FrameworkType {
  const hasFile = (target: string) =>
    filePaths.some((p) => p === target || p.endsWith(`/${target}`));

  // Build a quick lookup of dependency names for exact matching.
  const depNames = new Set<string>();
  if (packageJson && typeof packageJson === "object") {
    const pkg = packageJson as NormalizedPackageJson;
    if (pkg.dependencies) for (const k of Object.keys(pkg.dependencies)) depNames.add(k);
    if (pkg.devDependencies)
      for (const k of Object.keys(pkg.devDependencies)) depNames.add(k);
  }

  // Next.js — `next` dependency + next.config.* file, or just the dep
  // alone (config file is optional in modern Next.js).
  if (depNames.has("next")) {
    return "nextjs";
  }
  // Look for next.config.{js,mjs,ts} even if the dependency is missing
  // (the user may have stripped dependencies during export).
  if (
    hasFile("next.config.js") ||
    hasFile("next.config.mjs") ||
    hasFile("next.config.ts")
  ) {
    return "nextjs";
  }

  // Vite — vite.config.* or vite dependency.
  if (
    depNames.has("vite") ||
    hasFile("vite.config.js") ||
    hasFile("vite.config.mjs") ||
    hasFile("vite.config.ts")
  ) {
    return "vite";
  }

  // Plain React (without a build tool detected above).
  if (depNames.has("react") && depNames.has("react-dom")) {
    return "react";
  }

  // Static HTML — has an index.html and no Node-y markers.
  if (hasFile("index.html") && !depNames.has("express") && !depNames.has("fastify")) {
    return "static-html";
  }

  // Generic Node project — has package.json with scripts and at least
  // one well-known server-side dep, but no React/Vite/Next markers.
  if (
    depNames.has("express") ||
    depNames.has("fastify") ||
    depNames.has("koa") ||
    depNames.has("typescript") // tsconfig-free TS project — counted as Node
  ) {
    return "node";
  }

  // Anything else — we don't pretend to know.
  return null;
}

/** Human-readable label for the UI. */
export function frameworkLabel(fw: FrameworkType): string {
  switch (fw) {
    case "nextjs":
      return "Next.js";
    case "react":
      return "React";
    case "vite":
      return "Vite";
    case "node":
      return "Node.js";
    case "static-html":
      return "Static HTML";
    case null:
      return "Unknown";
  }
}

/**
 * Pick a project name from the available signals.
 *
 * Preferred order (per the spec):
 *   1. Root folder name (e.g. ZIP wrapping a single "my-app/" folder).
 *   2. package.json "name" field — only if it's a sensible non-scoped name.
 *   3. ZIP file name without ".zip".
 *
 * We deliberately strip npm org scopes ("@org/foo" → "foo") because the
 * scope is rarely what a user wants to see as their project's display name.
 */
export function pickProjectName(
  rootFolderName: string,
  packageJson: unknown,
  zipFileName: string
): string {
  if (rootFolderName && rootFolderName.trim().length > 0) {
    return rootFolderName.trim();
  }
  if (packageJson && typeof packageJson === "object") {
    const pkg = packageJson as NormalizedPackageJson;
    if (typeof pkg.name === "string" && pkg.name.trim().length > 0) {
      // Strip npm org scope: "@org/foo" → "foo"
      const trimmed = pkg.name.trim();
      const slash = trimmed.lastIndexOf("/");
      return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
    }
  }
  // Fall back to the ZIP file name without extension.
  const base = zipFileName.replace(/\.zip$/i, "");
  return base.trim() || "Untitled project";
}

/**
 * Ensure a project name is unique within the given set of existing names.
 *
 * Suffixes " (2)", " (3)", etc. — matching the spec's "My Project (2)" pattern.
 * Case-insensitive comparison so two imports of "demo.zip" don't end up
 * creating "demo" and "Demo".
 */
export function ensureUniqueName(
  preferred: string,
  existing: string[]
): string {
  const lower = existing.map((n) => n.toLowerCase());
  if (!lower.includes(preferred.toLowerCase())) return preferred;
  let counter = 2;
  while (lower.includes(`${preferred.toLowerCase()} (${counter})`)) {
    counter++;
  }
  return `${preferred} (${counter})`;
}

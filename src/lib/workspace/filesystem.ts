// Workspace filesystem detection stub.

import type { FileEntry } from "@/types/workspace";
import type { DetectedFramework } from "@/types/workspace";

export function detectFramework(files: FileEntry[]): DetectedFramework {
  if (!files.length) return "unknown";
  const has = (p: string) => files.some((f) => f.path === p || f.path.endsWith("/" + p));
  if (has("next.config.ts") || has("next.config.js")) return "nextjs";
  if (has("vite.config.ts") || has("vite.config.js")) return "react-vite";
  if (has("App.tsx") || has("main.tsx")) return "react-tsx";
  if (has("App.jsx") || has("main.jsx")) return "react-jsx";
  if (has("index.html")) return "html";
  if (has("vue.config.js")) return "vue";
  if (files.some((f) => f.path.endsWith(".html"))) return "static";
  return "unknown";
}

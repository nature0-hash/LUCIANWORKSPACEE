/**
 * Public surface of the Project Library module.
 *
 * Importing from this barrel keeps imports stable across UI components:
 *   import { importZipProject, listAllProjects } from "@/lib/projects";
 *
 * The actual implementation lives in the underlying files. Components
 * should never reach into `database.ts` / `zip-import.ts` directly —
 * those are implementation details.
 */
export type {
  FileKind,
  FrameworkType,
  Project,
  ProjectFile,
  ProjectImportResult,
  ProjectSource,
  ProjectTreeNode,
  ImportStatus,
} from "./types";
export {
  deleteProject,
  formatBytes,
  formatRelativeTime,
  buildFileTree,
  getFileById,
  getProjectById,
  importZipProject,
  listAllProjects,
  listProjectFiles,
  renameProject,
} from "./project-service";
export { frameworkLabel } from "./framework-detection";
export { isAvailable as isIndexedDBAvailable } from "./database";

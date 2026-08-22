// Workspace project scanner stub.

import type { EnvVar, ProjectFile, ScanResult } from "@/types/workspace";

export function scanProject(files: ProjectFile[], envVars: EnvVar[]): ScanResult {
  return {
    envVars: [],
    services: [],
    scannedAt: Date.now(),
  };
}

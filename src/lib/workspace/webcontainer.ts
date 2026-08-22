// Workspace webcontainer stub — runtime sync hooks into a live container
// (not actually wired in this preview).

export function runtimeProjectId(): string | null {
  return null;
}

export async function syncFile(_path: string, _content: string): Promise<void> {
  // no-op
}

export async function removeFile(_path: string): Promise<void> {
  // no-op
}

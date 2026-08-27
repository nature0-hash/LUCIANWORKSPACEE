#!/usr/bin/env python3
"""
LUCIAN Phase 17 — ZIP packaging script.

Packages the COMPLETE current project from /home/z/my-project/lucian/
into a recovery snapshot ZIP. Excludes node_modules, .next, build
artifacts, debug output, and any nested project copies.

Reports actual project file count + ZIP file count + ZIP directory
entry count separately (the user explicitly warned against confusing
files with directory entries).
"""
from __future__ import annotations

import os
import sys
import zipfile
from pathlib import Path

# Where the LUCIAN project lives.
PROJECT_ROOT = Path("/home/z/my-project/lucian")
# Where to write the ZIP.
OUTPUT_DIR = Path("/home/z/my-project/download")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Directories / files NEVER included in the ZIP.
EXCLUDE_DIRS = {
    "node_modules",
    ".next",
    ".git",
    ".vscode",
    ".idea",
    "dist",
    "build",
    "out",
    "coverage",
}

EXCLUDE_FILE_PATTERNS = (
    "tsconfig.tsbuildinfo",
    ".DS_Store",
    "npm-debug.log",
    "yarn-debug.log",
    "yarn-error.log",
    ".pnpm-debug.log",
    ".env",            # never ship real env
    ".env.local",      # never ship local env overrides
    "dev.log",
)

# File extensions / names that are clearly dev / debug artifacts and
# should not be packaged.
DEV_ARTIFACT_PATTERNS = (
    ".pyc",
    ".log",
    ".tmp",
    ".swp",
)


def should_exclude(path: Path) -> bool:
    """True if a path should be excluded from the ZIP."""
    rel = path.relative_to(PROJECT_ROOT)
    parts = rel.parts
    for part in parts:
        if part in EXCLUDE_DIRS:
            return True
    name = path.name
    if name in EXCLUDE_FILE_PATTERNS:
        return True
    if name.endswith(EXCLUDE_FILE_PATTERNS):
        return True
    if name.endswith(DEV_ARTIFACT_PATTERNS):
        return True
    # Don't ship screenshots / QA recordings / debug dumps.
    lower = name.lower()
    if any(token in lower for token in ("screenshot", "qa-recording", "debug-dump")):
        return True
    return False


def count_project_files() -> int:
    """Count actual source files in the project (no dirs, no excluded)."""
    count = 0
    for root, dirs, files in os.walk(PROJECT_ROOT):
        # prune EXCLUDE_DIRS in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        for f in files:
            p = Path(root) / f
            if not should_exclude(p):
                count += 1
    return count


def main(zip_name: str) -> None:
    if not zip_name.endswith(".zip"):
        zip_name = zip_name + ".zip"
    output_path = OUTPUT_DIR / zip_name

    if output_path.exists():
        output_path.unlink()

    file_count = 0
    dir_entry_count = 0

    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk(PROJECT_ROOT):
            dirs[:] = sorted(d for d in dirs if d not in EXCLUDE_DIRS)
            # Add directory entries (so unzip recreates the empty ones).
            rel_root = Path(root).relative_to(PROJECT_ROOT)
            if str(rel_root) != ".":
                zip_dir = str(rel_root).replace(os.sep, "/") + "/"
                zf.writestr(zip_dir, "")
                dir_entry_count += 1
            for f in sorted(files):
                p = Path(root) / f
                if should_exclude(p):
                    continue
                arcname = str(p.relative_to(PROJECT_ROOT)).replace(os.sep, "/")
                zf.write(p, arcname)
                file_count += 1

    project_file_count = count_project_files()
    size_mb = output_path.stat().st_size / (1024 * 1024)

    print(f"=== ZIP PACKAGING REPORT ===")
    print(f"Output:           {output_path}")
    print(f"Size:             {size_mb:.2f} MB")
    print(f"Project files:    {project_file_count}")
    print(f"ZIP files:        {file_count}")
    print(f"ZIP dir entries:  {dir_entry_count}")
    if file_count != project_file_count:
        print(f"WARNING: file count mismatch — {file_count} in ZIP vs {project_file_count} in project root")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: make-phase17-zip.py <zip-name-without-extension>")
        sys.exit(1)
    main(sys.argv[1])

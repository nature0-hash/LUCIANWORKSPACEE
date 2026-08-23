#!/usr/bin/env python3
"""Package the LUCIAN Workspace Next.js project into a single downloadable zip.

Excludes node_modules, .next, dev.log, dev.pid, and other non-source artifacts
so the zip stays small enough to download quickly.
"""

from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path("/home/z/my-project")
OUT = ROOT / "download" / "lucian-workspace-markets-update.zip"

# Directories to skip entirely
SKIP_DIRS = {
    "node_modules",
    ".next",
    ".git",
    ".cache",
    ".turbo",
    "tool-results",
    "upload",
    "skills",  # skill library is large and not part of the project
}

# Specific files to skip
SKIP_FILES = {
    "dev.log",
    "dev.pid",
    "bun.lock",  # keep package-lock.json instead
    "lucian-workspace-phase18-markets-frame-v2.zip",
    "lucian-workspace-markets-update.zip",
}

# Only include these top-level entries
INCLUDE_TOP = {
    "src",
    "public",
    "scripts",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    "README.md",
}


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIRS or name.startswith(".")


def should_skip_file(name: str) -> bool:
    return name in SKIP_FILES or name.startswith(".")


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists():
        OUT.unlink()

    file_count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for top in sorted(ROOT.iterdir()):
            name = top.name
            if name not in INCLUDE_TOP:
                continue
            if top.is_dir():
                for path in sorted(top.rglob("*")):
                    if not path.is_file():
                        continue
                    # Skip excluded directories
                    parts = path.relative_to(ROOT).parts
                    if any(p in SKIP_DIRS for p in parts):
                        continue
                    if should_skip_file(path.name):
                        continue
                    arc = path.relative_to(ROOT)
                    zf.write(path, arc)
                    file_count += 1
            else:
                if should_skip_file(name):
                    continue
                zf.write(top, name)
                file_count += 1

    size_mb = OUT.stat().st_size / (1024 * 1024)
    print(f"Created: {OUT}")
    print(f"Files:   {file_count}")
    print(f"Size:    {size_mb:.2f} MB")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Create a clean deployable ZIP of the Lucian Workspace project.

Includes:
  - All source code under src/
  - public/branding/ assets
  - App Router favicon files (src/app/icon.png, src/app/apple-icon.png)
  - All config files (package.json, tsconfig.json, next.config.ts, postcss.config.mjs, eslint.config.mjs)
  - .gitignore
  - README.md

Excludes:
  - node_modules/
  - .next/ (build artifacts)
  - dev.log, dev.pid (workspace runtime files)
  - .env (no env vars needed)
  - upload/ (raw logo source — already cropped into public/branding/)
  - skills/ (workspace tools, not part of the project)
  - scripts/ (workspace tooling)
  - download/ (output dir)
  - .git/ (the user will git init themselves or push to their own repo)
"""
import os
import zipfile
from pathlib import Path

PROJECT_ROOT = Path("/home/z/my-project")
OUTPUT_ZIP = PROJECT_ROOT / "download" / "lucian-workspace-phase18-markets-frame-v2.zip"

INCLUDE_DIRS = [
    "src",
    "public",
]
INCLUDE_FILES = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "next.config.ts",
    "postcss.config.mjs",
    "eslint.config.mjs",
    ".gitignore",
    "README.md",
]
EXCLUDE_PATTERNS = {
    ".DS_Store",
    "Thumbs.db",
    "__pycache__",
}


def should_skip(path: Path) -> bool:
    """Return True if a file/dir should be excluded."""
    parts = path.parts
    # Skip node_modules, .next, etc.
    for excluded in ("node_modules", ".next", ".git", "__pycache__"):
        if excluded in parts:
            return True
    # Skip workspace-only files
    name = path.name
    if name in EXCLUDE_PATTERNS:
        return True
    return False


def main() -> None:
    OUTPUT_ZIP.parent.mkdir(parents=True, exist_ok=True)
    if OUTPUT_ZIP.exists():
        OUTPUT_ZIP.unlink()

    file_count = 0
    total_size = 0

    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        # Include all directories
        for include_dir in INCLUDE_DIRS:
            root = PROJECT_ROOT / include_dir
            if not root.exists():
                print(f"  (skipping missing dir: {include_dir})")
                continue
            for path in root.rglob("*"):
                if path.is_dir():
                    continue
                if should_skip(path):
                    continue
                arcname = path.relative_to(PROJECT_ROOT)
                zf.write(path, arcname)
                file_count += 1
                total_size += path.stat().st_size

        # Include all root files
        for include_file in INCLUDE_FILES:
            path = PROJECT_ROOT / include_file
            if not path.exists():
                print(f"  (skipping missing file: {include_file})")
                continue
            if should_skip(path):
                continue
            arcname = path.relative_to(PROJECT_ROOT)
            zf.write(path, arcname)
            file_count += 1
            total_size += path.stat().st_size

    zip_size = OUTPUT_ZIP.stat().st_size
    print()
    print(f"Files included: {file_count}")
    print(f"Uncompressed total: {total_size:,} bytes")
    print(f"Zip size: {zip_size:,} bytes")
    print(f"Output: {OUTPUT_ZIP}")

    # Print the contents of the zip for verification
    print()
    print("Zip contents:")
    with zipfile.ZipFile(OUTPUT_ZIP, "r") as zf:
        for info in sorted(zf.infolist(), key=lambda x: x.filename):
            print(f"  {info.filename:60s}  {info.file_size:>8,} bytes")


if __name__ == "__main__":
    main()

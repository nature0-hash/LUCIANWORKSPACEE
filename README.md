# Lucian Workspace

A clean, themeable workspace foundation built with Next.js 16, React 19 and Tailwind CSS v4.

This is **Phase 3A + 3B — Project Library Foundation + Real ZIP Import**. The shell is in place and projects can now be imported from real ZIP files, stored locally in the browser via IndexedDB, and inspected through a clean file tree.

## What's in Phase 3A + 3B

### From Phase 2 (preserved)

- **Branding** — official Lucian Workspace emblem + wordmark, served from `/public/branding/`. App favicon wired through Next.js App Router conventions.
- **Collapsible sidebar** — desktop sidebar collapses to an icon rail (persisted to `localStorage`); mobile drawer slides over content with backdrop, Escape-to-close and scroll lock.
- **Internal navigation** — Next.js App Router with a route group `(app)` that wraps every page in the shared `AppShell`. Navigating between pages swaps only the main content; the shell (top nav, sidebar, settings) stays mounted.
- **Reusable UI primitives** — `Button`, `Card`, `Dialog`, `EmptyState`, `IconButton`, `NavList`, `PageHeader`, `PageShell`, `TextInput`, `Tooltip`, `Avatar`.
- **Theme system preserved** — 10 background themes × 8 accent colors, switched live, persisted to `localStorage`, applied before paint via an inline bootstrap script (no FOUC). Cross-tab sync via `useSyncExternalStore`.
- **Accessibility** — focus rings, ARIA on icon-only buttons, Escape closes modals/drawers, tooltips on collapsed-sidebar icons, body scroll lock when overlays open.

### New in Phase 3A + 3B

- **Project Library** — `/projects` is now the central place where locally imported projects are stored. Empty state when no projects exist; responsive grid of project cards when projects exist.
- **Real ZIP import** — a working `Import ZIP` button opens the OS file picker, accepts a `.zip` file, decompresses it client-side using `fflate`, normalizes paths (rejecting `..` traversal attempts, stripping macOS metadata), and stores the project + files in IndexedDB.
- **IndexedDB persistence** — two object stores (`projects` for metadata, `projectFiles` for file contents) so listing projects does not load every file. Text files are stored as UTF-8 strings; binary files are stored as Blobs. Projects survive refresh, browser restart, and even closing the tab.
- **Project detail page** — `/projects/[id]` shows project metadata (framework, file count, total size, imported date) and a two-pane layout: an expandable file tree on the left, a read-only file preview on the right.
- **File tree** — recursive expand/collapse with folder/file icons, indentation, file sizes, and theme-aware styling. Built from the actual imported file paths — never fake.
- **Read-only file preview** — text/code/json/markdown files render in a `<pre>` with whitespace preserved. Image files render inline via a Blob URL. Binary files show a "No inline preview" message with metadata. No editing, no Save buttons.
- **Rename project** — modal dialog with a validated text input. Persists to IndexedDB, updates the UI immediately, survives refresh.
- **Delete project** — confirmation modal that lists the project name + file count. Deletes the project record AND all associated files atomically (single IndexedDB transaction), then returns to the projects list.
- **Lightweight framework detection** — file-only, no execution. Reads `package.json` dependencies and checks for `next.config.*` / `vite.config.*` / `index.html`. Returns one of: `Next.js`, `React`, `Vite`, `Node.js`, `Static HTML`, or `Unknown`.
- **Path safety** — ZIP entries are normalized: `..` segments are rejected, absolute paths are made relative, Windows drive prefixes are stripped, the optional single top-level wrapper folder is unwrapped so the project root contains real files directly. `node_modules/` is skipped with a warning surfaced on the project record.
- **Duplicate import handling** — importing the same ZIP twice produces `My Project` and `My Project (2)` rather than overwriting.
- **Storage pre-flight check** — uses `navigator.storage.estimate()` to refuse obviously-too-large imports before they fail mid-write. Quota-exceeded errors during write are caught and surface a clean message.
- **Import progress + error states** — truthful, indeterminate states (`Reading archive…` / `Extracting files…` / `Saving project…` / `Import complete` / error message). No fake percentages. The Import button is disabled while an import is in-flight to prevent accidental duplicates.

## Tech stack

- Next.js 16.2.6 (App Router, Turbopack)
- React 19.2.6
- Tailwind CSS 4.1.17 (CSS-variable design tokens via `@theme inline`)
- TypeScript 5.9.3 (strict)
- lucide-react for icons
- **fflate** ^0.8.3 for ZIP decompression (browser-native, ~5KB gzipped)
- **Native IndexedDB** for project persistence (no Dexie — keeps bundle small)

## Scripts

```bash
npm install      # install dependencies
npm run dev     # start dev server on http://localhost:3000
npm run build   # production build
npm run start   # serve the production build
npm run lint     # ESLint
npm run typecheck  # tsc --noEmit
```

## Deployment

The project is a pure frontend deployment — **no environment variables**, **no database**, **no API keys required**. Push to GitHub and import into Vercel; the default settings work out of the box.

All project storage is client-side via IndexedDB. There is no server-side persistence and no synchronization between browsers or devices.

## Project structure

```
public/
  branding/
    lucian-workspace-logo.png       # full horizontal wordmark
    lucian-workspace-icon.png        # square emblem (master icon)
    lucian-workspace-favicon.png     # 256px favicon
    apple-touch-icon.png             # 180px iOS app icon
    icon-32.png                      # 32px browser tab icon
    lucian-workspace-logo-sm.png    # compact wordmark
src/
  app/
    layout.tsx                       # root layout, theme bootstrap, metadata
    globals.css                      # theme variables + Tailwind token mapping
    icon.png                         # Next.js App Router favicon (auto-wired)
    apple-icon.png                   # Next.js App Router iOS icon (auto-wired)
    not-found.tsx                    # 404 page
    api/health/route.ts              # /api/health -> { ok: true }
    (app)/                           # route group — every page wrapped by AppShell
      layout.tsx                     # renders <AppShell>{children}</AppShell>
      page.tsx                       # Home (/)
      projects/
        page.tsx                     # Projects list — the Project Library
        [id]/page.tsx                # Project detail — file tree + preview
  components/
    branding/
      BrandMark.tsx                  # compact emblem component
      BrandWordmark.tsx              # full wordmark component
    layout/
      AppShell.tsx                   # global chrome (top nav + sidebar + main + settings)
      TopNav.tsx                     # top navigation
      Sidebar.tsx                    # expanded sidebar + collapsed rail + mobile drawer
      SidebarContext.tsx             # sidebar state provider (collapsed + mobileOpen)
      ProfileMenu.tsx               # profile dropdown
    projects/
      ImportZipDialog.tsx            # ZIP file picker + progress UI
      ProjectCard.tsx                # one card in the project grid + actions menu
      FileTree.tsx                   # recursive expandable folder/file tree
      FilePreview.tsx                # read-only text/image/metadata preview
      RenameProjectDialog.tsx        # rename modal with validation
      DeleteProjectDialog.tsx        # delete confirmation modal
    settings/
      SettingsModal.tsx              # settings dialog (Escape + scroll lock + focus)
      GeneralSettings.tsx            # theme + accent pickers
    theme/
      ThemeProvider.tsx              # theme + accent context, useSyncExternalStore
    ui/
      Avatar.tsx                     # accent-tinted avatar disc
      Button.tsx                     # primary / secondary / ghost button
      Card.tsx                       # generic surface card
      Dialog.tsx                     # reusable modal (Escape, scroll lock, focus)
      EmptyState.tsx                 # empty-state layout
      IconButton.tsx                 # compact square icon button
      NavList.tsx                    # vertical nav list (expanded + collapsed modes)
      PageHeader.tsx                 # page title + description + actions
      PageShell.tsx                  # page padding/width wrapper
      TextInput.tsx                  # labeled text input with error state
      Tooltip.tsx                    # lightweight tooltip (hover + focus)
  lib/
    themes.ts                        # theme + accent definitions, storage keys
    projects/
      types.ts                      # TypeScript types (Project, ProjectFile, etc.)
      database.ts                   # IndexedDB wrapper (open, CRUD, atomic transactions)
      project-service.ts            # high-level operations: list/get/rename/delete/import
      zip-import.ts                 # fflate decompress + path normalization + classification
      framework-detection.ts        # file-only framework detection + project name picker
      index.ts                      # public barrel export
```

## How the IndexedDB storage is structured

Two object stores in a single database (`lucian-workspace`, version 1):

### `projects` (keyed by `id`)

| Field              | Type     | Notes                                                       |
| ------------------ | -------- | ----------------------------------------------------------- |
| `id`               | string   | `crypto.randomUUID()`                                        |
| `name`             | string   | Display name, renamable                                     |
| `rootFolderName`   | string   | Original wrapper folder, "" if flat                         |
| `sourceType`       | `"zip"`  | Only ZIP import exists in this phase                         |
| `detectedFramework`| enum     | `nextjs` / `react` / `vite` / `node` / `static-html` / `null`|
| `fileCount`        | number   | Total imported files                                         |
| `totalSize`        | number   | Sum of all file sizes in bytes                              |
| `importedAt`       | ISO string | First import timestamp                                     |
| `updatedAt`        | ISO string | Last metadata change (e.g. rename)                          |
| `importWarning`    | string?  | Optional warning (e.g. "node_modules was skipped")          |

Indexed by `importedAt` for sorted listing.

### `projectFiles` (keyed by `${projectId}::${path}`)

| Field        | Type                  | Notes                                                  |
| ------------ | --------------------- | ----------------------------------------------------- |
| `id`         | string                | `${projectId}::${path}` for uniqueness                |
| `projectId`  | string                | Indexed — fast per-project lookup                     |
| `path`       | string                | Slash-separated, no leading slash, no wrapper folder  |
| `name`       | string                | Last path segment                                     |
| `parentPath` | string                | Parent path, "" at root                                |
| `type`       | `"file"`              | Reserved for future types                             |
| `size`       | number                | Bytes                                                 |
| `kind`       | enum                  | `text` / `json` / `markdown` / `image` / `binary` / `unknown` |
| `content`   | string \| Blob        | String for text, Blob for binary                      |
| `extension`  | string                | Lower-case, no dot                                    |
| `importedAt` | ISO string            |                                                       |

Indexed by `projectId` and `path`.

## What's NOT in this phase (intentionally)

Future phases will add:
- Folder import (next small update after ZIP)
- GitHub repository import
- Code Workspace (Monaco editor, file editing, save)
- WebContainers runtime + npm install + live preview
- Framer-style visual editor
- Lilith (AI assistant)
- Trading / Treasury / business tools
- Project export

Until those features are real, the interface intentionally does not show buttons or placeholders for them.

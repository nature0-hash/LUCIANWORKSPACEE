# Lucian Workspace

A clean, themeable workspace foundation built with Next.js 16, React 19 and Tailwind CSS v4.

This is **Phase 2 — Navigation & UI Foundation**. The shell is in place; future phases will add the Project Library, code editor, visual editor and other modules.

## What's in Phase 2

- **Branding** — official Lucian Workspace emblem + wordmark, served from `/public/branding/`. App favicon wired through Next.js App Router conventions.
- **Collapsible sidebar** — desktop sidebar collapses to an icon rail (persisted to `localStorage`); mobile drawer slides over content with backdrop, Escape-to-close and scroll lock.
- **Internal navigation** — Next.js App Router with a route group `(app)` that wraps every page in the shared `AppShell`. Navigating between pages swaps only the main content; the shell (top nav, sidebar, settings) stays mounted.
- **Two pages** — `/` (Home, intentionally minimal) and `/projects` (clean empty state, ready for Phase 3's Project Library).
- **Reusable UI primitives** — `Button`, `Card`, `EmptyState`, `PageHeader`, `PageShell`, `NavList`, `Tooltip`, `IconButton`, `Avatar`.
- **Theme system preserved** — 10 background themes × 8 accent colors, switched live, persisted to `localStorage`, applied before paint via an inline bootstrap script (no FOUC).
- **Cross-tab sync** — change the theme in one tab and every other tab updates.
- **Accessibility** — focus rings, ARIA on icon-only buttons, Escape closes modals/drawers, tooltips on collapsed-sidebar icons, body scroll lock when overlays open.

## Tech stack

- Next.js 16.2.6 (App Router, Turbopack)
- React 19.2.6
- Tailwind CSS 4.1.17 (CSS-variable design tokens via `@theme inline`)
- TypeScript 5.9.3 (strict)
- lucide-react for icons

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
      projects/page.tsx              # Projects (/projects)
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
    settings/
      SettingsModal.tsx              # settings dialog (Escape + scroll lock + focus)
      GeneralSettings.tsx            # theme + accent pickers
    theme/
      ThemeProvider.tsx              # theme + accent context, localStorage sync
    ui/
      Avatar.tsx                     # accent-tinted avatar disc
      Button.tsx                     # primary / secondary / ghost button
      Card.tsx                       # generic surface card
      EmptyState.tsx                 # empty-state layout
      IconButton.tsx                 # compact square icon button
      NavList.tsx                    # vertical nav list (expanded + collapsed modes)
      PageHeader.tsx                 # page title + description + actions
      PageShell.tsx                  # page padding/width wrapper
      Tooltip.tsx                    # lightweight tooltip (hover + focus)
  lib/
    themes.ts                        # theme + accent definitions, storage keys
```

## What's NOT in this phase (intentionally)

Phase 3 and beyond will add:
- Project Library (ZIP / folder / GitHub import)
- Project scanner + framework detection
- WebContainers runtime
- Code editor
- Framer-style visual editor
- Lilith (AI assistant)
- Trading / Treasury / business tools

Until those features are real, the interface intentionally shows empty space rather than placeholder content.

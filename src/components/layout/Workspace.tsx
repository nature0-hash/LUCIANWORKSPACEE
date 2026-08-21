"use client";

import {
  ArrowUpRight,
  BookOpen,
  GitBranch,
  LayoutTemplate,
  ListTodo,
  PenLine,
  Rocket,
  Send,
  Sparkle,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";

const ACTIONS = [
  { icon: Rocket, label: "New project" },
  { icon: GitBranch, label: "Import" },
  { icon: LayoutTemplate, label: "Templates" },
  { icon: ListTodo, label: "Tasks" },
] as const;

const FEED_CARDS = [
  {
    icon: Sparkle,
    title: "Theme engine online",
    body: "Background themes and accent colors now apply live across the entire shell — try Settings → General.",
    meta: "System · just now",
  },
  {
    icon: BookOpen,
    title: "Workspace foundations",
    body: "This layout is a modular shell: top navigation, sidebar, workspace and side panel are all reusable components.",
    meta: "Docs · 2h ago",
  },
  {
    icon: GitBranch,
    title: "Ready for new modules",
    body: "Panels, feeds and tools can be slotted into this grid without changing the surrounding structure.",
    meta: "Platform · 1d ago",
  },
  {
    icon: Rocket,
    title: "Deploy anywhere",
    body: "The project builds cleanly with Next.js App Router and deploys directly to Vercel with zero configuration.",
    meta: "Infra · 3d ago",
  },
] as const;

export function Workspace() {
  return (
    <div className="space-y-5">
      {/* Page heading */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold tracking-tight text-fg">Home</h2>
        <span className="themed hidden rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-fg-muted sm:block">
          Personal workspace
        </span>
      </div>

      {/* Composer */}
      <section className="themed rounded-lg border border-line bg-surface shadow-sm">
        <div className="flex items-start gap-3 p-3.5">
          <Avatar size={32} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="focus-within:outline-2 focus-within:outline-accent themed flex items-center gap-2 rounded-md border border-line bg-inset px-3 outline-offset-[-1px] transition-colors">
              <PenLine size={14} className="shrink-0 text-fg-faint" />
              <input
                type="text"
                placeholder="Ask, search or start something new…"
                className="h-9.5 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-faint"
              />
              <button
                type="button"
                aria-label="Submit"
                className="focus-ring themed my-1.5 inline-flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded bg-accent text-accent-fg transition-colors hover:bg-accent-hover active:bg-accent-active"
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="themed flex flex-wrap items-center gap-2 border-t border-line-muted px-3.5 py-2.5">
          {ACTIONS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              type="button"
              className="focus-ring themed inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1 text-[13px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg active:bg-active"
            >
              <Icon size={13.5} className="text-fg-faint" />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="focus-ring themed ml-auto inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[13px] font-medium text-accent-fg transition-colors hover:bg-accent-hover active:bg-accent-active"
          >
            <Rocket size={13.5} />
            Get started
          </button>
        </div>
      </section>

      {/* Feed cards */}
      <section aria-label="Recent activity" className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-faint">
          Recent activity
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEED_CARDS.map(({ icon: Icon, title, body, meta }) => (
            <article
              key={title}
              className="themed group rounded-lg border border-line bg-surface p-4 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="themed flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-accent">
                  <Icon size={14} />
                </span>
                <ArrowUpRight
                  size={14}
                  className="text-fg-faint opacity-0 transition-opacity group-hover:opacity-100"
                />
              </div>
              <h4 className="mt-3 text-sm font-semibold text-fg">{title}</h4>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">
                {body}
              </p>
              <p className="mt-3 text-xs text-fg-faint">{meta}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Empty slot panel */}
      <section className="themed flex min-h-28 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2/40 p-6 text-center">
        <p className="max-w-sm text-[13px] leading-relaxed text-fg-faint">
          Open canvas — future modules, feeds and tools dock here without
          changing the surrounding shell.
        </p>
      </section>
    </div>
  );
}

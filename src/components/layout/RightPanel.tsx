"use client";

import { ArrowRight, Megaphone, TrendingUp } from "lucide-react";

const CHANGES = [
  { title: "Composer polish & focus states", when: "Today" },
  { title: "Accent-aware focus rings", when: "Yesterday" },
  { title: "Ten background themes shipped", when: "2 days ago" },
] as const;

const TRENDING = [
  { name: "shell / command-palette", tag: "UI" },
  { name: "tokens / palette-studio", tag: "Design" },
  { name: "edge / realtime-sync", tag: "Infra" },
] as const;

export function RightPanel() {
  return (
    <div className="sticky top-0 space-y-4">
      {/* Latest changes */}
      <section className="themed rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-accent" />
          <h3 className="text-sm font-semibold text-fg">Latest changes</h3>
        </div>
        <ul className="mt-3 space-y-0">
          {CHANGES.map((change, i) => (
            <li key={change.title} className="relative pl-4">
              {/* timeline rail */}
              {i < CHANGES.length - 1 && (
                <span className="absolute left-[3px] top-3 h-full w-px bg-line-muted" />
              )}
              <span className="absolute left-0 top-1.5 h-[7px] w-[7px] rounded-full border border-line bg-surface-2" />
              <div className="pb-3.5">
                <p className="text-[13px] leading-snug text-fg">
                  {change.title}
                </p>
                <p className="mt-0.5 text-xs text-fg-faint">{change.when}</p>
              </div>
            </li>
          ))}
        </ul>
        <a
          href="#"
          className="focus-ring themed inline-flex items-center gap-1 rounded text-[13px] font-medium text-accent hover:underline"
        >
          View changelog
          <ArrowRight size={13} />
        </a>
      </section>

      {/* Trending */}
      <section className="themed rounded-lg border border-line bg-surface p-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-accent" />
          <h3 className="text-sm font-semibold text-fg">Trending modules</h3>
        </div>
        <ul className="mt-2">
          {TRENDING.map((item) => (
            <li key={item.name}>
              <a
                href="#"
                className="focus-ring themed -mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-hover"
              >
                <span className="truncate text-[13px] text-fg">
                  {item.name}
                </span>
                <span className="themed shrink-0 rounded-full border border-line px-1.5 text-[10px] leading-4 text-fg-muted">
                  {item.tag}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* Neutral placeholder */}
      <section className="themed rounded-lg border border-dashed border-line bg-surface-2/40 p-4">
        <p className="text-xs leading-relaxed text-fg-faint">
          Side panel slot — notifications, insights or contextual tools can
          live here.
        </p>
      </section>
    </div>
  );
}

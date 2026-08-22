"use client";

import { useState, useEffect, useCallback } from "react";
import { BookOpen, ArrowLeft, Clock, CheckCircle2 } from "lucide-react";
import { KNOWLEDGE_ITEMS, KNOWLEDGE_CATEGORIES, type KnowledgeItem, type KnowledgeProgress } from "@/lib/knowledge-data";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { Textarea } from "@/components/ui-devspace/textarea";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-knowledge-progress";

function loadProgress(): Record<string, KnowledgeProgress> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveProgress(p: Record<string, KnowledgeProgress>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export default function KnowledgeLibraryPage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [progress, setProgress] = useState<Record<string, KnowledgeProgress>>({});
  const [category, setCategory] = useState<string>("all");
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setItems(KNOWLEDGE_ITEMS);
      setProgress(loadProgress());
    });
    return () => { cancelled = true; };
  }, []);

  const updateProgress = useCallback((id: string, patch: Partial<KnowledgeProgress>) => {
    setProgress(prev => {
      const existing = prev[id] || { status: "reading", progress: 0, notes: "", highlights: "", quotes: "" };
      const next = { ...existing, ...patch };
      const all = { ...prev, [id]: next };
      saveProgress(all);
      return all;
    });
  }, []);

  const filtered = category === "all" ? items : items.filter(i => i.category === category);
  const completedCount = Object.values(progress).filter(p => p.status === "read").length;

  if (selected) {
    return (
      <ReaderView
        item={selected}
        progress={progress[selected.id]}
        onBack={() => setSelected(null)}
        onUpdate={(patch) => updateProgress(selected.id, patch)}
      />
    );
  }

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-accent" />
          <h1 className="text-base font-semibold">Knowledge Library</h1>
        </div>
        <span className="text-[11px] text-fg-faint">{completedCount} / {items.length} completed</span>
      </div>
      <div className="mb-3 flex gap-1">
        <CatBtn active={category === "all"} onClick={() => setCategory("all")} label="All" />
        {KNOWLEDGE_CATEGORIES.map(c => (
          <CatBtn key={c.id} active={category === c.id} onClick={() => setCategory(c.id)} label={c.label} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(item => {
          const p = progress[item.id];
          const isRead = p?.status === "read";
          return (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="themed focus-ring rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-fg">{item.title}</p>
                  <p className="mt-0.5 text-[10px] text-fg-faint">by {item.author}</p>
                </div>
                {isRead && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-fg-muted">{item.summary}</p>
              <div className="mt-2 flex items-center gap-2 text-[9px] text-fg-faint">
                <span className="rounded bg-surface-2 px-1 py-0.5">{item.category}</span>
                <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{item.estimatedMinutes}m</span>
              </div>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

function ReaderView({ item, progress, onBack, onUpdate }: {
  item: KnowledgeItem;
  progress?: KnowledgeProgress;
  onBack: () => void;
  onUpdate: (patch: Partial<KnowledgeProgress>) => void;
}) {
  const p = progress || { status: "reading", progress: 0, notes: "", highlights: "", quotes: "" };
  return (
    <div className="themed h-full overflow-y-auto bg-canvas px-6 py-4 text-fg">
      <button onClick={onBack} className="focus-ring themed mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
        <ArrowLeft className="h-3 w-3" /> Back to Library
      </button>
      <h1 className="text-lg font-semibold">{item.title}</h1>
      <p className="mt-0.5 text-xs text-fg-muted">by {item.author} · {item.estimatedMinutes} min read</p>
      <div className="mt-3 rounded-md border border-accent/20 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Key Ideas</p>
        <ul className="mt-1 space-y-0.5">
          {item.keyIdeas.map((idea, i) => (
            <li key={i} className="text-[11px] text-fg-muted">• {idea}</li>
          ))}
        </ul>
      </div>
      <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-fg-muted">{item.content}</div>
      <div className="mt-4 space-y-2 border-t border-line-muted pt-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Notes</p>
        <Textarea value={p.notes || ""} onChange={e => onUpdate({ notes: e.target.value })} placeholder="Write your notes…" className="min-h-[60px] text-xs" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Highlights</p>
        <Textarea value={p.highlights || ""} onChange={e => onUpdate({ highlights: e.target.value })} placeholder="Key highlights…" className="min-h-[60px] text-xs" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Quotes</p>
        <Textarea value={p.quotes || ""} onChange={e => onUpdate({ quotes: e.target.value })} placeholder="Notable quotes…" className="min-h-[60px] text-xs" />
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant={p.status === "read" ? "default" : "outline"} onClick={() => onUpdate({ status: p.status === "read" ? "reading" : "read" })}>
            {p.status === "read" ? "✓ Read" : "Mark as read"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CatBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className={cn("rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors", active ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}>
      {label}
    </button>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen, ArrowLeft, Clock, CheckCircle2, Search, Plus,
  Highlighter, Bookmark, X, ChevronRight, FileText, Star,
} from "lucide-react";
import { KNOWLEDGE_ITEMS, KNOWLEDGE_CATEGORIES, type KnowledgeItem, type KnowledgeProgress } from "@/lib/knowledge-data";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "lucian-knowledge-progress";

function loadProgress(): Record<string, KnowledgeProgress> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveProgress(p: Record<string, KnowledgeProgress>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

type View = "home" | "reading";

export default function KnowledgeLibraryPage() {
  const [progress, setProgress] = useState<Record<string, KnowledgeProgress>>({});
  const [category, setCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [view, setView] = useState<View>("home");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setProgress(loadProgress()); });
    return () => { cancelled = true; };
  }, []);

  const updateProgress = useCallback((id: string, patch: Partial<KnowledgeProgress>) => {
    setProgress(prev => {
      const existing = prev[id] ?? { status: "reading" as const, progress: 0, notes: "", highlights: "", quotes: "" };
      const next = { ...prev, [id]: { ...existing, ...patch } };
      saveProgress(next);
      return next;
    });
  }, []);

  const openItem = (item: KnowledgeItem) => {
    setSelectedItem(item);
    setView("reading");
  };

  const backToLibrary = () => {
    setSelectedItem(null);
    setView("home");
  };

  const filteredItems = useMemo(() => {
    let list = KNOWLEDGE_ITEMS;
    if (category !== "all") list = list.filter(i => i.category === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q));
    }
    return list;
  }, [category, search]);

  const continueReading = useMemo(() =>
    KNOWLEDGE_ITEMS.filter(i => progress[i.id]?.status === "reading" && (progress[i.id]?.progress ?? 0) > 0)
      .sort((a, b) => (progress[b.id]?.progress ?? 0) - (progress[a.id]?.progress ?? 0)).slice(0, 4),
  [progress]);

  if (view === "reading" && selectedItem) {
    return <ReadingView item={selectedItem} progress={progress[selectedItem.id]} onProgress={updateProgress} onBack={backToLibrary} />;
  }

  return (
    <div className="themed flex h-full min-h-0 bg-canvas text-fg">
      {/* Left sidebar */}
      <aside className="hidden w-[200px] shrink-0 flex-col border-r border-line-muted bg-surface-2/40 lg:flex">
        <div className="shrink-0 px-3 py-3">
          <h2 className="text-[12px] font-semibold text-fg">Library</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <SidebarItem label="Home" icon={BookOpen} active={category === "all"} onClick={() => setCategory("all")} />
          <SidebarItem label="All Library" icon={FileText} active={false} onClick={() => setCategory("all")} />
          <div className="my-1 h-px bg-line-muted/60" />
          {KNOWLEDGE_CATEGORIES.map(cat => (
            <SidebarItem key={cat.id} label={cat.label} icon={BookOpen} active={category === cat.id} onClick={() => setCategory(cat.id)} />
          ))}
          <div className="my-1 h-px bg-line-muted/60" />
          <SidebarItem label="Highlights" icon={Highlighter} active={false} onClick={() => toast({ title: "Highlights" })} />
          <SidebarItem label="Notes" icon={FileText} active={false} onClick={() => toast({ title: "Notes" })} />
        </div>
        <div className="shrink-0 border-t border-line-muted p-2">
          <button onClick={() => toast({ title: "Add Material", description: "PDF/text import coming soon." })}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-fg-muted hover:bg-hover hover:text-fg">
            <Plus className="h-3.5 w-3.5" /> Add Material
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl p-4 sm:p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-[16px] font-semibold text-fg">Knowledge Library</h1>
              <p className="mt-0.5 text-[11px] text-fg-muted">Your personal intellectual library</p>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                className="rounded-md border border-line bg-surface py-1.5 pl-7 pr-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </div>
          </div>

          {/* Continue Reading */}
          {continueReading.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">Continue Reading</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {continueReading.map(item => (
                  <button key={item.id} onClick={() => openItem(item)}
                    className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint">
                    <p className="truncate text-[12px] font-medium text-fg">{item.title}</p>
                    <p className="mt-0.5 truncate text-[9px] text-fg-faint">{item.author}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full bg-[var(--accent)]" style={{ width: `${progress[item.id]?.progress ?? 0}%` }} />
                      </div>
                      <span className="text-[9px] text-fg-faint">{progress[item.id]?.progress ?? 0}%</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category items */}
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-faint">
            {category === "all" ? "All Library" : KNOWLEDGE_CATEGORIES.find(c => c.id === category)?.label}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(item => {
              const p = progress[item.id];
              const isRead = p?.status === "read";
              return (
                <button key={item.id} onClick={() => openItem(item)}
                  className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-fg">{item.title}</p>
                      <p className="truncate text-[9px] text-fg-faint">{item.author}</p>
                    </div>
                    {isRead && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] text-fg-muted">{item.summary}</p>
                  <div className="mt-2 flex items-center gap-2 text-[9px] text-fg-faint">
                    <span className="capitalize">{item.category}</span>
                    <span>·</span>
                    <span>{item.estimatedMinutes} min</span>
                    {p && p.progress > 0 && <><span>·</span><span>{p.progress}%</span></>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, icon: Icon, active, onClick }: { label: string; icon: typeof BookOpen; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
        active ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function ReadingView({ item, progress, onProgress, onBack }: {
  item: KnowledgeItem;
  progress?: KnowledgeProgress;
  onProgress: (id: string, patch: Partial<KnowledgeProgress>) => void;
  onBack: () => void;
}) {
  const [scrollProgress, setScrollProgress] = useState(progress?.progress ?? 0);
  const [fontSize, setFontSize] = useState(14);
  const [notes, setNotes] = useState(progress?.notes ?? "");
  const [highlights, setHighlights] = useState(progress?.highlights ?? "");
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.round((el.scrollTop / max) * 100) : 0;
    setScrollProgress(pct);
    const status = pct >= 95 ? "read" as const : "reading" as const;
    onProgress(item.id, { progress: pct, status, notes, highlights });
  }, [item.id, notes, highlights, onProgress]);

  return (
    <div className="themed flex h-full min-h-0 bg-canvas text-fg">
      {/* Reading area */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="shrink-0 flex items-center justify-between border-b border-line-muted px-4 py-2">
          <button onClick={onBack} className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" /> Library
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">A−</button>
            <span className="text-[10px] text-fg-faint">{fontSize}px</span>
            <button onClick={() => setFontSize(f => Math.min(20, f + 1))} className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">A+</button>
            <div className="h-3 w-px bg-line-muted" />
            <span className="text-[10px] text-fg-faint">{scrollProgress}%</span>
          </div>
        </div>
        {/* Content */}
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            <h1 className="text-[20px] font-bold text-fg">{item.title}</h1>
            <p className="mt-1 text-[12px] text-fg-muted">By {item.author}</p>
            <div className="mt-4 whitespace-pre-wrap text-fg" style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}>{item.content}</div>
            {/* Key ideas */}
            <div className="mt-8 rounded-md border border-line bg-surface p-4">
              <h3 className="mb-2 text-[12px] font-semibold text-fg">Key Ideas</h3>
              <ul className="space-y-1">
                {item.keyIdeas.map((idea, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-fg-muted">
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--accent)]" /> {idea}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* Notebook sidebar */}
      <aside className="hidden w-[200px] shrink-0 flex-col border-l border-line-muted bg-surface-2/40 lg:flex">
        <div className="shrink-0 border-b border-line-muted px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Notebook</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          <div>
            <label className="text-[10px] font-medium text-fg-muted">Notes</label>
            <textarea value={notes} onChange={e => { setNotes(e.target.value); onProgress(item.id, { notes: e.target.value }); }}
              placeholder="Write notes..." rows={4}
              className="mt-1 w-full resize-none rounded border border-line bg-surface p-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
          </div>
          <div>
            <label className="text-[10px] font-medium text-fg-muted">Highlights</label>
            <textarea value={highlights} onChange={e => { setHighlights(e.target.value); onProgress(item.id, { highlights: e.target.value }); }}
              placeholder="Save important passages..." rows={4}
              className="mt-1 w-full resize-none rounded border border-line bg-surface p-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
          </div>
        </div>
      </aside>
    </div>
  );
}

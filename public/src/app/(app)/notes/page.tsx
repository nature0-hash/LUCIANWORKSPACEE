"use client";

import { useState, useCallback } from "react";
import { FileText, Plus, Trash2, Pin, Archive, Search, Folder as FolderIcon } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Textarea } from "@/components/ui-devspace/textarea";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-notes";

type NoteType = "note" | "idea" | "book" | "goal";

interface Note {
  id: string; title: string; content: string; type: NoteType;
  tags: string[]; pinned: boolean; archived: boolean;
  folderId: string | null; createdAt: number; updatedAt: number;
}

function load(): Note[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function save(notes: Note[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

const TYPE_META: Record<NoteType, { label: string; color: string }> = {
  note: { label: "Note", color: "bg-blue-500/15 text-blue-500" },
  idea: { label: "Idea", color: "bg-purple-500/15 text-purple-500" },
  book: { label: "Book", color: "bg-amber-500/15 text-amber-500" },
  goal: { label: "Goal", color: "bg-green-500/15 text-green-500" },
};

const FILTERS = [
  { id: "all" as const, label: "All" },
  { id: "note" as const, label: "Notes" },
  { id: "idea" as const, label: "Ideas" },
  { id: "book" as const, label: "Books" },
  { id: "goal" as const, label: "Goals" },
  { id: "pinned" as const, label: "Pinned" },
  { id: "archived" as const, label: "Archive" },
];

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(() => load());
  const [filter, setFilter] = useState<"all" | NoteType | "pinned" | "archived">("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);


  const update = useCallback((next: Note[]) => { setNotes(next); save(next); }, []);

  const filtered = notes.filter(n => {
    if (filter === "pinned") return n.pinned && !n.archived;
    if (filter === "archived") return n.archived;
    if (filter === "all") return !n.archived;
    return n.type === filter && !n.archived;
  }).filter(n => !search.trim() || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.toLowerCase().includes(search.toLowerCase()));

  const selected = notes.find(n => n.id === selectedId);
  const updateNote = (id: string, patch: Partial<Note>) => update(notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n));

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-5 w-5 text-accent" />
        <h1 className="text-base font-semibold">Lucian Notes</h1>
      </div>

      <div className="flex h-[calc(100vh-200px)] gap-3">
        {/* Left: filters */}
        <div className="w-36 shrink-0 space-y-0.5">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)} className={cn("w-full rounded px-2 py-1 text-left text-[11px] font-medium transition-colors", filter === f.id ? "bg-active text-fg" : "text-fg-muted hover:bg-hover")}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Middle: note list */}
        <div className="w-64 shrink-0 space-y-1 overflow-y-auto">
          <div className="mb-1 flex gap-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-fg-faint" />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…" className="focus-ring themed h-6 w-full rounded border border-line bg-inset pl-6 pr-2 text-[11px] text-fg" />
            </div>
            <Button size="sm" className="h-6 w-6 p-0" onClick={() => {
              const n: Note = { id: `note_${Date.now()}`, title: "", content: "", type: "note", tags: [], pinned: false, archived: false, folderId: null, createdAt: Date.now(), updatedAt: Date.now() };
              update([n, ...notes]); setSelectedId(n.id);
            }}><Plus className="h-3 w-3" /></Button>
          </div>
          {filtered.map(n => (
            <button key={n.id} onClick={() => setSelectedId(n.id)} className={cn("w-full rounded-md border px-2 py-1.5 text-left transition-colors", selectedId === n.id ? "border-accent bg-active" : "border-line bg-surface hover:border-fg-faint")}>
              <div className="flex items-center gap-1">
                {n.pinned && <Pin className="h-2.5 w-2.5 text-accent" />}
                <span className={cn("shrink-0 rounded px-1 text-[8px] font-bold", TYPE_META[n.type].color)}>{TYPE_META[n.type].label}</span>
              </div>
              <p className="mt-0.5 truncate text-[11px] font-medium text-fg">{n.title || "Untitled"}</p>
              <p className="truncate text-[9px] text-fg-faint">{n.content.slice(0, 50) || "No content"}</p>
            </button>
          ))}
        </div>

        {/* Right: editor */}
        <div className="min-w-0 flex-1">
          {selected ? (
            <div className="flex h-full flex-col rounded-md border border-line bg-surface p-3">
              <div className="flex items-center gap-2 border-b border-line-muted pb-2">
                <div className="flex gap-0.5">
                  {(Object.keys(TYPE_META) as NoteType[]).map(t => (
                    <button key={t} onClick={() => updateNote(selected.id, { type: t })} className={cn("rounded px-1.5 py-0.5 text-[9px] font-medium", selected.type === t ? TYPE_META[t].color : "text-fg-faint hover:bg-hover")}>
                      {TYPE_META[t].label}
                    </button>
                  ))}
                </div>
                <button onClick={() => updateNote(selected.id, { pinned: !selected.pinned })} className={cn("ml-auto", selected.pinned ? "text-accent" : "text-fg-faint hover:text-fg")}>
                  <Pin className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => updateNote(selected.id, { archived: !selected.archived })} className="text-fg-faint hover:text-fg">
                  <Archive className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { update(notes.filter(n => n.id !== selected.id)); setSelectedId(null); toast({ title: "Note deleted" }); }} className="text-fg-faint hover:text-red-500">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <input value={selected.title} onChange={e => updateNote(selected.id, { title: e.target.value })} placeholder="Title…" className="mt-2 bg-transparent text-sm font-semibold text-fg outline-none" />
              <Textarea value={selected.content} onChange={e => updateNote(selected.id, { content: e.target.value })} placeholder="Write…" className="mt-2 flex-1 resize-none border-0 bg-transparent text-xs text-fg-muted focus:outline-none" />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-line-muted">
              <p className="text-xs text-fg-faint">Select a note or create a new one.</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}

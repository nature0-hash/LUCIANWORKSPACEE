"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Trash2, Search, X, ChevronRight, Bold, Italic, Underline,
  Strikethrough, List, ListOrdered, CheckSquare, Link2, Quote,
  Code, Minus, Heading1, Heading2, AlignLeft, AlignCenter, AlignRight,
  Undo, Redo, Bot, MoreHorizontal, Book, Folder, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/* ── Types ── */

interface Page {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}
interface Section {
  id: string;
  notebookId: string;
  name: string;
  pages: Page[];
  expanded: boolean;
}
interface Notebook {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

interface NotesData {
  notebooks: Notebook[];
  sections: Section[];
}

/* ── Persistence ── */

const STORAGE_KEY = "lucian-notes-v2";

function loadData(): NotesData {
  if (typeof window === "undefined") return { notebooks: [], sections: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  // Default: create a starter notebook + section + page
  const now = Date.now();
  return {
    notebooks: [{ id: "nb_personal", name: "Personal", color: "var(--accent)", createdAt: now }],
    sections: [{
      id: "sec_ideas", notebookId: "nb_personal", name: "Ideas", expanded: true,
      pages: [{
        id: "page_welcome", title: "Welcome to LUCIAN Notes",
        content: "<p>Start writing here. Use the toolbar above to format your text.</p><p>You can create <b>notebooks</b>, <b>sections</b>, and <b>pages</b> to organize your thoughts.</p>",
        createdAt: now, updatedAt: now,
      }],
    }],
  };
}

function saveData(data: NotesData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/* ── Page ── */

export default function NotesPage() {
  const [data, setData] = useState<NotesData>({ notebooks: [], sections: [] });
  const [activeNotebookId, setActiveNotebookId] = useState<string>("");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [activePageId, setActivePageId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<{ pageId: string; sectionId: string; notebookId: string; title: string; snippet: string }[]>([]);
  const [saveState, setSaveState] = useState<"saved" | "saving">("saved");
  const [mobileView, setMobileView] = useState<"notebooks" | "sections" | "editor">("notebooks");
  const editorRef = useRef<HTMLDivElement>(null);

  // Load on mount
  useEffect(() => {
    const loaded = loadData();
    setData(loaded);
    if (loaded.notebooks.length > 0) {
      setActiveNotebookId(loaded.notebooks[0].id);
      if (loaded.sections.length > 0) {
        setActiveSectionId(loaded.sections[0].id);
        if (loaded.sections[0].pages.length > 0) {
          setActivePageId(loaded.sections[0].pages[0].id);
        }
      }
    }
  }, []);

  // Persist on change
  const persist = useCallback((next: NotesData) => {
    setData(next);
    saveData(next);
  }, []);

  // ── Notebook actions ──
  const createNotebook = () => {
    const nb: Notebook = { id: genId("nb"), name: "New Notebook", color: "var(--accent)", createdAt: Date.now() };
    persist({ notebooks: [...data.notebooks, nb], sections: data.sections });
    setActiveNotebookId(nb.id);
    toast({ title: "Notebook created" });
  };

  const deleteNotebook = (id: string) => {
    const next = {
      notebooks: data.notebooks.filter(n => n.id !== id),
      sections: data.sections.filter(s => s.notebookId !== id),
    };
    persist(next);
    if (activeNotebookId === id && next.notebooks.length > 0) setActiveNotebookId(next.notebooks[0].id);
  };

  const renameNotebook = (id: string, name: string) => {
    persist({
      notebooks: data.notebooks.map(n => n.id === id ? { ...n, name } : n),
      sections: data.sections,
    });
  };

  // ── Section actions ──
  const createSection = (notebookId: string) => {
    const sec: Section = { id: genId("sec"), notebookId, name: "New Section", pages: [], expanded: true };
    persist({ notebooks: data.notebooks, sections: [...data.sections, sec] });
    setActiveSectionId(sec.id);
    setMobileView("sections");
  };

  const deleteSection = (id: string) => {
    persist({
      notebooks: data.notebooks,
      sections: data.sections.filter(s => s.id !== id),
    });
    if (activeSectionId === id) setActiveSectionId("");
  };

  const renameSection = (id: string, name: string) => {
    persist({
      notebooks: data.notebooks,
      sections: data.sections.map(s => s.id === id ? { ...s, name } : s),
    });
  };

  const toggleSection = (id: string) => {
    persist({
      notebooks: data.notebooks,
      sections: data.sections.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s),
    });
  };

  // ── Page actions ──
  const createPage = (sectionId: string) => {
    const page: Page = { id: genId("page"), title: "Untitled", content: "", createdAt: Date.now(), updatedAt: Date.now() };
    persist({
      notebooks: data.notebooks,
      sections: data.sections.map(s => s.id === sectionId ? { ...s, pages: [...s.pages, page] } : s),
    });
    setActivePageId(page.id);
    setMobileView("editor");
  };

  const deletePage = (sectionId: string, pageId: string) => {
    persist({
      notebooks: data.notebooks,
      sections: data.sections.map(s => s.id === sectionId ? { ...s, pages: s.pages.filter(p => p.id !== pageId) } : s),
    });
    if (activePageId === pageId) setActivePageId("");
  };

  const updatePage = (sectionId: string, pageId: string, patch: Partial<Page>) => {
    setSaveState("saving");
    persist({
      notebooks: data.notebooks,
      sections: data.sections.map(s => s.id === sectionId
        ? { ...s, pages: s.pages.map(p => p.id === pageId ? { ...p, ...patch, updatedAt: Date.now() } : p) }
        : s),
    });
    setTimeout(() => setSaveState("saved"), 500);
  };

  const updatePageContent = (sectionId: string, pageId: string, content: string) => {
    updatePage(sectionId, pageId, { content });
  };

  // ── Search ──
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const q = search.toLowerCase();
    const results: { pageId: string; sectionId: string; notebookId: string; title: string; snippet: string }[] = [];
    for (const sec of data.sections) {
      for (const page of sec.pages) {
        const titleMatch = page.title.toLowerCase().includes(q);
        const contentMatch = page.content.toLowerCase().includes(q);
        if (titleMatch || contentMatch) {
          const textContent = page.content.replace(/<[^>]+>/g, "").slice(0, 100);
          results.push({ pageId: page.id, sectionId: sec.id, notebookId: sec.notebookId, title: page.title, snippet: textContent });
        }
      }
    }
    setSearchResults(results);
  }, [search, data]);

  const activeSection = data.sections.find(s => s.id === activeSectionId);
  const activePage = activeSection?.pages.find(p => p.id === activePageId);
  const sectionsForNotebook = data.sections.filter(s => s.notebookId === activeNotebookId);

  // Load content into editor when page changes
  useEffect(() => {
    if (editorRef.current && activePage) {
      editorRef.current.innerHTML = activePage.content;
    }
  }, [activePageId]);

  return (
    <div className="themed flex h-full min-h-0 bg-canvas text-fg">
      {/* ── Column 1: Notebooks ── */}
      <aside className={cn(
        "shrink-0 flex-col border-r border-line-muted bg-surface-2/40 sm:flex sm:w-[160px]",
        mobileView === "notebooks" ? "flex absolute inset-0 z-30 w-full sm:static sm:w-[160px] sm:z-0" : "hidden sm:flex",
      )}>
        <div className="shrink-0 border-b border-line-muted px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Notebooks</span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {data.notebooks.map(nb => (
            <div key={nb.id} className="group relative">
              <button
                onClick={() => { setActiveNotebookId(nb.id); setMobileView("sections"); }}
                className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
                  activeNotebookId === nb.id ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                <Book className="h-3.5 w-3.5" style={{ color: nb.color }} />
                <span className="flex-1 truncate">{nb.name}</span>
              </button>
              {/* Delete on hover */}
              <button onClick={() => deleteNotebook(nb.id)}
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-fg-faint opacity-0 hover:text-red-400 group-hover:opacity-100">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="shrink-0 border-t border-line-muted p-1.5">
          <button onClick={createNotebook} className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-fg-muted hover:bg-hover hover:text-fg">
            <Plus className="h-3.5 w-3.5" /> Notebook
          </button>
        </div>
      </aside>

      {/* ── Column 2: Sections + Pages ── */}
      <aside className={cn(
        "shrink-0 flex-col border-r border-line-muted bg-surface-2/30 sm:flex sm:w-[200px]",
        mobileView === "sections" ? "flex absolute inset-0 z-30 w-full sm:static sm:w-[200px] sm:z-0" : "hidden sm:flex",
      )}>
        {/* Search */}
        <div className="shrink-0 border-b border-line-muted p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full rounded border border-line bg-surface py-1 pl-7 pr-2 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
        </div>

        {/* Search results */}
        {search.trim() && searchResults.length > 0 ? (
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            <p className="px-2 py-1 text-[9px] uppercase text-fg-faint">Results</p>
            {searchResults.map(r => (
              <button key={r.pageId} onClick={() => {
                setActiveNotebookId(r.notebookId);
                setActiveSectionId(r.sectionId);
                setActivePageId(r.pageId);
                setMobileView("editor");
                setSearch("");
              }}
                className="flex w-full flex-col rounded-md px-2 py-1.5 text-left hover:bg-hover">
                <span className="truncate text-[11px] font-medium text-fg">{r.title}</span>
                <span className="truncate text-[9px] text-fg-faint">{r.snippet}</span>
              </button>
            ))}
          </div>
        ) : search.trim() ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-[11px] text-fg-faint">No results found</div>
        ) : (
          <>
            {/* Sections */}
            <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
              {sectionsForNotebook.map(sec => (
                <div key={sec.id} className="mb-1">
                  <div className="group relative flex items-center">
                    <button onClick={() => { toggleSection(sec.id); setActiveSectionId(sec.id); }}
                      className="flex flex-1 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-fg-muted hover:bg-hover hover:text-fg">
                      <ChevronRight className={cn("h-3 w-3 transition-transform", sec.expanded && "rotate-90")} />
                      <Folder className="h-3.5 w-3.5" />
                      <span className="flex-1 truncate">{sec.name}</span>
                    </button>
                    <button onClick={() => deleteSection(sec.id)}
                      className="rounded p-0.5 text-fg-faint opacity-0 hover:text-red-400 group-hover:opacity-100">
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  {sec.expanded && sec.pages.map(page => (
                    <button key={page.id}
                      onClick={() => { setActiveSectionId(sec.id); setActivePageId(page.id); setMobileView("editor"); }}
                      className={cn("flex w-full items-center gap-1.5 rounded-md py-1 pl-8 pr-2 text-left text-[11px] transition-colors",
                        activePageId === page.id ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="flex-1 truncate">{page.title || "Untitled"}</span>
                    </button>
                  ))}
                  {sec.expanded && (
                    <button onClick={() => createPage(sec.id)}
                      className="flex w-full items-center gap-1.5 rounded-md py-1 pl-8 pr-2 text-left text-[10px] text-fg-faint hover:text-fg">
                      <Plus className="h-3 w-3" /> Page
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* Add section */}
            <div className="shrink-0 border-t border-line-muted p-1.5">
              <button onClick={() => createSection(activeNotebookId)}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] text-fg-muted hover:bg-hover hover:text-fg">
                <Plus className="h-3.5 w-3.5" /> Section
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ── Column 3: Editor ── */}
      <div className={cn(
        "min-h-0 min-w-0 flex-1 flex-col",
        mobileView === "editor" ? "flex" : "hidden sm:flex",
      )}>
        {activePage ? (
          <>
            {/* Mobile back */}
            <button onClick={() => setMobileView("sections")}
              className="flex items-center gap-1 border-b border-line-muted px-3 py-1.5 text-[11px] text-fg-muted hover:text-fg sm:hidden">
              <ChevronRight className="h-3 w-3 rotate-180" /> Sections
            </button>

            {/* Editor toolbar */}
            <EditorToolbar
              onSave={() => {
                if (editorRef.current && activeSectionId && activePageId) {
                  updatePageContent(activeSectionId, activePageId, editorRef.current.innerHTML);
                }
              }}
              saveState={saveState}
              onAskLilith={() => toast({ title: "Ask Lilith", description: "Selected text will be sent as context." })}
            />

            {/* Title */}
            <input
              value={activePage.title}
              onChange={e => {
                if (activeSectionId && activePageId) {
                  updatePage(activeSectionId, activePageId, { title: e.target.value });
                }
              }}
              placeholder="Page title"
              className="shrink-0 border-b border-line-muted bg-transparent px-6 py-3 text-[18px] font-semibold text-fg focus:outline-none"
            />

            {/* Content editable */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => {
                  if (editorRef.current && activeSectionId && activePageId) {
                    updatePageContent(activeSectionId, activePageId, editorRef.current.innerHTML);
                  }
                }}
                className="lucian-notes-editor mx-auto max-w-3xl px-6 py-4 text-[14px] leading-relaxed text-fg focus:outline-none"
                style={{ minHeight: "100%" }}
              />
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FileText className="h-10 w-10 text-fg-faint opacity-30" />
            <p className="mt-2 text-[13px] font-medium text-fg-muted">No page selected</p>
            <p className="mt-1 text-[11px] text-fg-faint">Select a page or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Editor Toolbar ── */

function EditorToolbar({ onSave, saveState, onAskLilith }: { onSave: () => void; saveState: "saved" | "saving"; onAskLilith: () => void }) {
  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    onSave();
  };

  const Btn = ({ icon: Icon, cmd, val, title }: { icon: typeof Bold; cmd: string; val?: string; title: string }) => (
    <button onClick={() => exec(cmd, val)} title={title}
      className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
      <Icon className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <div className="shrink-0 border-b border-line-muted bg-surface">
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1">
        <Btn icon={Bold} cmd="bold" title="Bold" />
        <Btn icon={Italic} cmd="italic" title="Italic" />
        <Btn icon={Underline} cmd="underline" title="Underline" />
        <Btn icon={Strikethrough} cmd="strikeThrough" title="Strikethrough" />
        <Divider />
        <Btn icon={Heading1} cmd="formatBlock" val="h1" title="Heading 1" />
        <Btn icon={Heading2} cmd="formatBlock" val="h2" title="Heading 2" />
        <Btn icon={Quote} cmd="formatBlock" val="blockquote" title="Quote" />
        <Btn icon={Code} cmd="formatBlock" val="pre" title="Code Block" />
        <Divider />
        <Btn icon={List} cmd="insertUnorderedList" title="Bullet List" />
        <Btn icon={ListOrdered} cmd="insertOrderedList" title="Numbered List" />
        <Btn icon={CheckSquare} cmd="insertCheckbox" title="Checklist" />
        <Divider />
        <Btn icon={AlignLeft} cmd="justifyLeft" title="Align Left" />
        <Btn icon={AlignCenter} cmd="justifyCenter" title="Align Center" />
        <Btn icon={AlignRight} cmd="justifyRight" title="Align Right" />
        <Divider />
        <button onClick={() => { const url = window.prompt("Enter URL:"); if (url) exec("createLink", url); }} title="Link"
          className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
          <Link2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => exec("insertHorizontalRule")} title="Divider"
          className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <Divider />
        <button onClick={() => exec("undo")} title="Undo"
          className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
          <Undo className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => exec("redo")} title="Redo"
          className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg">
          <Redo className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1" />
        {/* Save state */}
        <span className="text-[9px] text-fg-faint">
          {saveState === "saving" ? "Saving..." : "Saved"}
        </span>
        {/* Ask Lilith */}
        <button onClick={onAskLilith} title="Ask Lilith"
          className="flex items-center gap-1 rounded border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-2 py-0.5 text-[10px] text-[var(--accent)]">
          <Bot className="h-3 w-3" /> Ask Lilith
        </button>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-0.5 h-5 w-px bg-line-muted" />;
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronRight, X } from "lucide-react";
import { globalSearch, type SearchGroup } from "@/lib/search/global-search";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function GlobalSearchOverlay({ open, onClose, initialQuery }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchGroup[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery ?? "");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, initialQuery]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); setSelectedIdx(0); return; }
    const timer = setTimeout(() => {
      setResults(globalSearch(query));
      setSelectedIdx(0);
    }, 150);
    return () => clearTimeout(timer);
  }, [query]);

  const openResult = useCallback((result: { deepLink?: string }) => {
    if (result.deepLink) {
      if (result.deepLink.startsWith("http")) window.open(result.deepLink, "_blank");
      else router.push(result.deepLink);
    }
    onClose();
  }, [router, onClose]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    const total = results.reduce((s, g) => s + g.results.length, 0);
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, total - 1)); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const flat = results.flatMap(g => g.results);
      if (flat[selectedIdx]) openResult(flat[selectedIdx]);
    }
  }, [results, selectedIdx, onClose, openResult]);

  if (!open) return null;

  const totalResults = results.reduce((s, g) => s + g.results.length, 0);
  let flatIdx = 0;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[10vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="themed relative w-full max-w-2xl overflow-hidden rounded-lg border border-line bg-surface shadow-pop" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="flex items-center gap-2 border-b border-line-muted px-4 py-3">
          <Search className="h-4 w-4 text-fg-faint" />
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="Search anything in LUCIAN..." className="flex-1 bg-transparent text-[14px] text-fg placeholder:text-fg-faint focus:outline-none" />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[9px] text-fg-faint">ESC</kbd>
          <button onClick={onClose} className="text-fg-faint hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim() && totalResults === 0 ? (
            <div className="py-8 text-center text-[12px] text-fg-faint">No results for &quot;{query}&quot;</div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-fg-faint">Start typing to search LUCIAN...</div>
          ) : (
            <div className="py-1">
              {results.map((group) => (
                <div key={group.module}>
                  <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-fg-faint">{group.moduleLabel}</div>
                  {group.results.map((result) => {
                    const idx = flatIdx++;
                    return (
                      <button key={result.id} onClick={() => openResult(result)}
                        className={cn("flex w-full items-center gap-3 px-3 py-2 text-left transition-colors", idx === selectedIdx ? "bg-active" : "hover:bg-hover")}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-fg">{result.title}</p>
                          {result.snippet && <p className="truncate text-[10px] text-fg-faint">{result.snippet}</p>}
                        </div>
                        <ChevronRight className="h-3 w-3 shrink-0 text-fg-faint" />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

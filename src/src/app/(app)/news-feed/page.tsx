"use client";

import { useState, useEffect, useCallback } from "react";
import { Newspaper, Search, Bookmark, BookmarkCheck, ExternalLink } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-news-saved";
const CATS = ["all", "crypto", "market", "local"];

interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
}

// Note: We do NOT have a real news provider configured. When one is
// connected (NewsAPI, RSS feed, etc.), articles will be fetched live.
// Until then, this module honestly shows "Setup Required" for live news.
// Saved articles (bookmarks) work via localStorage regardless.

function loadSaved(): Article[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveSaved(articles: Article[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

export default function NewsFeedPage() {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState<Article[]>([]);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => { if (!cancelled) setSaved(loadSaved()); });
    return () => { cancelled = true; };
  }, []);

  const isSaved = useCallback((id: string) => saved.some(a => a.id === id), [saved]);
  const toggleSave = useCallback((article: Article) => {
    setSaved(prev => {
      const exists = prev.some(a => a.id === article.id);
      const next = exists ? prev.filter(a => a.id !== article.id) : [...prev, article];
      saveSaved(next);
      return next;
    });
  }, []);

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-accent" />
          <h1 className="text-base font-semibold">News Feed</h1>
        </div>
        <button
          onClick={() => setShowSaved(v => !v)}
          className={cn("flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-medium transition-colors", showSaved ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}
        >
          {showSaved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
          Saved ({saved.length})
        </button>
      </div>

      {showSaved ? (
        <div className="space-y-2">
          {saved.length === 0 ? (
            <p className="py-8 text-center text-xs text-fg-faint">No saved articles.</p>
          ) : saved.map(a => (
            <ArticleCard key={a.id} article={a} isSaved onClick={() => toggleSave(a)} />
          ))}
        </div>
      ) : (
        <>
          {/* Search + categories */}
          <div className="mb-3 flex gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-fg-faint" />
              <input
                type="search" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…"
                className="focus-ring themed h-7 w-full rounded-md border border-line bg-inset pl-7 pr-2 text-xs text-fg placeholder:text-fg-faint"
              />
            </div>
            <div className="flex gap-1">
              {CATS.map(c => (
                <button key={c} onClick={() => setCategory(c)} className={cn("rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors", category === c ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Setup required notice */}
          <div className="mb-4 rounded-md border border-dashed border-line-muted p-4 text-center">
            <p className="text-xs font-medium text-fg-muted">Live news source required</p>
            <p className="mt-1 text-[11px] text-fg-faint">
              A legitimate news provider (NewsAPI, RSS aggregator, etc.) needs to be
              connected to fetch real articles. No fake stories are shown.
            </p>
          </div>
        </>
      )}
    </PageShell>
  );
}

function ArticleCard({ article, isSaved, onClick }: { article: Article; isSaved: boolean; onClick: () => void }) {
  return (
    <div className="themed rounded-md border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-fg hover:text-accent">
            {article.title}
            <ExternalLink className="h-2.5 w-2.5 shrink-0 text-fg-faint" />
          </a>
          <p className="mt-0.5 text-[11px] text-fg-muted">{article.description}</p>
          <div className="mt-1 flex items-center gap-2 text-[9px] text-fg-faint">
            <span>{article.source}</span>
            <span>·</span>
            <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
            <span>·</span>
            <span className="capitalize">{article.category}</span>
          </div>
        </div>
        <button onClick={onClick} className="shrink-0 text-fg-faint hover:text-accent">
          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-accent" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

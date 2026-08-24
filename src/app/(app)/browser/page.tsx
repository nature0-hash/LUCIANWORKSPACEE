"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft, ArrowRight, RotateCw, Plus, X, Star, StarOff,
  Search, MoreHorizontal, Globe, ExternalLink, Home, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Tab {
  id: string;
  url: string;
  title: string;
  history: string[];
  historyIndex: number;
  loading: boolean;
  error: boolean;
}

interface Bookmark {
  url: string;
  title: string;
  addedAt: number;
}

const STORAGE_KEY = "lucian-browser";
const BLOCKED_DOMAINS = ["google.com", "youtube.com", "facebook.com", "twitter.com", "instagram.com", "github.com"];

function loadState(): { bookmarks: Bookmark[]; history: { url: string; title: string; visitedAt: number }[] } {
  if (typeof window === "undefined") return { bookmarks: [], history: [] };
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"bookmarks":[],"history":[]}'); } catch {
    return { bookmarks: [], history: [] };
  }
}
function saveState(state: { bookmarks: Bookmark[]; history: { url: string; title: string; visitedAt: number }[] }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function isBlocked(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    return BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith("." + d));
  } catch { return false; }
}

function normalizeUrl(input: string): string {
  if (!input) return "";
  if (input.startsWith("http://") || input.startsWith("https://")) return input;
  if (input.includes(".") && !input.includes(" ")) return "https://" + input;
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}

export default function BrowserPage() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const [addressInput, setAddressInput] = useState("");
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<{ url: string; title: string; visitedAt: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const state = loadState();
    setBookmarks(state.bookmarks);
    setHistory(state.history);
    const newTab: Tab = {
      id: `tab_${Date.now()}`, url: "", title: "New Tab",
      history: [], historyIndex: -1, loading: false, error: false,
    };
    setTabs([newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  const updateTab = useCallback((id: string, patch: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const navigate = useCallback((url: string) => {
    if (!activeTabId || !url) return;
    const fullUrl = normalizeUrl(url);
    const blocked = isBlocked(fullUrl);
    const hostname = (() => { try { return new URL(fullUrl).hostname; } catch { return fullUrl; } })();
    updateTab(activeTabId, {
      url: fullUrl, title: hostname, loading: !blocked, error: false,
      history: [...tabs.find(t => t.id === activeTabId)!.history.slice(0, tabs.find(t => t.id === activeTabId)!.historyIndex + 1), fullUrl],
      historyIndex: tabs.find(t => t.id === activeTabId)!.historyIndex + 1,
    });
    setAddressInput(url);
    // Add to history
    const histEntry = { url: fullUrl, title: hostname, visitedAt: Date.now() };
    setHistory(prev => {
      const next = [histEntry, ...prev.filter(h => h.url !== fullUrl)].slice(0, 100);
      const state = { bookmarks, history: next };
      saveState(state);
      return next;
    });
    if (blocked) {
      updateTab(activeTabId, { loading: false, error: true });
    }
  }, [activeTabId, tabs, bookmarks, updateTab]);

  const handleNavigate = useCallback(() => navigate(addressInput), [addressInput, navigate]);

  const goBack = useCallback(() => {
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const newIndex = activeTab.historyIndex - 1;
    const url = activeTab.history[newIndex];
    updateTab(activeTabId, { url, historyIndex: newIndex, title: (() => { try { return new URL(url).hostname; } catch { return url; } })(), loading: false, error: isBlocked(url) });
    setAddressInput(url.replace(/^https?:\/\//, ""));
  }, [activeTab, activeTabId, updateTab]);

  const goForward = useCallback(() => {
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;
    const newIndex = activeTab.historyIndex + 1;
    const url = activeTab.history[newIndex];
    updateTab(activeTabId, { url, historyIndex: newIndex, title: (() => { try { return new URL(url).hostname; } catch { return url; } })(), loading: false, error: isBlocked(url) });
    setAddressInput(url.replace(/^https?:\/\//, ""));
  }, [activeTab, activeTabId, updateTab]);

  const reload = useCallback(() => {
    if (!activeTab?.url) return;
    updateTab(activeTabId, { loading: !isBlocked(activeTab.url), error: isBlocked(activeTab.url) });
    if (iframeRef.current) {
      const src = iframeRef.current.src;
      iframeRef.current.src = "";
      setTimeout(() => { if (iframeRef.current) iframeRef.current.src = src; }, 100);
    }
  }, [activeTab, activeTabId, updateTab]);

  const newTab = useCallback(() => {
    const tab: Tab = { id: `tab_${Date.now()}`, url: "", title: "New Tab", history: [], historyIndex: -1, loading: false, error: false };
    setTabs(prev => [...prev, tab]);
    setActiveTabId(tab.id);
    setAddressInput("");
  }, []);

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.id !== id);
      if (next.length === 0) {
        const nt: Tab = { id: `tab_${Date.now()}`, url: "", title: "New Tab", history: [], historyIndex: -1, loading: false, error: false };
        return [nt];
      }
      if (id === activeTabId) {
        setActiveTabId(next[0].id);
        setAddressInput(next[0].url.replace(/^https?:\/\//, ""));
      }
      return next;
    });
  }, [activeTabId]);

  const toggleBookmark = useCallback(() => {
    if (!activeTab?.url) return;
    const exists = bookmarks.some(b => b.url === activeTab.url);
    if (exists) {
      const next = bookmarks.filter(b => b.url !== activeTab.url);
      setBookmarks(next);
      saveState({ bookmarks: next, history });
      toast({ title: "Bookmark removed" });
    } else {
      const next = [...bookmarks, { url: activeTab.url, title: activeTab.title, addedAt: Date.now() }];
      setBookmarks(next);
      saveState({ bookmarks: next, history });
      toast({ title: "Bookmarked", description: activeTab.title });
    }
  }, [activeTab, bookmarks, history]);

  const isBookmarked = activeTab?.url ? bookmarks.some(b => b.url === activeTab.url) : false;

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    if (activeTabId) updateTab(activeTabId, { loading: false });
  }, [activeTabId, updateTab]);

  return (
    <div className="themed flex h-full min-h-0 flex-col bg-canvas text-fg">
      {/* Toolbar */}
      <div className="shrink-0 border-b border-line-muted px-3 py-2">
        <div className="flex items-center gap-1">
          <button onClick={goBack} disabled={!activeTab || activeTab.historyIndex <= 0}
            className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-30">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button onClick={goForward} disabled={!activeTab || activeTab.historyIndex >= activeTab.history.length - 1}
            className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-30">
            <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={reload} disabled={!activeTab?.url}
            className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-30">
            <RotateCw className="h-4 w-4" />
          </button>
          {/* Address bar */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
            <input
              value={addressInput}
              onChange={e => setAddressInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNavigate()}
              placeholder="Search or enter web address..."
              className="w-full rounded-full border border-line bg-surface py-1.5 pl-8 pr-3 text-[12px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>
          <button onClick={toggleBookmark} disabled={!activeTab?.url}
            className="rounded p-1.5 text-fg-muted hover:bg-hover hover:text-fg disabled:opacity-30">
            {isBookmarked ? <Star className="h-4 w-4 text-amber-400" /> : <StarOff className="h-4 w-4" />}
          </button>
          <button onClick={() => setShowBookmarks(v => !v)}
            className={cn("rounded p-1.5 hover:bg-hover", showBookmarks ? "text-fg" : "text-fg-muted hover:text-fg")}>
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex items-center gap-0.5 border-b border-line-muted px-2 py-1 overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTabId(tab.id); setAddressInput(tab.url.replace(/^https?:\/\//, "")); }}
            className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] max-w-[160px] transition-colors",
              tab.id === activeTabId ? "bg-surface text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
            {tab.loading && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]" />}
            <span className="truncate">{tab.title}</span>
            <button onClick={e => { e.stopPropagation(); closeTab(tab.id); }}
              className="rounded p-0.5 hover:bg-hover">
              <X className="h-2.5 w-2.5" />
            </button>
          </button>
        ))}
        <button onClick={newTab} className="rounded p-1 text-fg-muted hover:bg-hover hover:text-fg">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content area */}
      <div className="min-h-0 flex-1 overflow-hidden bg-surface relative">
        {!activeTab?.url ? (
          <NewTabPage bookmarks={bookmarks} history={history} onNavigate={navigate} />
        ) : activeTab.error ? (
          <BlockedPage url={activeTab.url} />
        ) : (
          <>
            <iframe
              ref={iframeRef}
              src={activeTab.url}
              onLoad={handleIframeLoad}
              className="h-full w-full border-0"
              title={activeTab.title}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
            {activeTab.loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-surface">
                <div className="flex items-center gap-2 text-[12px] text-fg-muted">
                  <RotateCw className="h-4 w-4 animate-spin" /> Loading...
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bookmarks/History dropdown */}
      {showBookmarks && (
        <div className="absolute right-4 top-12 z-30 w-72 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
          <div className="border-b border-line-muted px-3 py-2 text-[11px] font-semibold text-fg">Bookmarks & History</div>
          <div className="max-h-[300px] overflow-y-auto p-1">
            {bookmarks.length > 0 && <div className="px-2 py-1 text-[9px] uppercase text-fg-faint">Bookmarks</div>}
            {bookmarks.map(b => (
              <button key={b.url} onClick={() => { navigate(b.url); setShowBookmarks(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-hover">
                <Star className="h-3 w-3 text-amber-400" />
                <span className="flex-1 truncate text-fg">{b.title}</span>
              </button>
            ))}
            {history.length > 0 && <div className="mt-1 px-2 py-1 text-[9px] uppercase text-fg-faint">Recent</div>}
            {history.slice(0, 10).map((h, i) => (
              <button key={i} onClick={() => { navigate(h.url); setShowBookmarks(false); }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11px] hover:bg-hover">
                <Clock className="h-3 w-3 text-fg-faint" />
                <span className="flex-1 truncate text-fg-muted">{h.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NewTabPage({ bookmarks, history, onNavigate }: { bookmarks: Bookmark[]; history: { url: string; title: string; visitedAt: number }[]; onNavigate: (url: string) => void }) {
  const [search, setSearch] = useState("");
  return (
    <div className="flex h-full flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Globe className="mx-auto h-8 w-8 text-[var(--accent)] opacity-50" />
          <p className="mt-2 text-[14px] font-medium text-fg-muted">Search the web</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && search && onNavigate(search)}
            placeholder="Search or enter address..."
            className="w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-3 text-[13px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        {history.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-fg-faint">Recent</p>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 4).map((h, i) => (
                <button key={i} onClick={() => onNavigate(h.url)}
                  className="rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] text-fg-muted hover:text-fg">
                  {h.title}
                </button>
              ))}
            </div>
          </div>
        )}
        {bookmarks.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] uppercase tracking-wide text-fg-faint">Favorites</p>
            <div className="flex flex-wrap gap-2">
              {bookmarks.map(b => (
                <button key={b.url} onClick={() => onNavigate(b.url)}
                  className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] text-fg-muted hover:text-fg">
                  <Star className="h-3 w-3 text-amber-400" /> {b.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BlockedPage({ url }: { url: string }) {
  let hostname = url;
  try { hostname = new URL(url).hostname; } catch { /* keep */ }
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Globe className="h-10 w-10 text-fg-faint opacity-30" />
      <p className="mt-3 text-[13px] font-medium text-fg-muted">This website does not allow embedded viewing.</p>
      <p className="mt-1 text-[11px] text-fg-faint">{hostname} blocks iframe embedding for security reasons.</p>
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-1.5 text-[12px] font-medium text-[var(--accent)] hover:bg-[var(--accent)]/10">
        <ExternalLink className="h-3.5 w-3.5" /> Open Website
      </a>
    </div>
  );
}

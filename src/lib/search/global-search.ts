"use client";

/* LUCIAN Global Search — searches across all module stores.
 *
 * Each module exposes its searchable content via a search provider.
 * The Global Search engine aggregates results from all registered
 * providers and returns grouped, deduplicated results.
 */

export interface SearchResult {
  id: string;
  title: string;
  snippet: string;
  module: string;
  moduleLabel: string;
  deepLink?: string;
  timestamp?: number;
}

export interface SearchGroup {
  module: string;
  moduleLabel: string;
  results: SearchResult[];
}

type SearchProvider = (query: string) => SearchResult[];

const providers: SearchProvider[] = [];

export function registerSearchProvider(provider: SearchProvider) {
  providers.push(provider);
}

export function globalSearch(query: string): SearchGroup[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const allResults: SearchResult[] = [];
  for (const provider of providers) {
    try {
      const results = provider(q);
      allResults.push(...results);
    } catch { /* skip */ }
  }
  const groups: Map<string, SearchGroup> = new Map();
  for (const r of allResults) {
    if (!groups.has(r.module)) {
      groups.set(r.module, { module: r.module, moduleLabel: r.moduleLabel, results: [] });
    }
    groups.get(r.module)!.results.push(r);
  }
  return Array.from(groups.values()).slice(0, 6);
}

const NAV_ITEMS: { label: string; path: string; keywords: string[] }[] = [
  { label: "Home", path: "/", keywords: ["home", "dashboard"] },
  { label: "Markets", path: "/markets", keywords: ["markets", "trading", "chart"] },
  { label: "Investing", path: "/investing", keywords: ["investing", "portfolio", "holdings"] },
  { label: "Vault", path: "/vault", keywords: ["vault", "money", "account", "balance"] },
  { label: "Economy Hub", path: "/economy-hub", keywords: ["economy", "opportunity", "business"] },
  { label: "Economic Agent", path: "/economic-agent", keywords: ["economic agent", "ai", "chat"] },
  { label: "News Feed", path: "/news-feed", keywords: ["news", "feed", "discovery"] },
  { label: "DevWorkspace", path: "/dev-workspace", keywords: ["dev", "workspace", "project", "code"] },
  { label: "Browser", path: "/browser", keywords: ["browser", "web", "url"] },
  { label: "Knowledge Library", path: "/knowledge-library", keywords: ["knowledge", "library", "book", "reading"] },
  { label: "Chess Academy", path: "/chess-academy", keywords: ["chess", "game", "puzzle"] },
  { label: "Notes", path: "/notes", keywords: ["notes", "notebook", "write"] },
];

function searchNavigation(q: string): SearchResult[] {
  return NAV_ITEMS.filter(n =>
    n.label.toLowerCase().includes(q) || n.keywords.some(k => k.includes(q))
  ).map(n => ({ id: `nav-${n.path}`, title: n.label, snippet: "Navigate to page", module: "navigation", moduleLabel: "Navigation", deepLink: n.path }));
}

function searchNotes(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-notes-v2"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const sec of data.sections ?? []) for (const page of sec.pages ?? []) {
      const text = (page.title + " " + page.content.replace(/<[^>]+>/g, "")).toLowerCase();
      if (text.includes(q)) results.push({ id: `note-${page.id}`, title: page.title || "Untitled", snippet: page.content.replace(/<[^>]+>/g, "").slice(0, 80), module: "notes", moduleLabel: "Notes", deepLink: "/notes", timestamp: page.updatedAt });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchInvesting(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-investing"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const inv of data.investments ?? []) {
      if (inv.symbol.toLowerCase().includes(q) || inv.name.toLowerCase().includes(q))
        results.push({ id: `inv-${inv.id}`, title: `${inv.symbol} — ${inv.name}`, snippet: `Investment · ${inv.assetType}`, module: "investing", moduleLabel: "Investing", deepLink: "/investing", timestamp: inv.updatedAt });
    }
    for (const w of data.watchlist ?? []) {
      if (w.symbol.toLowerCase().includes(q) || w.name.toLowerCase().includes(q))
        results.push({ id: `wl-${w.id}`, title: `${w.symbol} — Watchlist`, snippet: w.notes || `Target: $${w.targetEntry}`, module: "investing", moduleLabel: "Investing", deepLink: "/investing" });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchEconomyHub(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-economy-hub"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const opp of data.opportunities ?? []) {
      if (opp.name?.toLowerCase().includes(q) || opp.description?.toLowerCase().includes(q))
        results.push({ id: `opp-${opp.id}`, title: opp.name, snippet: opp.description?.slice(0, 80) || `Score: ${opp.score}`, module: "economy-hub", moduleLabel: "Economy Hub", deepLink: "/economy-hub", timestamp: opp.updatedAt });
    }
    for (const biz of data.businesses ?? []) {
      if (biz.name?.toLowerCase().includes(q))
        results.push({ id: `biz-${biz.id}`, title: biz.name, snippet: `Business · ${biz.status}`, module: "economy-hub", moduleLabel: "Economy Hub", deepLink: "/economy-hub", timestamp: biz.updatedAt });
    }
    for (const r of data.researchRecords ?? []) {
      if (r.title?.toLowerCase().includes(q) || r.summary?.toLowerCase().includes(q))
        results.push({ id: `res-${r.id}`, title: r.title, snippet: r.summary?.slice(0, 80) || "Research", module: "economy-hub", moduleLabel: "Economy Hub", deepLink: "/economy-hub", timestamp: r.updatedAt });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchEconomicAgent(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-economic-agent"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const conv of data.conversations ?? []) {
      if (conv.title?.toLowerCase().includes(q))
        results.push({ id: `conv-${conv.id}`, title: conv.title, snippet: `${conv.messages?.length ?? 0} messages`, module: "economic-agent", moduleLabel: "Economic Agent", deepLink: "/economic-agent", timestamp: conv.updatedAt });
      for (const msg of conv.messages ?? []) {
        if (msg.content?.toLowerCase().includes(q)) {
          results.push({ id: `msg-${msg.id}`, title: conv.title, snippet: msg.content.slice(0, 80), module: "economic-agent", moduleLabel: "Economic Agent", deepLink: "/economic-agent", timestamp: msg.timestamp });
          break;
        }
      }
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchMarketsCatalog(q: string): SearchResult[] {
  try {
    const { INSTRUMENT_CATALOG } = require("@/lib/markets/catalog");
    return INSTRUMENT_CATALOG.filter((i: { symbol: string; name: string }) => i.symbol.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)).slice(0, 5).map((i: { symbol: string; name: string }) => ({ id: `mkt-${i.symbol}`, title: i.symbol, snippet: i.name, module: "markets", moduleLabel: "Markets", deepLink: "/markets" }));
  } catch { return []; }
}

function searchNewsFeed(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-news-feed"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const a of data.saved ?? []) {
      if (a.title?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q))
        results.push({ id: `news-${a.id}`, title: a.title, snippet: a.description?.slice(0, 80) || a.source, module: "news-feed", moduleLabel: "News Feed", deepLink: "/news-feed", timestamp: a.savedAt });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchKnowledgeLibrary(q: string): SearchResult[] {
  try {
    const { KNOWLEDGE_ITEMS } = require("@/lib/knowledge-data");
    return KNOWLEDGE_ITEMS.filter((i: { title: string; summary: string }) => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q)).slice(0, 5).map((i: { id: string; title: string; summary: string }) => ({ id: `know-${i.id}`, title: i.title, snippet: i.summary.slice(0, 80), module: "knowledge-library", moduleLabel: "Knowledge Library", deepLink: "/knowledge-library" }));
  } catch { return []; }
}

function searchVault(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-vault"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const a of data.accounts ?? []) {
      if (a.label?.toLowerCase().includes(q) || a.provider?.toLowerCase().includes(q))
        results.push({ id: `vault-${a.id}`, title: a.label, snippet: `${a.provider} · ${a.type}`, module: "vault", moduleLabel: "Vault", deepLink: "/vault" });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

function searchBrowser(q: string): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("lucian-browser"); if (!raw) return [];
    const data = JSON.parse(raw); const results: SearchResult[] = [];
    for (const b of data.bookmarks ?? []) {
      if (b.title?.toLowerCase().includes(q) || b.url?.toLowerCase().includes(q))
        results.push({ id: `bm-${b.url}`, title: b.title, snippet: b.url, module: "browser", moduleLabel: "Browser", deepLink: "/browser" });
    }
    return results.slice(0, 5);
  } catch { return []; }
}

// Register all providers
registerSearchProvider(searchNavigation);
registerSearchProvider(searchNotes);
registerSearchProvider(searchInvesting);
registerSearchProvider(searchEconomyHub);
registerSearchProvider(searchEconomicAgent);
registerSearchProvider(searchMarketsCatalog);
registerSearchProvider(searchNewsFeed);
registerSearchProvider(searchKnowledgeLibrary);
registerSearchProvider(searchVault);
registerSearchProvider(searchBrowser);

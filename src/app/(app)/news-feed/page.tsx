"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  Play,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  MoreHorizontal,
  Sun,
  Cloud,
  CloudRain,
  CloudSun,
  MapPin,
  TrendingUp,
  TrendingDown,
  Gamepad2,
  Newspaper,
  Eye,
  Clock,
} from "lucide-react";
import { useNewsFeedStore, type SavedArticle, type WidgetId, ALL_WIDGET_OPTIONS } from "@/store/news-feed";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

/* ── Types ── */

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: number;
  type: string;
  categories: string[];
  symbols: string[];
}

interface WeatherData {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
  }[];
}

interface SportsEvent {
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  status: string;
  time: string;
}

type Tab = "discover" | "watch" | "play";

const CATEGORIES = [
  "for-you", "top-stories", "world", "nigeria", "business",
  "markets", "technology", "science", "entertainment", "sports", "crypto",
];

const CATEGORY_LABELS: Record<string, string> = {
  "for-you": "For You",
  "top-stories": "Top Stories",
  world: "World",
  nigeria: "Nigeria",
  business: "Business",
  markets: "Markets",
  technology: "Technology",
  science: "Science",
  entertainment: "Entertainment",
  sports: "Sports",
  crypto: "Crypto",
};

/* ── Page ── */

export default function NewsFeedPage() {
  const [tab, setTab] = useState<Tab>("discover");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="themed flex h-full min-h-0 flex-col bg-canvas text-fg">
      {/* Header */}
      <div className="shrink-0 border-b border-line-muted px-4 py-3 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] text-fg-faint">{dateStr}</p>
            <h1 className="text-[16px] font-semibold tracking-tight text-fg">{greeting}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SavedButton />
          </div>
        </div>
        {/* Tab nav */}
        <div className="mt-2 flex gap-1">
          {([
            ["discover", "Discover"],
            ["watch", "Watch"],
            ["play", "Play"],
          ] as [Tab, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "border-b-2 px-3 py-1.5 text-[13px] font-medium transition-colors",
                tab === id
                  ? "border-[var(--accent)] text-fg"
                  : "border-transparent text-fg-muted hover:text-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "discover" && <DiscoverTab />}
        {tab === "watch" && <WatchTab />}
        {tab === "play" && <PlayTab />}
      </div>
    </div>
  );
}

/* ── Saved button ── */

function SavedButton() {
  const saved = useNewsFeedStore((s) => s.saved);
  const [showSaved, setShowSaved] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowSaved(true)}
        className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] font-medium text-fg-muted hover:text-fg"
      >
        {saved.length > 0 ? <BookmarkCheck className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Bookmark className="h-3.5 w-3.5" />}
        Saved ({saved.length})
      </button>
      {showSaved && <SavedDialog onClose={() => setShowSaved(false)} />}
    </>
  );
}

function SavedDialog({ onClose }: { onClose: () => void }) {
  const saved = useNewsFeedStore((s) => s.saved);
  const removeSaved = useNewsFeedStore((s) => s.removeSaved);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="themed flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line-muted px-4 py-3">
          <h2 className="text-[14px] font-semibold text-fg">Saved Articles</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {saved.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-fg-faint">No saved articles yet.</p>
          ) : (
            <div className="space-y-2">
              {saved.map(a => (
                <div key={a.id} className="flex items-start gap-2 rounded-md border border-line bg-surface-2 p-3">
                  <div className="min-w-0 flex-1">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-medium text-fg hover:text-[var(--accent)]">
                      {a.title}
                    </a>
                    <p className="mt-0.5 text-[10px] text-fg-faint">{a.source} · {new Date(a.publishedAt).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => removeSaved(a.id)} className="text-fg-faint hover:text-red-400">
                    <BookmarkCheck className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Discover tab ── */

function DiscoverTab() {
  return (
    <div className="flex h-full min-h-0">
      {/* Widget column */}
      <WidgetColumn />

      {/* Main feed */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <FeedContent />
      </div>
    </div>
  );
}

/* ── Feed content ── */

function FeedContent() {
  const preferences = useNewsFeedStore((s) => s.preferences);
  const setCategory = useNewsFeedStore((s) => s.setCategory);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  const fetchNews = useCallback(async (cat: string, query?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ category: cat });
      if (query) params.set("search", query);
      const res = await fetch(`/api/news/feed?${params}`);
      const data = await res.json();
      setItems(data.items ?? []);
      if (data.error) setError(data.error);
    } catch {
      setError("Failed to load news.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(preferences.category);
  }, [preferences.category, fetchNews]);

  const handleSearch = () => {
    if (search.trim()) {
      fetchNews(preferences.category, search.trim());
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4">
      {/* Search */}
      <div className="mb-3 flex items-center gap-2">
        {showSearch ? (
          <div className="flex flex-1 items-center gap-1">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-faint" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                placeholder="Search news, topics, companies..."
                className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-2 text-[12px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              />
            </div>
            <button onClick={() => { setShowSearch(false); setSearch(""); fetchNews(preferences.category); }} className="text-fg-faint hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button onClick={() => setShowSearch(true)} className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11px] text-fg-muted hover:text-fg">
            <Search className="h-3.5 w-3.5" />
            Search
          </button>
        )}
        <button
          onClick={() => fetchNews(preferences.category, search.trim() || undefined)}
          className="rounded-md border border-line bg-surface p-1.5 text-fg-muted hover:text-fg"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Categories */}
      <div className="mb-4 flex gap-1 overflow-x-auto pb-1">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              preferences.category === cat
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "bg-surface-2 text-fg-muted hover:text-fg",
            )}
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <div className="rounded-md border border-dashed border-line-muted p-8 text-center">
          <p className="text-[12px] font-medium text-fg-muted">{error}</p>
          <button onClick={() => fetchNews(preferences.category)} className="mt-2 rounded border border-line bg-surface-2 px-3 py-1 text-[11px] text-fg-muted hover:text-fg">
            Try Again
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-muted p-8 text-center">
          <p className="text-[12px] font-medium text-fg-muted">No stories found.</p>
          <p className="mt-1 text-[11px] text-fg-faint">Try a different category or search query.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Featured (first item) */}
          <FeaturedCard item={items[0]} />

          {/* Grid of remaining items */}
          <div className="grid gap-3 sm:grid-cols-2">
            {items.slice(1).map((item, i) => (
              <NewsCard key={item.id} item={item} variant={i % 3 === 0 ? "compact" : "medium"} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ── */

function SkeletonGrid() {
  return (
    <div className="space-y-3">
      <div className="h-[200px] animate-pulse rounded-md bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-2">
            <div className="h-[100px] animate-pulse rounded-md bg-surface-2" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-surface-2" />
            <div className="h-2 w-1/2 animate-pulse rounded bg-surface-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Featured card ── */

function FeaturedCard({ item }: { item: NewsItem }) {
  const toggleSave = useNewsFeedStore((s) => s.toggleSave);
  const isSaved = useNewsFeedStore((s) => s.isSaved(item.id));

  const savedArticle: SavedArticle = {
    id: item.id,
    title: item.headline,
    description: item.summary,
    url: item.url,
    source: item.source,
    category: item.categories[0] ?? "general",
    publishedAt: item.publishedAt,
    savedAt: 0,
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      {/* Image area / fallback */}
      <div className="relative flex h-[200px] items-center justify-center bg-surface-2">
        <Newspaper className="h-12 w-12 text-fg-faint opacity-30" />
        {item.type === "breaking" && (
          <span className="absolute left-3 top-3 rounded bg-red-500/90 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Breaking
          </span>
        )}
      </div>
      {/* Content */}
      <div className="p-4">
        <div className="mb-1 flex items-center gap-2 text-[10px] text-fg-faint">
          <span className="capitalize text-[var(--accent)]">{item.categories[0] ?? "News"}</span>
          <span>·</span>
          <span>{formatTimeAgo(item.publishedAt)}</span>
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
          <h2 className="text-[15px] font-semibold leading-snug text-fg hover:text-[var(--accent)]">
            {item.headline}
          </h2>
        </a>
        {item.summary && (
          <p className="mt-1 line-clamp-2 text-[12px] text-fg-muted">{item.summary}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-fg-faint">{item.source}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => { toggleSave(savedArticle); toast({ title: isSaved ? "Removed" : "Saved" }); }}
              className="rounded p-1 text-fg-faint hover:text-[var(--accent)]"
            >
              {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Bookmark className="h-3.5 w-3.5" />}
            </button>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-fg-faint hover:text-fg">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── News card ── */

function NewsCard({ item, variant }: { item: NewsItem; variant: "medium" | "compact" }) {
  const toggleSave = useNewsFeedStore((s) => s.toggleSave);
  const isSaved = useNewsFeedStore((s) => s.isSaved(item.id));

  const savedArticle: SavedArticle = {
    id: item.id,
    title: item.headline,
    description: item.summary,
    url: item.url,
    source: item.source,
    category: item.categories[0] ?? "general",
    publishedAt: item.publishedAt,
    savedAt: 0,
  };

  if (variant === "compact") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-line bg-surface p-3">
        <div className="min-w-0 flex-1">
          <a href={item.url} target="_blank" rel="noopener noreferrer">
            <p className="line-clamp-2 text-[12px] font-medium text-fg hover:text-[var(--accent)]">{item.headline}</p>
          </a>
          <p className="mt-0.5 text-[9px] text-fg-faint">{item.source} · {formatTimeAgo(item.publishedAt)}</p>
        </div>
        <button onClick={() => { toggleSave(savedArticle); toast({ title: isSaved ? "Removed" : "Saved" }); }} className="shrink-0 text-fg-faint hover:text-[var(--accent)]">
          {isSaved ? <BookmarkCheck className="h-3.5 w-3.5 text-[var(--accent)]" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* Image fallback */}
      <div className="flex h-[100px] items-center justify-center bg-surface-2">
        <Newspaper className="h-6 w-6 text-fg-faint opacity-30" />
      </div>
      <div className="p-3">
        <div className="mb-1 flex items-center gap-1.5 text-[9px] text-fg-faint">
          <span className="capitalize text-[var(--accent)]">{item.categories[0] ?? "News"}</span>
          <span>·</span>
          <span>{formatTimeAgo(item.publishedAt)}</span>
        </div>
        <a href={item.url} target="_blank" rel="noopener noreferrer">
          <p className="line-clamp-2 text-[12px] font-medium text-fg hover:text-[var(--accent)]">{item.headline}</p>
        </a>
        {item.summary && <p className="mt-1 line-clamp-1 text-[10px] text-fg-muted">{item.summary}</p>}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[9px] text-fg-faint">{item.source}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => { toggleSave(savedArticle); toast({ title: isSaved ? "Removed" : "Saved" }); }} className="rounded p-0.5 text-fg-faint hover:text-[var(--accent)]">
              {isSaved ? <BookmarkCheck className="h-3 w-3 text-[var(--accent)]" /> : <Bookmark className="h-3 w-3" />}
            </button>
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="rounded p-0.5 text-fg-faint hover:text-fg">
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Widget column ── */

function WidgetColumn() {
  const widgets = useNewsFeedStore((s) => s.widgets);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;
    const ids: string[] = widgets.map(w => w.id);
    const fromIdx = ids.indexOf(draggedId);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    ids.splice(fromIdx, 1);
    ids.splice(toIdx, 0, draggedId);
    useNewsFeedStore.getState().reorderWidgets(ids);
    setDraggedId(null);
  };

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-line-muted bg-surface-2/40 lg:flex">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line-muted px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">Widgets</span>
        <button onClick={() => setAddWidgetOpen(true)} className="text-fg-faint hover:text-fg" title="Add widget">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Widget list — independent scroll */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {widgets.filter(w => w.visible).map(w => (
          <div
            key={w.id}
            draggable
            onDragStart={() => handleDragStart(w.id)}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(w.id)}
            className={cn("cursor-grab active:cursor-grabbing", draggedId === w.id && "opacity-50")}
          >
            <WidgetWrapper widgetId={w.id} />
          </div>
        ))}
        {widgets.filter(w => w.visible).length === 0 && (
          <p className="py-4 text-center text-[11px] text-fg-faint">No widgets. Click + to add.</p>
        )}
      </div>
      {/* Add widget dialog */}
      {addWidgetOpen && <AddWidgetDialog onClose={() => setAddWidgetOpen(false)} />}
    </aside>
  );
}

function WidgetWrapper({ widgetId }: { widgetId: WidgetId }) {
  const widgets = useNewsFeedStore((s) => s.widgets);
  const toggleCollapse = useNewsFeedStore((s) => s.toggleWidgetCollapse);
  const removeWidget = useNewsFeedStore((s) => s.removeWidget);
  const config = widgets.find(w => w.id === widgetId);
  if (!config) return null;

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      {/* Widget header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
          {ALL_WIDGET_OPTIONS.find(o => o.id === widgetId)?.label ?? widgetId}
        </span>
        <div className="relative">
          <button onClick={() => setMenuOpen(v => !v)} className="text-fg-faint hover:text-fg">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-6 z-20 w-32 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
                <button onClick={() => { toggleCollapse(widgetId); setMenuOpen(false); }} className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] text-fg-muted hover:bg-hover hover:text-fg">
                  {config.collapsed ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
                  {config.collapsed ? "Expand" : "Collapse"}
                </button>
                <button onClick={() => { removeWidget(widgetId); setMenuOpen(false); }} className="flex w-full items-center gap-1.5 px-2 py-1 text-[10px] text-red-400 hover:bg-hover">
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {/* Widget body */}
      {!config.collapsed && (
        <div className="px-3 pb-2">
          {widgetId === "weather" && <WeatherWidget />}
          {widgetId === "markets" && <MarketsWidget />}
          {widgetId === "sports" && <SportsWidget />}
          {widgetId === "trending" && <TrendingWidget />}
          {widgetId === "watchlist" && <WatchlistWidget />}
          {widgetId === "top-stories" && <TopStoriesWidget />}
        </div>
      )}
    </div>
  );
}

/* ── Weather widget ── */

function WeatherWidget() {
  const prefs = useNewsFeedStore((s) => s.preferences);
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!prefs.weatherLat || !prefs.weatherLon) return;
    setLoading(true);
    fetch(`/api/news/weather?lat=${prefs.weatherLat}&lon=${prefs.weatherLon}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [prefs.weatherLat, prefs.weatherLon]);

  if (loading) return <div className="h-[60px] animate-pulse rounded bg-surface-2" />;
  if (!data?.current) return <p className="text-[10px] text-fg-faint">Weather unavailable</p>;

  const temp = Math.round(data.current.temperature_2m);
  const feelsLike = Math.round(data.current.apparent_temperature);
  const condition = getWeatherCondition(data.current.weather_code);

  return (
    <div>
      <div className="flex items-center gap-2">
        {condition.icon}
        <div>
          <div className="font-mono text-[20px] font-bold text-fg">{temp}°C</div>
          <div className="text-[9px] text-fg-faint">{prefs.weatherLocation}</div>
        </div>
      </div>
      <p className="mt-1 text-[10px] text-fg-muted">{condition.label}</p>
      <div className="mt-1 flex gap-3 text-[9px] text-fg-faint">
        <span>Feels {feelsLike}°</span>
        <span>Humidity {data.current.relative_humidity_2m}%</span>
        <span>Wind {Math.round(data.current.wind_speed_10m)} km/h</span>
      </div>
    </div>
  );
}

function getWeatherCondition(code: number): { label: string; icon: React.ReactNode } {
  if (code === 0) return { label: "Clear sky", icon: <Sun className="h-5 w-5 text-amber-400" /> };
  if (code <= 3) return { label: "Partly cloudy", icon: <CloudSun className="h-5 w-5 text-fg-muted" /> };
  if (code <= 48) return { label: "Foggy", icon: <Cloud className="h-5 w-5 text-fg-muted" /> };
  if (code <= 67) return { label: "Rainy", icon: <CloudRain className="h-5 w-5 text-blue-400" /> };
  return { label: "Cloudy", icon: <Cloud className="h-5 w-5 text-fg-muted" /> };
}

/* ── Markets widget ── */

function MarketsWidget() {
  const [prices, setPrices] = useState<{ symbol: string; price: number; change: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Reuse the markets catalog for static snapshot prices.
    import("@/lib/markets/catalog").then(({ INSTRUMENT_CATALOG }) => {
      const items = [
        INSTRUMENT_CATALOG.find(i => i.symbol === "BTCUSD"),
        INSTRUMENT_CATALOG.find(i => i.symbol === "XAUUSD"),
        INSTRUMENT_CATALOG.find(i => i.symbol === "XTIUSD"),
        INSTRUMENT_CATALOG.find(i => i.symbol === "NAS100"),
      ].filter(Boolean).map(i => ({
        symbol: i!.symbol,
        price: (i!.bid + i!.ask) / 2,
        change: i!.changePct ?? 0,
      }));
      setPrices(items);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="h-[60px] animate-pulse rounded bg-surface-2" />;

  return (
    <div className="space-y-1">
      {prices.map(p => (
        <div key={p.symbol} className="flex items-center justify-between text-[10px]">
          <span className="font-medium text-fg">{p.symbol}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono tabular-nums text-fg-muted">${p.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span className={cn("flex items-center gap-0.5 font-mono tabular-nums", p.change >= 0 ? "text-green-400" : "text-red-400")}>
              {p.change >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              {p.change >= 0 ? "+" : ""}{p.change.toFixed(2)}%
            </span>
          </div>
        </div>
      ))}
      <a href="/markets" className="mt-1 block text-[9px] text-[var(--accent)] hover:underline">Open Markets →</a>
    </div>
  );
}

/* ── Sports widget ── */

function SportsWidget() {
  const [events, setEvents] = useState<SportsEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news/sports")
      .then(r => r.json())
      .then(d => { setEvents(d.events ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-[60px] animate-pulse rounded bg-surface-2" />;
  if (events.length === 0) return <p className="text-[10px] text-fg-faint">No live scores available</p>;

  return (
    <div className="space-y-1.5">
      {events.slice(0, 4).map((e, i) => (
        <div key={i} className="flex items-center justify-between text-[10px]">
          <div className="min-w-0 flex-1">
            <p className="truncate text-fg">{e.homeTeam}</p>
            <p className="truncate text-fg">{e.awayTeam}</p>
          </div>
          <div className="ml-2 text-right">
            <p className="font-mono text-fg">{e.homeScore}</p>
            <p className="font-mono text-fg">{e.awayScore}</p>
          </div>
          {e.status === "live" && <span className="ml-1 rounded bg-red-500/20 px-1 text-[8px] font-bold uppercase text-red-400">Live</span>}
          {e.status === "final" && <span className="ml-1 text-[8px] text-fg-faint">FT</span>}
        </div>
      ))}
    </div>
  );
}

/* ── Trending widget ── */

function TrendingWidget() {
  const trending = ["AI", "Bitcoin", "Federal Reserve", "Nigeria economy", "Tesla", "Oil prices"];
  return (
    <div className="space-y-1">
      {trending.map((t, i) => (
        <div key={t} className="flex items-center gap-2 text-[10px] text-fg-muted">
          <span className="font-mono font-bold text-fg-faint">{i + 1}</span>
          {t}
        </div>
      ))}
    </div>
  );
}

/* ── Watchlist widget ── */

function WatchlistWidget() {
  return <p className="text-[10px] text-fg-faint">Follow topics to see related stories here.</p>;
}

/* ── Top Stories widget ── */

function TopStoriesWidget() {
  return <p className="text-[10px] text-fg-faint">Top stories appear in the main feed.</p>;
}

/* ── Add widget dialog ── */

function AddWidgetDialog({ onClose }: { onClose: () => void }) {
  const widgets = useNewsFeedStore((s) => s.widgets);
  const addWidget = useNewsFeedStore((s) => s.addWidget);

  const available = ALL_WIDGET_OPTIONS.filter(o => !widgets.some(w => w.id === o.id));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="themed w-full max-w-sm overflow-hidden rounded-lg border border-line bg-surface shadow-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line-muted px-4 py-3">
          <h2 className="text-[13px] font-semibold text-fg">Add Widget</h2>
          <button onClick={onClose} className="text-fg-muted hover:text-fg"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          {available.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-fg-faint">All widgets are already added.</p>
          ) : (
            <div className="space-y-1">
              {available.map(o => (
                <button
                  key={o.id}
                  onClick={() => { addWidget(o.id); toast({ title: "Widget added", description: o.label }); onClose(); }}
                  className="flex w-full items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-left text-[12px] text-fg-muted hover:text-fg"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Watch tab ── */

function WatchTab() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Play className="mx-auto h-12 w-12 text-fg-faint opacity-30" />
        <p className="mt-3 text-[14px] font-medium text-fg-muted">Video Provider Setup Required</p>
        <p className="mt-1 max-w-sm text-[12px] text-fg-faint">
          The Watch feed requires a video-provider integration.
          This integration has not been enabled yet.
        </p>
      </div>
    </div>
  );
}

/* ── Play tab ── */

function PlayTab() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="text-center">
        <Gamepad2 className="mx-auto h-12 w-12 text-fg-faint opacity-30" />
        <p className="mt-3 text-[14px] font-medium text-fg-muted">Play Content Provider Not Connected</p>
        <p className="mt-1 max-w-sm text-[12px] text-fg-faint">
          Games, puzzles, and interactive content will appear here when a play content provider is connected.
        </p>
      </div>
    </div>
  );
}

/* ── Helpers ── */

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 86400000 * 2) return "yesterday";
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

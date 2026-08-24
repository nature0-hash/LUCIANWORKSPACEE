"use client";

/* LUCIAN Markets — Intelligence Panel (right side of Markets).
 *
 * A collapsible right-side workspace with two tabs:
 *   - Chat: Markets AI conversation that knows the currently selected
 *           instrument + timeframe + prices + attached Feed stories.
 *   - Feed: Real market news aggregated from RSS feeds via /api/markets/news.
 *
 * Expanded: 320px panel sits to the right of the chart workspace.
 * Collapsed: thin ~32px rail runs along the far right with vertical
 *            Feed / Chat controls + an expand toggle at the top.
 *
 * Strict rules:
 *   - Never fabricates news (Feed shows real stories or an honest
 *     "configuration required" state).
 *   - Never fabricates AI responses (Chat calls the real /api/markets/chat
 *     endpoint which uses the z-ai-web-dev-sdk; failures surface honestly).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PanelRightClose,
  PanelRightOpen,
  Newspaper,
  MessageCircle,
  Filter,
  Send,
  ExternalLink,
  Sparkles,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketsStore } from "@/store/markets";
import { getInstrumentBySymbol } from "@/lib/markets/catalog";
import type {
  NewsItem,
  NewsFilters,
  MarketChatMessage,
  MarketChatContext,
  MarketCategory,
} from "@/lib/markets/intelligence-types";
import { DEFAULT_NEWS_FILTERS } from "@/lib/markets/intelligence-types";

const COLLAPSED_RAIL_WIDTH = 32;
const EXPANDED_PANEL_WIDTH = 320;
const INTELLIGENCE_OPEN_KEY = "lucian-markets-intelligence-open";
const INTELLIGENCE_TAB_KEY = "lucian-markets-intelligence-tab";

type Tab = "chat" | "feed";

interface Props {
  /** Lifted open/collapsed state. Defaults to true (expanded). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function IntelligencePanel({
  open: openProp,
  onOpenChange,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("feed");

  // Hydrate persisted state on mount (client-only).
  useEffect(() => {
    try {
      const storedOpen = localStorage.getItem(INTELLIGENCE_OPEN_KEY);
      if (storedOpen !== null) {
        setInternalOpen(storedOpen === "true");
      }
      const storedTab = localStorage.getItem(INTELLIGENCE_TAB_KEY);
      if (storedTab === "chat" || storedTab === "feed") {
        setTab(storedTab);
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Listen for cross-component tab switch requests (e.g. when a Feed
  // story's "Ask AI" is clicked, it dispatches this event to switch
  // the panel to the Chat tab).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<Tab>).detail;
      if (detail === "chat" || detail === "feed") {
        setTab(detail);
        try {
          localStorage.setItem(INTELLIGENCE_TAB_KEY, detail);
        } catch {
          /* storage unavailable */
        }
        // Also expand the panel if it's currently collapsed.
        if (!(openProp ?? internalOpen)) {
          setOpen(true);
        }
      }
    };
    window.addEventListener("lucian-markets-switch-tab", handler as EventListener);
    return () =>
      window.removeEventListener(
        "lucian-markets-switch-tab",
        handler as EventListener,
      );
  }, [openProp, internalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = openProp ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (onOpenChange) {
        onOpenChange(v);
      } else {
        setInternalOpen(v);
        try {
          localStorage.setItem(INTELLIGENCE_OPEN_KEY, String(v));
        } catch {
          /* storage unavailable */
        }
      }
    },
    [onOpenChange],
  );

  const handleTabChange = useCallback((t: Tab) => {
    setTab(t);
    try {
      localStorage.setItem(INTELLIGENCE_TAB_KEY, t);
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <div
      className="themed flex shrink-0 border-l border-line-muted bg-surface transition-[width] duration-200"
      style={{
        width: open ? EXPANDED_PANEL_WIDTH : COLLAPSED_RAIL_WIDTH,
      }}
    >
      {open ? (
        <ExpandedPanel
          tab={tab}
          onTabChange={handleTabChange}
          onCollapse={() => setOpen(false)}
        />
      ) : (
        <CollapsedRail
          onExpand={() => setOpen(true)}
          onOpenFeed={() => {
            handleTabChange("feed");
            setOpen(true);
          }}
          onOpenChat={() => {
            handleTabChange("chat");
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Expanded panel                                                      */
/* ------------------------------------------------------------------ */

function ExpandedPanel({
  tab,
  onTabChange,
  onCollapse,
}: {
  tab: Tab;
  onTabChange: (t: Tab) => void;
  onCollapse: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* Header: tab strip + collapse button */}
      <div className="flex h-8 shrink-0 items-center gap-0.5 border-b border-line-muted px-1 themed">
        <TabBtn
          label="Chat"
          icon={MessageCircle}
          active={tab === "chat"}
          onClick={() => onTabChange("chat")}
        />
        <TabBtn
          label="Feed"
          icon={Newspaper}
          active={tab === "feed"}
          onClick={() => onTabChange("feed")}
        />
        <div className="flex-1" />
        <button
          type="button"
          title="Collapse panel"
          aria-label="Collapse panel"
          onClick={onCollapse}
          className="flex h-6 w-6 items-center justify-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tab body */}
      {tab === "chat" ? <ChatTab /> : <FeedTab />}
    </div>
  );
}

function TabBtn({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof MessageCircle;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium transition-colors themed",
        active
          ? "border-b-2 border-[var(--accent)] text-fg"
          : "border-b-2 border-transparent text-fg-muted hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsed rail (thin vertical strip on the right edge)             */
/* ------------------------------------------------------------------ */

function CollapsedRail({
  onExpand,
  onOpenFeed,
  onOpenChat,
}: {
  onExpand: () => void;
  onOpenFeed: () => void;
  onOpenChat: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center gap-2 py-2 themed">
      {/* Expand toggle at top */}
      <button
        type="button"
        title="Expand panel"
        aria-label="Expand panel"
        onClick={onExpand}
        className="flex h-7 w-7 items-center justify-center rounded text-fg-faint transition-colors hover:bg-hover hover:text-fg"
      >
        <PanelRightOpen className="h-4 w-4" />
      </button>

      <div className="my-1 h-px w-5 bg-line-muted/60" />

      {/* Vertical label + icon stack — pushes to middle */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3">
        <RailButton
          icon={Newspaper}
          label="Feed"
          onClick={onOpenFeed}
        />
        <RailButton
          icon={MessageCircle}
          label="Chat"
          onClick={onOpenChat}
        />
      </div>
    </div>
  );
}

function RailButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof MessageCircle;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex flex-col items-center gap-1 rounded px-1 py-1 text-fg-faint transition-colors hover:bg-hover hover:text-fg"
    >
      <Icon className="h-4 w-4" />
      <span className="text-[8px] font-medium tracking-wide uppercase">
        {label}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Chat tab                                                            */
/* ------------------------------------------------------------------ */

function ChatTab() {
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  // Per-pane symbols live in ChartWorkspace; we use the global selected
  // symbol from the markets store as the "primary" instrument for chat
  // context. The user can also change it by clicking the chart pane's
  // symbol dropdown, which calls selectSymbol.
  const inst = useMemo(
    () => getInstrumentBySymbol(selectedSymbol ?? "EURUSD") ?? getInstrumentBySymbol("EURUSD")!,
    [selectedSymbol],
  );

  const [messages, setMessages] = useState<MarketChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [attachedNews, setAttachedNews] = useState<NewsItem[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build market context for each turn.
  const buildContext = useCallback((): MarketChatContext => {
    return {
      symbol: inst.symbol,
      assetClass: inst.assetClass,
      name: inst.name,
      timeframe: "M1",
      bid: inst.bid,
      ask: inst.ask,
      changePct: inst.changePct,
      attachedNews: attachedNews.length > 0 ? attachedNews : undefined,
    };
  }, [inst, attachedNews]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || pending) return;

    const userMsg: MarketChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
      fromModel: false,
      attachedNews: attachedNews.length > 0 ? attachedNews : undefined,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setPending(true);

    try {
      const res = await fetch("/api/markets/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newHistory,
          context: buildContext(),
        }),
      });
      const data = (await res.json()) as {
        content: string;
        fromModel: boolean;
      };
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content: data.content,
          timestamp: Date.now(),
          fromModel: data.fromModel,
        },
      ]);
      // Clear attached news after a successful turn.
      setAttachedNews([]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          role: "assistant",
          content:
            "Failed to reach the Markets AI service. Please try again in a moment.",
          timestamp: Date.now(),
          fromModel: false,
        },
      ]);
    } finally {
      setPending(false);
    }
  }, [input, pending, messages, attachedNews, buildContext]);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Expose a way for Feed stories to attach to the next chat message.
  // We attach via a custom event listener so Feed cards (rendered
  // elsewhere) can call without prop drilling.
  useEffect(() => {
    const handler = (e: Event) => {
      const story = (e as CustomEvent<NewsItem>).detail;
      setAttachedNews((prev) =>
        prev.some((n) => n.id === story.id) ? prev : [...prev, story],
      );
    };
    window.addEventListener("lucian-markets-attach-news", handler as EventListener);
    return () =>
      window.removeEventListener(
        "lucian-markets-attach-news",
        handler as EventListener,
      );
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Market context strip */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line-muted px-3 py-1.5 themed">
        <span className="font-mono text-[11px] font-bold text-fg">
          {inst.symbol}
        </span>
        <span className="text-[9px] text-fg-muted">·</span>
        <span className="text-[10px] text-fg-muted">M1</span>
        <span className="text-[9px] text-fg-muted">·</span>
        <span className="font-mono text-[10px] tabular-nums text-fg">
          {inst.bid.toFixed(inst.pricePrecision)}
        </span>
      </div>

      {/* Conversation */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2 space-y-2"
      >
        {messages.length === 0 ? (
          <EmptyChatState symbol={inst.symbol} />
        ) : (
          messages.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              symbol={inst.symbol}
            />
          ))
        )}
        {pending && (
          <div className="flex items-center gap-2 text-[10px] text-fg-faint">
            <span className="animate-pulse">●</span>
            <span>Markets AI is thinking…</span>
          </div>
        )}
      </div>

      {/* Attached news previews */}
      {attachedNews.length > 0 && (
        <div className="shrink-0 border-t border-line-muted px-3 py-1.5 space-y-1">
          {attachedNews.map((n) => (
            <div
              key={n.id}
              className="flex items-center gap-1.5 rounded bg-surface-2 px-2 py-1 text-[9px]"
            >
              <Sparkles className="h-2.5 w-2.5 text-[var(--accent)]" />
              <span className="flex-1 truncate text-fg-muted">
                {n.headline}
              </span>
              <button
                type="button"
                onClick={() =>
                  setAttachedNews((prev) => prev.filter((x) => x.id !== n.id))
                }
                className="text-fg-faint hover:text-fg"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="shrink-0 border-t border-line-muted p-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={`Ask about ${inst.symbol} or this market…`}
          rows={2}
          className="w-full resize-none rounded border border-line-muted bg-surface-2 px-2 py-1.5 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Add context"
              className="flex items-center gap-1 rounded text-[9px] text-fg-muted hover:text-fg"
            >
              <Sparkles className="h-2.5 w-2.5" />
              Context
            </button>
            <button
              type="button"
              className="flex items-center gap-1 rounded text-[9px] text-fg-muted hover:text-fg"
            >
              Model
              <ChevronDown className="h-2 w-2" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || pending}
            className="flex items-center gap-1 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-2.5 w-2.5" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyChatState({ symbol }: { symbol: string }) {
  return (
    <div className="rounded border border-line-muted bg-surface-2/60 p-3 text-[11px]">
      <p className="font-medium text-fg">Markets AI</p>
      <p className="mt-1 text-[10px] leading-relaxed text-fg-muted">
        Ask anything about <span className="font-mono text-fg">{symbol}</span>{" "}
        or the market you&apos;re viewing. The assistant knows the
        currently selected instrument, timeframe, and prices. You can also
        click <span className="font-medium">Ask AI</span> on a Feed story
        to attach it to your next question.
      </p>
      <div className="mt-2 space-y-1">
        <p className="text-[9px] uppercase tracking-wide text-fg-faint">
          Try asking
        </p>
        {[
          "What is happening here?",
          "Explain this price move.",
          "What are the important levels visible here?",
          "Summarize today's news for this market.",
        ].map((q) => (
          <div
            key={q}
            className="rounded border border-line-muted bg-surface-2 px-2 py-1 text-[10px] text-fg-muted"
          >
            {q}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({
  message,
  symbol,
}: {
  message: MarketChatMessage;
  symbol: string;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "rounded px-2 py-1.5 text-[11px] leading-relaxed",
        isUser
          ? "ml-4 bg-[var(--accent)]/15 text-fg"
          : "mr-4 bg-surface-2 text-fg",
      )}
    >
      <div className="mb-0.5 flex items-center justify-between text-[8px] uppercase tracking-wide text-fg-faint">
        <span>{isUser ? "You" : "Markets AI"}</span>
        {!isUser && !message.fromModel && (
          <span className="text-amber-500">⚠ unverified</span>
        )}
      </div>
      <p className="whitespace-pre-wrap">{message.content}</p>
      {message.attachedNews && message.attachedNews.length > 0 && (
        <div className="mt-1 space-y-0.5 border-t border-line-muted/60 pt-1">
          <p className="text-[8px] uppercase tracking-wide text-fg-faint">
            Attached stories
          </p>
          {message.attachedNews.map((n) => (
            <a
              key={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] text-[var(--accent)] hover:underline"
            >
              <ExternalLink className="h-2 w-2" />
              <span className="truncate">{n.headline}</span>
            </a>
          ))}
        </div>
      )}
      {isUser && (
        <span className="mt-0.5 block text-[8px] text-fg-faint">
          context: {symbol} · M1
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Feed tab                                                            */
/* ------------------------------------------------------------------ */

function FeedTab() {
  const [filters, setFilters] = useState<NewsFilters>(DEFAULT_NEWS_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerLabel, setProviderLabel] = useState<string | null>(null);

  // The current instrument is shared from the markets store so the
  // "current instrument only" filter works.
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const inst = useMemo(
    () => getInstrumentBySymbol(selectedSymbol ?? "EURUSD") ?? getInstrumentBySymbol("EURUSD")!,
    [selectedSymbol],
  );

  // Determine the market category to filter on based on the selected
  // instrument's asset class (only when currentInstrumentOnly is true).
  const effectiveFilters: NewsFilters = useMemo(() => {
    if (!filters.currentInstrumentOnly) return filters;
    const map: Record<string, MarketCategory> = {
      forex: "forex",
      crypto: "crypto",
      stocks: "stocks",
      indices: "indices",
      metals: "metals",
      energies: "energy",
      commodities: "metals",
    };
    return {
      ...filters,
      market: map[inst.assetClass] ?? filters.market,
    };
  }, [filters, inst.assetClass]);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        market: effectiveFilters.market,
        breaking: String(effectiveFilters.content.breaking),
        news: String(effectiveFilters.content.news),
        analysis: String(effectiveFilters.content.analysis),
        economicEvents: String(effectiveFilters.content.economicEvents),
        currentInstrumentOnly: String(effectiveFilters.currentInstrumentOnly),
      });
      const res = await fetch(`/api/markets/news?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        items: NewsItem[];
        provider?: { label?: string };
        error?: string;
        message?: string;
      };
      if (data.provider?.label) setProviderLabel(data.provider.label);
      setItems(data.items ?? []);
      if (data.error) setError(data.message ?? "Feed unavailable");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load market feed.",
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveFilters]);

  useEffect(() => {
    void fetchNews();
  }, [fetchNews]);

  const handleAskAi = useCallback((story: NewsItem) => {
    // Attach the story to the next chat turn.
    window.dispatchEvent(
      new CustomEvent("lucian-markets-attach-news", { detail: story }),
    );
    // Ask the IntelligencePanel to switch to the Chat tab + expand.
    window.dispatchEvent(
      new CustomEvent("lucian-markets-switch-tab", { detail: "chat" }),
    );
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Filter button row */}
      <div className="flex h-7 shrink-0 items-center gap-2 border-b border-line-muted px-2 themed">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors themed",
            filterOpen
              ? "bg-active text-fg"
              : "text-fg-muted hover:bg-hover hover:text-fg",
          )}
        >
          <Filter className="h-2.5 w-2.5" />
          Filters
        </button>
        {filters.currentInstrumentOnly && (
          <span className="rounded bg-[var(--accent)]/15 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent)]">
            {inst.symbol} only
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={fetchNews}
          title="Refresh"
          className="text-[9px] text-fg-faint hover:text-fg"
        >
          ↻
        </button>
      </div>

      {/* Filter drawer */}
      {filterOpen && (
        <FilterDrawer
          filters={filters}
          onChange={setFilters}
          onClose={() => setFilterOpen(false)}
          onReset={() => setFilters(DEFAULT_NEWS_FILTERS)}
          onApply={() => setFilterOpen(false)}
        />
      )}

      {/* Feed list */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-3 py-8 text-center text-[10px] text-fg-faint">
            Loading live market feed…
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center">
            <p className="text-[11px] font-medium text-amber-500">
              Live feed unavailable
            </p>
            <p className="mt-1 text-[10px] text-fg-muted">{error}</p>
            <p className="mt-2 text-[9px] text-fg-faint">
              {providerLabel
                ? `Provider: ${providerLabel}`
                : "Configure a market-news provider in .env"}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="px-3 py-8 text-center text-[10px] text-fg-faint">
            No stories match the current filters.
          </div>
        ) : (
          items.map((item) => (
            <FeedCard key={item.id} item={item} onAskAi={handleAskAi} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Filter drawer ── */

function FilterDrawer({
  filters,
  onChange,
  onClose,
  onReset,
  onApply,
}: {
  filters: NewsFilters;
  onChange: (f: NewsFilters) => void;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
}) {
  return (
    <div className="shrink-0 space-y-2 border-b border-line-muted bg-surface-2 px-3 py-2 themed">
      {/* Market */}
      <div>
        <p className="mb-1 text-[9px] uppercase tracking-wide text-fg-faint">
          Market
        </p>
        <div className="flex flex-wrap gap-1">
          {(
            [
              "all",
              "forex",
              "crypto",
              "stocks",
              "indices",
              "metals",
              "energy",
            ] as MarketCategory[]
          ).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...filters, market: m })}
              className={cn(
                "rounded px-1.5 py-0.5 text-[9px] font-medium capitalize transition-colors themed",
                filters.market === m
                  ? "bg-active text-fg"
                  : "bg-surface text-fg-muted hover:text-fg",
              )}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div>
        <p className="mb-1 text-[9px] uppercase tracking-wide text-fg-faint">
          Content
        </p>
        <div className="flex flex-wrap gap-2">
          <FilterCheck
            label="Breaking"
            checked={filters.content.breaking}
            onChange={(v) =>
              onChange({
                ...filters,
                content: { ...filters.content, breaking: v },
              })
            }
          />
          <FilterCheck
            label="News"
            checked={filters.content.news}
            onChange={(v) =>
              onChange({
                ...filters,
                content: { ...filters.content, news: v },
              })
            }
          />
          <FilterCheck
            label="Analysis"
            checked={filters.content.analysis}
            onChange={(v) =>
              onChange({
                ...filters,
                content: { ...filters.content, analysis: v },
              })
            }
          />
          <FilterCheck
            label="Economic events"
            checked={filters.content.economicEvents}
            onChange={(v) =>
              onChange({
                ...filters,
                content: { ...filters.content, economicEvents: v },
              })
            }
          />
        </div>
      </div>

      {/* Instrument */}
      <div>
        <p className="mb-1 text-[9px] uppercase tracking-wide text-fg-faint">
          Instrument
        </p>
        <label className="flex items-center gap-1.5 text-[10px] text-fg-muted">
          <input
            type="checkbox"
            checked={filters.currentInstrumentOnly}
            onChange={(e) =>
              onChange({
                ...filters,
                currentInstrumentOnly: e.target.checked,
              })
            }
            className="h-2.5 w-2.5 accent-[var(--accent)]"
          />
          Current instrument only
        </label>
      </div>

      {/* Time */}
      <div>
        <p className="mb-1 text-[9px] uppercase tracking-wide text-fg-faint">
          Time
        </p>
        <div className="flex items-center gap-1 rounded bg-surface px-1.5 py-0.5 text-[10px] text-fg-muted">
          Latest
          <ChevronDown className="h-2 w-2" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-fg-muted hover:text-fg"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onApply}
          className="rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-fg)]"
        >
          Apply
        </button>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-2 top-2 text-fg-faint hover:text-fg"
        aria-label="Close filters"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function FilterCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] text-fg-muted">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-2.5 w-2.5 accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

/* ── Feed card ── */

function FeedCard({
  item,
  onAskAi,
}: {
  item: NewsItem;
  onAskAi: (item: NewsItem) => void;
}) {
  const minsAgo = Math.max(
    0,
    Math.round((Date.now() - item.publishedAt) / 60000),
  );
  const timeLabel =
    minsAgo < 1 ? "now" : minsAgo < 60 ? `${minsAgo}m` : `${Math.floor(minsAgo / 60)}h`;

  const typeColor =
    item.type === "breaking"
      ? "text-red-400"
      : item.type === "analysis"
      ? "text-[var(--accent)]"
      : item.type === "economic-event"
      ? "text-amber-400"
      : "text-fg-muted";

  return (
    <div className="border-b border-line-muted/60 px-3 py-2 themed hover:bg-hover/30">
      {/* Header: type + time */}
      <div className="mb-1 flex items-center gap-1.5 text-[8px] uppercase tracking-wide">
        <span className={cn("font-bold", typeColor)}>
          {item.type === "economic-event" ? "Economic" : item.type}
        </span>
        <span className="text-fg-faint">·</span>
        <span className="text-fg-faint">{timeLabel}</span>
        {item.symbols.length > 0 && (
          <>
            <span className="text-fg-faint">·</span>
            <span className="font-mono text-fg-muted">
              {item.symbols.slice(0, 3).join(" · ")}
            </span>
          </>
        )}
      </div>

      {/* Headline */}
      <p className="text-[11px] font-semibold leading-snug text-fg">
        {item.headline}
      </p>

      {/* Summary */}
      {item.summary && (
        <p className="mt-1 text-[10px] leading-relaxed text-fg-muted line-clamp-3">
          {item.summary}
        </p>
      )}

      {/* Footer: source + actions */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] text-fg-faint">
          {item.source}
        </span>
        <div className="flex items-center gap-1">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-fg-muted hover:bg-hover hover:text-fg"
          >
            <ExternalLink className="h-2 w-2" />
            Read
          </a>
          <button
            type="button"
            onClick={() => onAskAi(item)}
            className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] text-[var(--accent)] hover:bg-[var(--accent)]/15"
          >
            <Sparkles className="h-2 w-2" />
            Ask AI
          </button>
        </div>
      </div>
    </div>
  );
}

// LUCIAN Markets — Market Intelligence types.
//
// Shared types for the Markets intelligence system (Chat + Feed).
// These types describe:
//   - NewsProvider: a real-world market-news aggregator (RSS, REST, etc.)
//   - NewsItem: a single feed story from a real source
//   - NewsFilters: how the user wants to filter the feed
//   - ChatContext: the market context handed to the AI for each chat turn
//
// Strict rule: every NewsItem MUST come from a real connected source.
// When no provider is configured, the Feed shows an honest
// "configuration required" state — it never falls back to fake stories.

import type { AssetClass } from "@/lib/markets/types";

/** UI market category used by the Feed filters. */
export type MarketCategory =
  | "all"
  | "forex"
  | "crypto"
  | "stocks"
  | "indices"
  | "metals"
  | "energy";

/** Content type of a news story. */
export type NewsType =
  | "breaking"
  | "news"
  | "analysis"
  | "economic-event";

/** A single real-world news story. */
export interface NewsItem {
  /** Stable ID (URL hash or provider id). */
  id: string;
  /** Source name, e.g. "Reuters", "Bloomberg", "CoinDesk". */
  source: string;
  /** ISO timestamp of publication. */
  publishedAt: number;
  /** Headline. */
  headline: string;
  /** Short factual summary (1-3 sentences). */
  summary: string;
  /** Direct URL to the original article. */
  url: string;
  /** Content type. */
  type: NewsType;
  /** Market categories this story touches. */
  categories: MarketCategory[];
  /** Specific instrument symbols referenced (e.g. ["BTCUSD", "ETHUSD"]). */
  symbols: string[];
  /** Optional image URL from the source (only when legitimately available). */
  imageUrl?: string;
  /** Provider that supplied this story. */
  providerId: string;
}

/** User-facing feed filters. */
export interface NewsFilters {
  market: MarketCategory;
  content: {
    breaking: boolean;
    news: boolean;
    analysis: boolean;
    economicEvents: boolean;
  };
  /** Restrict to the currently selected instrument. */
  currentInstrumentOnly: boolean;
  /** Sort order — only "latest" supported initially. */
  sort: "latest";
}

export const DEFAULT_NEWS_FILTERS: NewsFilters = {
  market: "all",
  content: {
    breaking: true,
    news: true,
    analysis: true,
    economicEvents: true,
  },
  currentInstrumentOnly: false,
  sort: "latest",
};

/** Market context handed to the AI for each chat turn. */
export interface MarketChatContext {
  /** Currently selected instrument symbol. */
  symbol: string;
  /** Asset class of the selected instrument. */
  assetClass: AssetClass;
  /** Display name. */
  name: string;
  /** Selected timeframe (e.g. "M1", "H1"). */
  timeframe: string;
  /** Current bid (sell) price from the catalog. */
  bid: number;
  /** Current ask (buy) price from the catalog. */
  ask: number;
  /** 24h change percent, if available. */
  changePct: number | null;
  /** Optional OHLC snapshot from the chart. */
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  /** Optional list of news items intentionally attached to this turn
      (e.g. when the user clicks "Ask AI" on a Feed story). */
  attachedNews?: NewsItem[];
}

/** A single message in the Markets AI conversation. */
export interface MarketChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  /** Whether the assistant content actually came from a configured model
      (false when no provider is configured). */
  fromModel: boolean;
  /** Optional attached news items, used when message originates from
      "Ask AI" on a Feed story. */
  attachedNews?: NewsItem[];
}

/** Market-news provider adapter. Plug any real news source in here. */
export interface NewsProvider {
  /** Stable ID — e.g. "rss-aggregator", "newsapi". */
  id: string;
  /** Human-readable label for the UI. */
  label: string;
  /** True when the provider is configured and able to return real data. */
  configured: boolean;
  /** Honest explanation shown when configured=false. */
  notConfiguredReason?: string;
  /** Fetch real news items matching the filters. */
  fetch: (filters: NewsFilters) => Promise<NewsItem[]>;
}

/** Markets AI provider adapter — mirrors the project's existing
    ModelProvider interface but scoped to market conversations. */
export interface MarketChatProvider {
  id: string;
  label: string;
  configured: boolean;
  notConfiguredReason?: string;
  /** Submit the conversation + market context, get the assistant's reply. */
  submit: (params: {
    messages: MarketChatMessage[];
    context: MarketChatContext;
  }) => Promise<{ content: string; fromModel: boolean }>;
}

/** No-op news provider — used when no real source is configured. */
export const noopNewsProvider: NewsProvider = {
  id: "noop",
  label: "No provider configured",
  configured: false,
  notConfiguredReason:
    "Live market feed is unavailable. Configure a market-news provider in .env to enable real stories.",
  async fetch() {
    return [];
  },
};

/** No-op chat provider — used when no AI provider is configured. */
export const noopChatProvider: MarketChatProvider = {
  id: "noop",
  label: "No model configured",
  configured: false,
  notConfiguredReason:
    "No model is configured. Connect an AI provider (e.g. set OPENAI_API_KEY or ZAI_API_KEY in .env) to enable Markets AI responses.",
  async submit() {
    return {
      content:
        "No model is configured. Connect an AI provider to enable Markets AI responses.",
      fromModel: false,
    };
  },
};

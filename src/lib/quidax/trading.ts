import "server-only";

import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { quidaxFetch, quidaxPublicFetch } from "@/lib/quidax/client";
import { listWalletAccounts } from "@/lib/quidax/transfers";

type Side = "BUY" | "SELL";

function positiveDecimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,12})?$/.test(text) || Number(text) <= 0) return null;
  return text;
}

function quoteCurrency(): "NGN" | "USDT" {
  return (process.env.QUIDAX_TRADING_QUOTE_CURRENCY ?? "NGN").trim().toUpperCase() === "USDT" ? "USDT" : "NGN";
}

function maxOrderQuote(): number {
  // Safe default: no production Quidax trade can exceed 50 of the selected
  // quote currency until the owner explicitly raises this value.
  return Math.max(1, Number(process.env.MAX_LIVE_ORDER_QUOTE ?? "50"));
}

function assertLiveEnabled() {
  if ((process.env.TRADING_MODE ?? "sandbox") !== "live" || process.env.LIVE_TRADING_ENABLED !== "true") {
    throw new Error("Live trading is locked by the server environment.");
  }
}

function productParts(value: unknown): { productId: string; base: string; quote: "NGN" | "USDT"; market: string } {
  const productId = typeof value === "string" ? value.trim().toUpperCase() : "";
  const match = /^([A-Z0-9]{2,12})-(NGN|USDT)$/.exec(productId);
  if (!match) throw new Error("Use a Quidax spot pair such as BTC-NGN or BTC-USDT.");
  const base = match[1];
  const quote = match[2] as "NGN" | "USDT";
  if (quote !== quoteCurrency()) throw new Error(`LUCIAN is currently limited to ${quoteCurrency()}-quoted Quidax markets.`);
  return { productId, base, quote, market: `${base}${quote}`.toLowerCase() };
}

async function marketPrice(market: string): Promise<number> {
  const response = await quidaxPublicFetch(`/markets/tickers/${encodeURIComponent(market)}`);
  const payload = await response.json().catch(() => ({})) as { status?: string; message?: string; data?: Record<string, { ticker?: { last?: number | string; buy?: number | string; sell?: number | string } }> };
  const ticker = payload.data?.[market]?.ticker;
  const price = Number(ticker?.last ?? ticker?.sell ?? ticker?.buy ?? 0);
  if (!response.ok || payload.status === "error" || !Number.isFinite(price) || price <= 0) throw new Error(`Quidax could not price ${market.toUpperCase()}.`);
  return price;
}

function volumeForQuote(quoteAmount: string, price: number): string {
  const result = Number(quoteAmount) / price;
  if (!Number.isFinite(result) || result <= 0) throw new Error("The Quidax market price produced an invalid order size.");
  return result.toFixed(12).replace(/0+$/, "").replace(/\.$/, "");
}

export async function getTradingProfile(userId: string) {
  return db.tradingAgentProfile.upsert({
    where: { userId },
    create: { userId, maxOrderUsd: maxOrderQuote() },
    update: {},
  });
}

export async function agentCapitalSummary(userId: string) {
  const [profile, wallets, intents] = await Promise.all([
    getTradingProfile(userId),
    listWalletAccounts(),
    db.liveTradeIntent.findMany({ where: { userId, state: { in: ["executing", "submitted", "filled"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const quote = quoteCurrency();
  const actualQuoteAvailable = wallets.filter((wallet) => wallet.asset === quote).reduce((sum, wallet) => sum + Number(wallet.available), 0);
  const positions = Object.fromEntries(wallets.filter((wallet) => wallet.type === "crypto").map((wallet) => [wallet.asset, Math.max(0, Number(wallet.available))]));
  const relevantIntents = intents.filter((intent) => intent.productId.endsWith(`-${quote}`));
  const reservedQuote = relevantIntents
    .filter((intent) => intent.side === "BUY" && ["executing", "submitted"].includes(intent.state))
    .reduce((sum, intent) => sum + Number(intent.quoteSize ?? 0), 0);
  const allocationQuote = Number(profile.allocationUsd);
  const availableAgentQuote = Math.max(0, Math.min(actualQuoteAvailable, allocationQuote - reservedQuote));
  return {
    quoteCurrency: quote,
    profile: {
      allocationUsd: allocationQuote,
      maxOrderUsd: Number(profile.maxOrderUsd),
      permissionMode: profile.permissionMode,
      emergencyStop: profile.emergencyStop,
    },
    actualUsdAvailable: actualQuoteAvailable,
    availableAgentUsd: availableAgentQuote,
    netCashDeployed: 0,
    reservedUsd: reservedQuote,
    positions,
    accounts: wallets,
    recentIntents: relevantIntents.slice(0, 25).map((intent) => ({
      id: intent.id, productId: intent.productId, side: intent.side, state: intent.state,
      quoteSize: intent.quoteSize?.toString() ?? null, baseSize: intent.baseSize?.toString() ?? null,
      initiatedBy: intent.initiatedBy, providerOrderId: intent.providerOrderId, createdAt: intent.createdAt,
    })),
  };
}

export async function updateTradingProfile(userId: string, input: Record<string, unknown>) {
  const current = await getTradingProfile(userId);
  const quote = quoteCurrency();
  const data: { allocationUsd?: number; maxOrderUsd?: number; permissionMode?: string; emergencyStop?: boolean } = {};
  if (input.allocationUsd !== undefined) {
    const allocation = Number(input.allocationUsd);
    if (!Number.isFinite(allocation) || allocation < 0) throw new Error(`Agent Capital (${quote}) must be zero or greater.`);
    const actual = (await listWalletAccounts()).filter((wallet) => wallet.asset === quote).reduce((sum, wallet) => sum + Number(wallet.available), 0);
    if (allocation > actual) throw new Error(`Agent Capital cannot exceed the available Quidax ${quote} balance (${actual.toFixed(2)} ${quote}).`);
    data.allocationUsd = allocation;
  }
  if (input.maxOrderUsd !== undefined) {
    const maximum = Number(input.maxOrderUsd);
    const envMaximum = maxOrderQuote();
    if (!Number.isFinite(maximum) || maximum <= 0 || maximum > envMaximum) throw new Error(`Per-order limit must be between 0.01 and ${envMaximum.toFixed(2)} ${quote}.`);
    data.maxOrderUsd = maximum;
  }
  if (input.permissionMode !== undefined) {
    const mode = String(input.permissionMode);
    if (!['advisor', 'assisted', 'operator', 'autonomous'].includes(mode)) throw new Error("Invalid agent permission mode.");
    data.permissionMode = mode;
  }
  if (typeof input.emergencyStop === "boolean") data.emergencyStop = input.emergencyStop;
  return db.tradingAgentProfile.update({ where: { id: current.id }, data });
}

export async function previewLiveTrade(userId: string, input: Record<string, unknown>) {
  assertLiveEnabled();
  const product = productParts(input.productId);
  const side = input.side === "BUY" || input.side === "SELL" ? input.side as Side : null;
  const quoteSize = positiveDecimal(input.quoteSize);
  const requestedBaseSize = positiveDecimal(input.baseSize);
  const initiatedBy = input.initiatedBy === "ai" ? "ai" : "user";
  if (!side) throw new Error("Select BUY or SELL.");
  if ((side === "BUY" && !quoteSize) || (side === "SELL" && !requestedBaseSize)) throw new Error(side === "BUY" ? `quoteSize (${product.quote}) is required for buys.` : "baseSize is required for sells.");
  const summary = await agentCapitalSummary(userId);
  if (summary.profile.emergencyStop) throw new Error("Emergency stop is active.");
  if (summary.profile.permissionMode === "advisor") throw new Error("The agent is in Advisor mode and cannot place trades.");
  if (initiatedBy === "ai" && process.env.AI_TRADING_ENABLED !== "true") throw new Error("AI live trading is disabled.");
  const price = await marketPrice(product.market);
  const baseSize = side === "BUY" ? volumeForQuote(quoteSize!, price) : requestedBaseSize!;
  if (side === "BUY") {
    const amount = Number(quoteSize);
    if (amount > summary.profile.maxOrderUsd) throw new Error(`Order exceeds the ${summary.profile.maxOrderUsd.toFixed(2)} ${product.quote} per-order limit.`);
    if (amount > summary.availableAgentUsd) throw new Error(`Order exceeds available Agent Capital (${summary.availableAgentUsd.toFixed(2)} ${product.quote}).`);
  } else if (Number(baseSize) > (summary.positions[product.base] ?? 0) + 1e-12) {
    throw new Error(`The agent does not control enough ${product.base} to sell that amount.`);
  }
  const preview = {
    provider: "quidax", market: product.market, productId: product.productId, side,
    quoteCurrency: product.quote, quoteSize: side === "BUY" ? quoteSize : undefined,
    baseSize, estimatedPrice: price, estimatedTotal: side === "BUY" ? quoteSize : Number(baseSize) * price,
    warning: "This is a LUCIAN estimate. Quidax executes a market order at the available market price after your separate confirmation.",
  };
  const intent = await db.liveTradeIntent.create({
    data: {
      userId, clientOrderId: `quidax-${randomUUID()}`, productId: product.productId, side,
      quoteSize: side === "BUY" ? quoteSize : undefined, baseSize, initiatedBy,
      previewId: randomUUID(), preview, expiresAt: new Date(Date.now() + 60_000),
    },
  });
  return { requiresConfirmation: true, intentId: intent.id, expiresAt: intent.expiresAt, preview };
}

export async function executeLiveTrade(userId: string, intentId: string) {
  assertLiveEnabled();
  const intent = await db.liveTradeIntent.findFirst({ where: { id: intentId, userId } });
  if (!intent || intent.state !== "previewed" || !intent.previewId) throw new Error("Trade preview is missing, expired, or already used.");
  if (!intent.expiresAt || intent.expiresAt.getTime() < Date.now()) {
    await db.liveTradeIntent.update({ where: { id: intent.id }, data: { state: "expired" } });
    throw new Error("Trade preview expired. Ask LUCIAN to preview it again.");
  }
  const product = productParts(intent.productId);
  const summary = await agentCapitalSummary(userId);
  if (summary.profile.emergencyStop) throw new Error("Emergency stop is active.");
  if (intent.side === "BUY" && Number(intent.quoteSize ?? 0) > summary.availableAgentUsd) throw new Error("Available Agent Capital changed and no longer covers this trade.");
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const fresh = await tx.liveTradeIntent.findFirst({ where: { id: intent.id, userId, state: "previewed" } });
    if (!fresh) throw new Error("Trade preview was already used.");
    await tx.liveTradeIntent.update({ where: { id: fresh.id }, data: { state: "executing" } });
  });
  const order = { market: product.market, side: intent.side.toLowerCase(), ord_type: "market", volume: intent.baseSize?.toString() };
  try {
    const response = await quidaxFetch("/users/me/orders", { method: "POST", body: JSON.stringify(order) });
    const execution = await response.json().catch(() => ({})) as Record<string, unknown>;
    const data = execution.data as { id?: string; status?: string } | undefined;
    const accepted = response.ok && execution.status !== "error" && Boolean(data?.id);
    const state = accepted ? (data?.status === "done" ? "filled" : "submitted") : "rejected";
    await db.liveTradeIntent.update({ where: { id: intent.id }, data: { state, providerOrderId: data?.id, execution: execution as Prisma.InputJsonValue } });
    if (!accepted || !data?.id) throw new Error(typeof execution.message === "string" ? execution.message : "Quidax rejected the order.");
    return { intentId: intent.id, initiatedBy: intent.initiatedBy, provider: "quidax", orderId: data.id, status: data.status ?? "submitted", execution };
  } catch (error) {
    await db.liveTradeIntent.updateMany({ where: { id: intent.id, state: "executing" }, data: { state: "failed", execution: { error: error instanceof Error ? error.message : "Order failed" } } });
    throw error;
  }
}

export async function listQuidaxOrders() {
  const response = await quidaxFetch("/users/me/orders?order_by=desc");
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

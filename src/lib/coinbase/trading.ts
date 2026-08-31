import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { coinbaseFetch } from "@/lib/coinbase/client";

type CoinbaseAccount = { currency?: string; available_balance?: { value?: string; currency?: string } };
type CoinbaseFill = { order_id?: string; product_id?: string; price?: string; size?: string; commission?: string; trade_time?: string };

function positiveDecimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,12})?$/.test(text) || Number(text) <= 0) return null;
  return text;
}

function assertLiveEnabled() {
  if ((process.env.TRADING_MODE ?? "sandbox") !== "live" || process.env.LIVE_TRADING_ENABLED !== "true") {
    throw new Error("Live trading is locked by the server environment.");
  }
}

export async function getTradingProfile(userId: string) {
  const envMax = Math.max(1, Number(process.env.MAX_LIVE_ORDER_USD ?? "50"));
  return db.tradingAgentProfile.upsert({
    where: { userId },
    create: { userId, maxOrderUsd: envMax },
    update: {},
  });
}

async function coinbaseAccounts(userId: string): Promise<CoinbaseAccount[]> {
  const response = await coinbaseFetch(userId, "/api/v3/brokerage/accounts?limit=250");
  const payload = await response.json() as { accounts?: CoinbaseAccount[] };
  if (!response.ok) throw new Error("Coinbase balance synchronization failed.");
  return Array.isArray(payload.accounts) ? payload.accounts : [];
}

async function fillsForTrackedOrders(userId: string, orderIds: Set<string>): Promise<CoinbaseFill[]> {
  if (orderIds.size === 0) return [];
  const matched: CoinbaseFill[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page += 1) {
    const path = `/api/v3/brokerage/orders/historical/fills?limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const response = await coinbaseFetch(userId, path);
    const payload = await response.json() as { fills?: CoinbaseFill[]; cursor?: string };
    if (!response.ok) throw new Error("Coinbase fill reconciliation failed.");
    const batch = Array.isArray(payload.fills) ? payload.fills : [];
    matched.push(...batch.filter((fill) => fill.order_id && orderIds.has(fill.order_id)));
    cursor = payload.cursor;
    if (!cursor || batch.length < 250) break;
  }
  return matched;
}

export async function agentCapitalSummary(userId: string) {
  const [profile, accounts, intents] = await Promise.all([
    getTradingProfile(userId),
    coinbaseAccounts(userId),
    db.liveTradeIntent.findMany({ where: { userId, state: { in: ["executing", "submitted", "filled"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const actualUsdAvailable = accounts
    .filter((account) => account.currency === "USD" || account.currency === "USDC")
    .reduce((sum, account) => sum + Number(account.available_balance?.value ?? 0), 0);
  const orderIds = new Set(intents.map((intent) => intent.providerOrderId).filter((id): id is string => Boolean(id)));
  const fills = await fillsForTrackedOrders(userId, orderIds);
  const fillOrderIds = new Set(fills.map((fill) => fill.order_id).filter((id): id is string => Boolean(id)));
  if (fillOrderIds.size > 0) {
    await db.liveTradeIntent.updateMany({
      where: { userId, providerOrderId: { in: [...fillOrderIds] }, state: "submitted" },
      data: { state: "filled" },
    });
  }
  let netCashDeployed = 0;
  const buyCostByOrder = new Map<string, number>();
  const positions: Record<string, number> = {};
  for (const fill of fills) {
    const intent = intents.find((item) => item.providerOrderId === fill.order_id);
    if (!intent) continue;
    const quantity = Number(fill.size ?? 0);
    const gross = Number(fill.price ?? 0) * quantity;
    const fee = Number(fill.commission ?? 0);
    const base = intent.productId.split("-")[0];
    if (intent.side === "BUY") {
      netCashDeployed += gross + fee;
      if (fill.order_id) buyCostByOrder.set(fill.order_id, (buyCostByOrder.get(fill.order_id) ?? 0) + gross + fee);
      positions[base] = (positions[base] ?? 0) + quantity;
    } else {
      netCashDeployed -= Math.max(0, gross - fee);
      positions[base] = (positions[base] ?? 0) - quantity;
    }
  }
  const reservedUsd = intents
    .filter((intent) => intent.side === "BUY" && intent.state !== "filled")
    .reduce((sum, intent) => sum + Math.max(0, Number(intent.quoteSize ?? 0) - (intent.providerOrderId ? (buyCostByOrder.get(intent.providerOrderId) ?? 0) : 0)), 0);
  const allocationUsd = Number(profile.allocationUsd);
  const availableAgentUsd = Math.max(0, Math.min(actualUsdAvailable, allocationUsd - netCashDeployed - reservedUsd));
  return {
    profile: {
      allocationUsd,
      maxOrderUsd: Number(profile.maxOrderUsd),
      permissionMode: profile.permissionMode,
      emergencyStop: profile.emergencyStop,
    },
    actualUsdAvailable,
    availableAgentUsd,
    netCashDeployed,
    reservedUsd,
    positions: Object.fromEntries(Object.entries(positions).map(([asset, size]) => [asset, Math.max(0, size)])),
    accounts,
    recentIntents: intents.slice(0, 25).map((intent) => ({
      id: intent.id, productId: intent.productId, side: intent.side, state: intent.state,
      quoteSize: intent.quoteSize?.toString() ?? null, baseSize: intent.baseSize?.toString() ?? null,
      initiatedBy: intent.initiatedBy, providerOrderId: intent.providerOrderId, createdAt: intent.createdAt,
    })),
  };
}

export async function updateTradingProfile(userId: string, input: Record<string, unknown>) {
  const current = await getTradingProfile(userId);
  const data: { allocationUsd?: number; maxOrderUsd?: number; permissionMode?: string; emergencyStop?: boolean } = {};
  if (input.allocationUsd !== undefined) {
    const allocation = Number(input.allocationUsd);
    if (!Number.isFinite(allocation) || allocation < 0) throw new Error("Agent Capital must be zero or greater.");
    const accounts = await coinbaseAccounts(userId);
    const actual = accounts.filter((a) => a.currency === "USD" || a.currency === "USDC").reduce((sum, a) => sum + Number(a.available_balance?.value ?? 0), 0);
    if (allocation > actual) throw new Error(`Agent Capital cannot exceed the available Coinbase USD/USDC balance ($${actual.toFixed(2)}).`);
    data.allocationUsd = allocation;
  }
  if (input.maxOrderUsd !== undefined) {
    const maxOrder = Number(input.maxOrderUsd);
    const envMax = Number(process.env.MAX_LIVE_ORDER_USD ?? "50");
    if (!Number.isFinite(maxOrder) || maxOrder <= 0 || maxOrder > envMax) throw new Error(`Per-order limit must be between $0.01 and $${envMax.toFixed(2)}.`);
    data.maxOrderUsd = maxOrder;
  }
  if (input.permissionMode !== undefined) {
    const mode = String(input.permissionMode);
    if (!["advisor", "assisted", "operator", "autonomous"].includes(mode)) throw new Error("Invalid agent permission mode.");
    data.permissionMode = mode;
  }
  if (typeof input.emergencyStop === "boolean") data.emergencyStop = input.emergencyStop;
  return db.tradingAgentProfile.update({ where: { id: current.id }, data });
}

export async function previewLiveTrade(userId: string, input: Record<string, unknown>) {
  assertLiveEnabled();
  const productId = typeof input.productId === "string" ? input.productId.toUpperCase() : "";
  const side = input.side === "BUY" || input.side === "SELL" ? input.side : null;
  const quoteSize = positiveDecimal(input.quoteSize);
  const baseSize = positiveDecimal(input.baseSize);
  const initiatedBy = input.initiatedBy === "ai" ? "ai" : "user";
  if (!/^[A-Z0-9]{2,12}-(USD|USDC)$/.test(productId) || !side) throw new Error("Only USD/USDC crypto spot products are allowed.");
  if ((side === "BUY" && !quoteSize) || (side === "SELL" && !baseSize)) throw new Error(side === "BUY" ? "quoteSize is required for buys." : "baseSize is required for sells.");
  const summary = await agentCapitalSummary(userId);
  if (summary.profile.emergencyStop) throw new Error("Emergency stop is active.");
  if (summary.profile.permissionMode === "advisor") throw new Error("The agent is in Advisor mode and cannot place trades.");
  if (initiatedBy === "ai" && process.env.AI_TRADING_ENABLED !== "true") throw new Error("AI live trading is disabled.");
  if (side === "BUY") {
    const amount = Number(quoteSize);
    if (amount > summary.profile.maxOrderUsd) throw new Error(`Order exceeds the $${summary.profile.maxOrderUsd.toFixed(2)} per-order limit.`);
    if (amount > summary.availableAgentUsd) throw new Error(`Order exceeds available Agent Capital ($${summary.availableAgentUsd.toFixed(2)}).`);
  } else {
    const base = productId.split("-")[0];
    if (Number(baseSize) > (summary.positions[base] ?? 0) + 1e-12) throw new Error(`The agent does not control enough ${base} to sell that amount.`);
  }
  const orderConfiguration = { market_market_ioc: side === "BUY" ? { quote_size: quoteSize } : { base_size: baseSize } };
  const common = { product_id: productId, side, order_configuration: orderConfiguration };
  const response = await coinbaseFetch(userId, "/api/v3/brokerage/orders/preview", { method: "POST", body: JSON.stringify(common) });
  const preview = await response.json() as Record<string, unknown>;
  if (!response.ok || typeof preview.preview_id !== "string") throw new Error("Coinbase could not preview this order.");
  const intent = await db.liveTradeIntent.create({
    data: {
      userId, clientOrderId: randomUUID(), productId, side, quoteSize, baseSize, initiatedBy,
      previewId: preview.preview_id, preview: preview as object, expiresAt: new Date(Date.now() + 110_000),
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
  const summary = await agentCapitalSummary(userId);
  if (summary.profile.emergencyStop) throw new Error("Emergency stop is active.");
  if (intent.side === "BUY" && Number(intent.quoteSize ?? 0) > summary.availableAgentUsd) throw new Error("Available Agent Capital changed and no longer covers this trade.");
  await db.$transaction(async (tx) => {
    // A per-user Postgres advisory lock makes simultaneous confirmations
    // serialize, so two tabs cannot both spend the same Agent Capital.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
    const fresh = await tx.liveTradeIntent.findFirst({ where: { id: intent.id, userId, state: "previewed" } });
    if (!fresh) throw new Error("Trade preview was already used.");
    if (fresh.side === "BUY") {
      const [profile, open] = await Promise.all([
        tx.tradingAgentProfile.findUnique({ where: { userId } }),
        tx.liveTradeIntent.aggregate({
          where: { userId, side: "BUY", state: { in: ["executing", "submitted"] } },
          _sum: { quoteSize: true },
        }),
      ]);
      const committed = Number(open._sum.quoteSize ?? 0) + Number(fresh.quoteSize ?? 0);
      if (!profile || committed + summary.netCashDeployed > Number(profile.allocationUsd) + 1e-8) {
        throw new Error("Another trade already reserved the available Agent Capital.");
      }
    }
    await tx.liveTradeIntent.update({ where: { id: fresh.id }, data: { state: "executing" } });
  });
  const orderConfiguration = { market_market_ioc: intent.side === "BUY" ? { quote_size: intent.quoteSize?.toString() } : { base_size: intent.baseSize?.toString() } };
  const order = { client_order_id: intent.clientOrderId, product_id: intent.productId, side: intent.side, order_configuration: orderConfiguration, preview_id: intent.previewId };
  try {
    const response = await coinbaseFetch(userId, "/api/v3/brokerage/orders", { method: "POST", body: JSON.stringify(order) });
    const execution = await response.json() as Record<string, unknown>;
    const success = execution.success === true;
    const successResponse = execution.success_response as { order_id?: string } | undefined;
    await db.liveTradeIntent.update({
      where: { id: intent.id },
      data: { state: success ? "submitted" : "rejected", providerOrderId: successResponse?.order_id, execution: execution as object },
    });
    if (!response.ok || !success) throw new Error("Coinbase rejected the order.");
    return { intentId: intent.id, initiatedBy: intent.initiatedBy, provider: "coinbase", ...execution };
  } catch (error) {
    await db.liveTradeIntent.updateMany({ where: { id: intent.id, state: "executing" }, data: { state: "failed", execution: { error: error instanceof Error ? error.message : "Order failed" } } });
    throw error;
  }
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { coinbaseAccessToken, coinbaseFetch } from "@/lib/coinbase/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function decimal(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value);
  if (!/^\d+(\.\d{1,8})?$/.test(text) || Number(text) <= 0) return null;
  return text;
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    if ((process.env.TRADING_MODE ?? "sandbox") !== "live") {
      return NextResponse.json({ mode: "sandbox", orders: [], message: "Live exchange orders are disabled." });
    }
    const query = new URL(req.url).searchParams;
    const productId = query.get("product_id");
    const path = `/api/v3/brokerage/orders/historical/batch${productId ? `?product_id=${encodeURIComponent(productId)}` : ""}`;
    const response = await coinbaseFetch(userId, path);
    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load orders." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    if ((process.env.TRADING_MODE ?? "sandbox") !== "live" || process.env.LIVE_TRADING_ENABLED !== "true") {
      return NextResponse.json({ error: "Live trading is locked. Use the persistent sandbox or explicitly enable live trading." }, { status: 403 });
    }
    const body = await req.json() as Record<string, unknown>;
    const productId = typeof body.productId === "string" ? body.productId.toUpperCase() : "";
    const side = body.side === "BUY" || body.side === "SELL" ? body.side : null;
    const quoteSize = decimal(body.quoteSize);
    const baseSize = decimal(body.baseSize);
    const initiatedBy = body.initiatedBy === "ai" ? "ai" : "user";
    if (!/^[A-Z0-9]{2,12}-(USD|USDC)$/.test(productId) || !side) {
      return NextResponse.json({ error: "Only USD/USDC crypto spot products are allowed." }, { status: 400 });
    }
    if ((side === "BUY" && !quoteSize) || (side === "SELL" && !baseSize)) {
      return NextResponse.json({ error: side === "BUY" ? "quoteSize is required for buys." : "baseSize is required for sells." }, { status: 400 });
    }
    const maxOrderUsd = Number(process.env.MAX_LIVE_ORDER_USD ?? "250");
    if (quoteSize && Number(quoteSize) > maxOrderUsd) {
      return NextResponse.json({ error: `Order exceeds the $${maxOrderUsd} live-order limit.` }, { status: 403 });
    }
    if (initiatedBy === "ai" && process.env.AI_TRADING_ENABLED !== "true") {
      return NextResponse.json({ error: "AI live trading is disabled." }, { status: 403 });
    }
    const access = await coinbaseAccessToken(userId);
    if (!access.portfolioId) return NextResponse.json({ error: "No Coinbase portfolio was authorized. Reconnect Coinbase." }, { status: 409 });
    const orderConfiguration = { market_market_ioc: side === "BUY" ? { quote_size: quoteSize } : { base_size: baseSize } };
    const common = { product_id: productId, side, order_configuration: orderConfiguration, retail_portfolio_id: access.portfolioId };

    // Every live order is previewed first. The caller must show this preview
    // and send its preview id back with confirmed=true before execution.
    if (body.confirmed !== true || typeof body.previewId !== "string") {
      const previewResponse = await coinbaseFetch(userId, "/api/v3/brokerage/orders/preview", { method: "POST", body: JSON.stringify(common) });
      const preview = await previewResponse.json();
      return NextResponse.json({ requiresConfirmation: true, preview }, { status: previewResponse.ok ? 200 : previewResponse.status });
    }
    const order = {
      ...common,
      client_order_id: typeof body.clientOrderId === "string" ? body.clientOrderId : randomUUID(),
      preview_id: body.previewId,
    };
    const response = await coinbaseFetch(userId, "/api/v3/brokerage/orders", { method: "POST", body: JSON.stringify(order) });
    const payload = await response.json();
    return NextResponse.json({ initiatedBy, provider: "coinbase", ...payload }, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order failed." }, { status: 400 });
  }
}

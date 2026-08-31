import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { coinbaseFetch } from "@/lib/coinbase/client";
import { executeLiveTrade, previewLiveTrade } from "@/lib/coinbase/trading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    const body = await req.json() as Record<string, unknown>;
    if (body.confirmed === true && typeof body.intentId === "string") {
      return NextResponse.json(await executeLiveTrade(userId, body.intentId));
    }
    return NextResponse.json(await previewLiveTrade(userId, body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order failed." }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { executeLiveTrade, listQuidaxOrders, previewLiveTrade } from "@/lib/quidax/trading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    if ((process.env.TRADING_MODE ?? "sandbox") !== "live") {
      return NextResponse.json({ mode: "sandbox", orders: [], message: "Live exchange orders are disabled." });
    }
    void userId;
    const { response, payload } = await listQuidaxOrders();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load orders." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    const body = await req.json() as Record<string, unknown>;
    if (body.confirmed === true && typeof body.intentId === "string") {
      return NextResponse.json(await executeLiveTrade(userId, body.intentId));
    }
    return NextResponse.json(await previewLiveTrade(userId, body));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Order failed." }, { status: 400 });
  }
}

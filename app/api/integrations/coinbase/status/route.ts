import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { coinbaseFetch } from "@/lib/coinbase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const connection = await db.exchangeConnection.findUnique({ where: { userId_provider: { userId, provider: "coinbase" } } });
    const configured = Boolean(process.env.COINBASE_CLIENT_ID && process.env.COINBASE_CLIENT_SECRET && process.env.COINBASE_REDIRECT_URI && process.env.VAULT_ENCRYPTION_KEY);
    if (!connection || connection.state !== "connected") {
      return NextResponse.json({ configured, connected: false, state: connection?.state ?? "not_connected", tradingMode: process.env.TRADING_MODE ?? "sandbox" });
    }
    const response = await coinbaseFetch(userId, "/api/v3/brokerage/accounts");
    const balances = response.ok ? await response.json() : null;
    return NextResponse.json({ configured, connected: true, state: connection.state, tradingMode: process.env.TRADING_MODE ?? "sandbox", balances });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const userId = await requireUserId();
    await db.exchangeConnection.deleteMany({ where: { userId, provider: "coinbase" } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
}

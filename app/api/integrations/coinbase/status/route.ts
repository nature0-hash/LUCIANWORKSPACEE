import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { coinbaseAuthMode, coinbaseFetch, isCoinbaseConfigured } from "@/lib/coinbase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const authMode = coinbaseAuthMode();
    const connection = authMode === "oauth" ? await db.exchangeConnection.findUnique({ where: { userId_provider: { userId, provider: "coinbase" } } }) : null;
    const configured = isCoinbaseConfigured();
    if (!configured || (authMode === "oauth" && (!connection || connection.state !== "connected"))) {
      return NextResponse.json({ configured, connected: false, state: connection?.state ?? "not_connected", authMode, tradingMode: process.env.TRADING_MODE ?? "sandbox" });
    }
    const response = await coinbaseFetch(userId, "/api/v3/brokerage/accounts?limit=250");
    const balances = await response.json();
    if (!response.ok) return NextResponse.json({ configured, connected: false, state: "provider_error", authMode, error: "Coinbase rejected the balance request." }, { status: response.status });
    return NextResponse.json({ configured, connected: true, state: connection?.state ?? "connected", authMode, tradingMode: process.env.TRADING_MODE ?? "sandbox", balances });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read Coinbase status." }, { status: 401 });
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

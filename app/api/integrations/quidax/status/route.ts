import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { isQuidaxConfigured, quidaxFetch } from "@/lib/quidax/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireVaultOwner();
  } catch {
    return unauthorizedVaultResponse();
  }
  const configured = isQuidaxConfigured();
  if (!configured) {
    return NextResponse.json({ configured: false, connected: false, state: "not_configured", provider: "quidax", tradingMode: process.env.TRADING_MODE ?? "sandbox" });
  }
  try {
    const response = await quidaxFetch("/users/me/wallets");
    const balances = await response.json().catch(() => ({}));
    if (!response.ok || (balances as { status?: string }).status === "error") {
      return NextResponse.json({ configured: true, connected: false, state: "provider_error", provider: "quidax", error: "Quidax rejected the wallet request." }, { status: response.status || 400 });
    }
    return NextResponse.json({ configured: true, connected: true, state: "connected", provider: "quidax", tradingMode: process.env.TRADING_MODE ?? "sandbox", balances });
  } catch (error) {
    return NextResponse.json({ configured: true, connected: false, state: "provider_error", provider: "quidax", error: error instanceof Error ? error.message : "Unable to read Quidax status." }, { status: 400 });
  }
}

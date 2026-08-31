import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { coinbaseTransferSettings, listWalletAccounts } from "@/lib/coinbase/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    const settings = coinbaseTransferSettings();
    if (!settings.configured) return NextResponse.json({ error: "Coinbase is not configured." }, { status: 503 });
    const accounts = await listWalletAccounts(userId);
    return NextResponse.json({ accounts, settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Coinbase wallets." }, { status: 400 });
  }
}

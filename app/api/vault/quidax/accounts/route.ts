import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { listWalletAccounts, quidaxTransferSettings } from "@/lib/quidax/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await requireVaultOwner();
  } catch {
    return unauthorizedVaultResponse();
  }
  try {
    const settings = quidaxTransferSettings();
    if (!settings.configured) return NextResponse.json({ error: "Quidax is not configured." }, { status: 503 });
    return NextResponse.json({ accounts: await listWalletAccounts(), settings });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Quidax wallets." }, { status: 400 });
  }
}

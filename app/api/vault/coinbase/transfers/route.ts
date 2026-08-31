import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { listCoinbaseTransfers } from "@/lib/coinbase/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    return NextResponse.json({ transfers: await listCoinbaseTransfers(userId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Coinbase transfer history." }, { status: 400 });
  }
}

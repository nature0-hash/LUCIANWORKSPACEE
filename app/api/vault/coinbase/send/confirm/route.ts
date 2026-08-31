import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { executeCoinbaseSend } from "@/lib/coinbase/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    const input = await req.json() as Record<string, unknown>;
    return NextResponse.json(await executeCoinbaseSend(userId, input), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to submit Coinbase transfer." }, { status: 400 });
  }
}

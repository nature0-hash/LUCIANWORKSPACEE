import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { agentCapitalSummary, updateTradingProfile } from "@/lib/quidax/trading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    return NextResponse.json(await agentCapitalSummary(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to synchronize Agent Capital." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    await updateTradingProfile(userId, await req.json() as Record<string, unknown>);
    return NextResponse.json(await agentCapitalSummary(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Agent Capital." }, { status: 400 });
  }
}

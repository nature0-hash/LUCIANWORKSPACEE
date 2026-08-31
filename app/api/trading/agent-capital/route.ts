import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { agentCapitalSummary, updateTradingProfile } from "@/lib/coinbase/trading";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await agentCapitalSummary(await requireUserId()));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to synchronize Agent Capital." }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const userId = await requireUserId();
    await updateTradingProfile(userId, await req.json() as Record<string, unknown>);
    return NextResponse.json(await agentCapitalSummary(userId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Agent Capital." }, { status: 400 });
  }
}

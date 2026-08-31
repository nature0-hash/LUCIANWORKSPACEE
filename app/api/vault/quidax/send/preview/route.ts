import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { previewQuidaxSend } from "@/lib/quidax/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
  try {
    return NextResponse.json(await previewQuidaxSend(userId, await req.json() as Record<string, unknown>), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to preview Quidax send." }, { status: 400 });
  }
}

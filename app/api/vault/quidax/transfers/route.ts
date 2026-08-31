import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { listQuidaxTransfers } from "@/lib/quidax/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ transfers: await listQuidaxTransfers(await requireVaultOwner()) });
  } catch {
    return unauthorizedVaultResponse();
  }
}

import { NextResponse } from "next/server";
import { requireVaultOwner, unauthorizedVaultResponse } from "@/lib/auth/vault-ownership";
import { createReceiveAddress, listReceiveAddresses } from "@/lib/quidax/transfers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function owner(): Promise<string | Response> {
  try { return await requireVaultOwner(); } catch { return unauthorizedVaultResponse(); }
}

export async function GET() {
  const userId = await owner();
  if (userId instanceof Response) return userId;
  try {
    const addresses = await listReceiveAddresses(userId);
    return NextResponse.json({ addresses: addresses.map((row) => ({ id: row.id, asset: row.asset, network: row.network, address: row.address, label: row.label, createdAt: row.createdAt })) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load receive addresses." }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const userId = await owner();
  if (userId instanceof Response) return userId;
  try {
    return NextResponse.json({ address: await createReceiveAddress(userId, await req.json() as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to generate a receive address." }, { status: 400 });
  }
}

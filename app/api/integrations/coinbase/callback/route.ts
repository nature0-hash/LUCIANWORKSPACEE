import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/security/encryption";
import { COINBASE_API_BASE, exchangeCoinbaseCode, saveCoinbaseConnection } from "@/lib/coinbase/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const fallback = new URL("/markets?coinbase=failed", req.url);
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const jar = await cookies();
    const raw = jar.get("lucian_coinbase_oauth")?.value;
    jar.delete("lucian_coinbase_oauth");
    if (!code || !state || !raw) throw new Error("Invalid OAuth callback.");
    const saved = JSON.parse(decryptSecret(raw)) as { state: string; verifier: string; userId: string; createdAt: number };
    if (saved.state !== state || saved.userId !== userId || Date.now() - saved.createdAt > 600_000) throw new Error("OAuth state validation failed.");
    const redirectUri = process.env.COINBASE_REDIRECT_URI;
    if (!redirectUri) throw new Error("Coinbase redirect URI is missing.");
    const token = await exchangeCoinbaseCode(code, redirectUri, saved.verifier);
    const headers = { Authorization: `Bearer ${token.access_token}` };
    const [userResponse, portfoliosResponse] = await Promise.all([
      fetch(`${COINBASE_API_BASE}/v2/user`, { headers, cache: "no-store" }),
      fetch(`${COINBASE_API_BASE}/api/v3/brokerage/portfolios`, { headers, cache: "no-store" }),
    ]);
    const userPayload = userResponse.ok ? await userResponse.json() as { data?: { id?: string } } : {};
    const portfolioPayload = portfoliosResponse.ok ? await portfoliosResponse.json() as { portfolios?: Array<{ uuid?: string; type?: string }> } : {};
    const portfolio = portfolioPayload.portfolios?.find((p) => p.type === "DEFAULT") ?? portfolioPayload.portfolios?.[0];
    await saveCoinbaseConnection(userId, token, portfolio?.uuid, userPayload.data?.id);
    return NextResponse.redirect(new URL("/markets?coinbase=connected", req.url));
  } catch {
    return NextResponse.redirect(fallback);
  }
}

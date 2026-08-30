import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/security/encryption";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    const clientId = process.env.COINBASE_CLIENT_ID;
    const redirectUri = process.env.COINBASE_REDIRECT_URI;
    if (!clientId || !redirectUri || !process.env.COINBASE_CLIENT_SECRET) {
      return NextResponse.json({ error: "Coinbase OAuth environment variables are not configured." }, { status: 503 });
    }
    const state = randomBytes(24).toString("base64url");
    const verifier = randomBytes(64).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const jar = await cookies();
    jar.set("lucian_coinbase_oauth", encryptSecret(JSON.stringify({ state, verifier, userId, createdAt: Date.now() })), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600,
    });
    const scopes = process.env.COINBASE_OAUTH_SCOPES ?? "wallet:user:read,wallet:accounts:read,wallet:trades:read,wallet:trades:create,offline_access";
    const url = new URL(process.env.COINBASE_AUTHORIZE_URL ?? "https://login.coinbase.com/oauth2/auth");
    url.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: scopes, state, code_challenge: challenge, code_challenge_method: "S256" }).toString();
    return NextResponse.redirect(url);
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
}

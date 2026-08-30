import "server-only";
import { db } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";

const TOKEN_URL = process.env.COINBASE_TOKEN_URL ?? "https://login.coinbase.com/oauth2/token";
export const COINBASE_API_BASE = process.env.COINBASE_API_BASE_URL ?? "https://api.coinbase.com";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

function credentials() {
  const clientId = process.env.COINBASE_CLIENT_ID;
  const clientSecret = process.env.COINBASE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Coinbase OAuth is not configured.");
  return { clientId, clientSecret };
}

export async function exchangeCoinbaseCode(code: string, redirectUri: string, verifier: string): Promise<TokenResponse> {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code_verifier: verifier }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Coinbase authorization-code exchange failed.");
  return response.json() as Promise<TokenResponse>;
}

export async function saveCoinbaseConnection(userId: string, token: TokenResponse, portfolioId?: string, providerUserId?: string) {
  return db.exchangeConnection.upsert({
    where: { userId_provider: { userId, provider: "coinbase" } },
    create: {
      userId, provider: "coinbase", accessTokenEnc: encryptSecret(token.access_token),
      refreshTokenEnc: token.refresh_token ? encryptSecret(token.refresh_token) : null,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), scope: token.scope,
      portfolioId, providerUserId,
    },
    update: {
      state: "connected", accessTokenEnc: encryptSecret(token.access_token),
      refreshTokenEnc: token.refresh_token ? encryptSecret(token.refresh_token) : undefined,
      tokenExpiresAt: new Date(Date.now() + token.expires_in * 1000), scope: token.scope,
      portfolioId, providerUserId,
    },
  });
}

export async function coinbaseAccessToken(userId: string): Promise<{ token: string; portfolioId?: string }> {
  let connection = await db.exchangeConnection.findUnique({ where: { userId_provider: { userId, provider: "coinbase" } } });
  if (!connection || connection.state !== "connected") throw new Error("Coinbase is not connected.");
  if (connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return { token: decryptSecret(connection.accessTokenEnc), portfolioId: connection.portfolioId ?? undefined };
  }
  if (!connection.refreshTokenEnc) throw new Error("Coinbase connection must be re-authorized.");
  const { clientId, clientSecret } = credentials();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decryptSecret(connection.refreshTokenEnc), client_id: clientId, client_secret: clientSecret }),
    cache: "no-store",
  });
  if (!response.ok) {
    await db.exchangeConnection.update({ where: { id: connection.id }, data: { state: "reauthorization_required" } });
    throw new Error("Coinbase connection must be re-authorized.");
  }
  const refreshed = await response.json() as TokenResponse;
  connection = await db.exchangeConnection.update({
    where: { id: connection.id },
    data: {
      accessTokenEnc: encryptSecret(refreshed.access_token),
      refreshTokenEnc: refreshed.refresh_token ? encryptSecret(refreshed.refresh_token) : connection.refreshTokenEnc,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      scope: refreshed.scope ?? connection.scope,
    },
  });
  return { token: decryptSecret(connection.accessTokenEnc), portfolioId: connection.portfolioId ?? undefined };
}

export async function coinbaseFetch(userId: string, path: string, init?: RequestInit): Promise<Response> {
  const access = await coinbaseAccessToken(userId);
  return fetch(`${COINBASE_API_BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access.token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

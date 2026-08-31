import "server-only";

const DEFAULT_BASE_URL = "https://openapi.quidax.io/exchange-open-api/api/v1";

export const QUIDAX_API_BASE_URL = (process.env.QUIDAX_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");

export function isQuidaxConfigured(): boolean {
  return Boolean(process.env.QUIDAX_API_SECRET?.trim());
}

function secretKey(): string {
  const secret = process.env.QUIDAX_API_SECRET?.trim();
  if (!secret) {
    throw new Error("Quidax is not configured. Add QUIDAX_API_SECRET in Vercel before testing the connection.");
  }
  return secret;
}

/**
 * Server-only Quidax API client. Quidax documents its SecretKey as the value
 * for the Bearer Authorization header. The optional API-key identifier is
 * retained only for the operator's records; it is never sent to the browser.
 */
export async function quidaxFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!path.startsWith("/")) throw new Error("Quidax request paths must begin with '/'.");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${secretKey()}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${QUIDAX_API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}

/** Public market data endpoint; no credential is attached. */
export async function quidaxPublicFetch(path: string): Promise<Response> {
  if (!path.startsWith("/")) throw new Error("Quidax request paths must begin with '/'.");
  return fetch(`${QUIDAX_API_BASE_URL}${path}`, { headers: { Accept: "application/json" }, cache: "no-store" });
}

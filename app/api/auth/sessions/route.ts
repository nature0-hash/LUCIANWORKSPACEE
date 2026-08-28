// LUCIAN Phase 16 — Sessions endpoint (JWT-only, FINAL CORRECTED).
//
// GET /api/auth/sessions
// POST /api/auth/sessions  (revoke-others)
//
// Under the JWT session strategy (REQUIRED by the Auth.js Credentials
// provider), there is no per-session DB row to list or revoke. The
// user has exactly one JWT at a time, stored in an HttpOnly cookie.
// Logout = clear the cookie; the JWT cannot be reused afterwards.
//
// This endpoint HONESTLY reports that:
//   - GET  → returns a single "current session" entry (signed-in vs
//            not), with `strategy: "jwt"`. There are no other devices
//            to list because each browser holds its own JWT.
//   - POST → acknowledges the request and reports `revoked: 0`. Per-device
//            revocation is not supported under JWT. The user can sign
//            out the current session via /api/auth/signout (or the
//            Sign Out button in Settings → Account).
//
// We do NOT fabricate fake device rows. The Settings UI shows a
// message explaining the limitation.

import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { AuthError, toAuthError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    return errorResponse(err as AuthError);
  }

  try {
    // We don't need to read the cookie value — we just report that
    // the current session is active and the strategy is JWT. The
    // Settings UI explains this to the user honestly.
    const cookieHeader = req.headers.get("cookie") || "";
    const hasCookie = cookieHeader.includes("lucian.session-token");

    return NextResponse.json({
      ok: true,
      strategy: "jwt",
      sessions: hasCookie
        ? [
            {
              id: "current",
              label: "This browser session",
              createdAt: null, // unknown — JWT doesn't carry it
              expiresAt: null, // unknown — JWT has its own maxAge
              current: true,
              revocable: false, // can sign out via /api/auth/signout
            },
          ]
        : [],
      // Honestly report that per-device revocation is not available.
      revocationSupported: false,
      explanation:
        "Sessions are JWT-based (required by the Auth.js Credentials provider). " +
        "You can sign out the current browser session; per-device revocation is not available.",
    });
    void userId; // userId is the auth source-of-truth — we don't list other users' sessions
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

export async function POST(req: Request) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (err) {
    return errorResponse(err as AuthError);
  }
  void userId;
  void req;
  return NextResponse.json({
    ok: true,
    strategy: "jwt",
    revoked: 0,
    explanation:
      "Per-session revocation is not supported under the JWT strategy. " +
      "Use the Sign Out button to clear this browser's session cookie.",
  });
}

function errorResponse(err: AuthError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.message, code: err.code },
    { status: err.statusCode },
  );
}

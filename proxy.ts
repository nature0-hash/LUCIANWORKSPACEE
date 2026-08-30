// LUCIAN Phase 16 — Route protection PROXY (Next.js 16).
//
// Next.js 16 deprecated the `middleware` file convention in favor of
// `proxy`. This file is the exact migration of the former middleware.ts:
// identical matcher, identical route policy, identical Auth.js wrapping.
//
// WHY PROXY (and not just renaming):
//   - The previous middleware.ts imported the full Auth.js config
//     (`@/lib/auth/auth`), which transitively pulls in the Prisma client,
//     the @auth/prisma-adapter, and bcryptjs. Bundled for the EDGE
//     runtime that produced a ~1.04 MB `_middleware` Edge Function —
//     over Vercel's 1 MB plan limit (deployment blocker).
//   - The Next.js 16 `proxy` convention runs on the NODE.JS runtime.
//     Node-compatible modules (Prisma, bcryptjs) no longer get inlined
//     into a size-capped Edge bundle, so the Vercel Edge size limit no
//     longer applies to this interception layer.
//   - Security semantics are PRESERVED (not weakened): the session()
//     callback in auth.ts verifies the JWT's sessionVersion against the
//     database on every authenticated request — that DB check now runs
//     natively in the Node runtime instead of failing in Edge.
//
// Auth.js v5 uses the `auth` middleware factory. We export the wrapped
// proxy that:
//   1. Lets /api/auth/* and public technical routes pass through.
//   2. Redirects unauthenticated users from private LUCIAN routes to
//      /login (preserving the original URL as callbackUrl).
//   3. Redirects authenticated users from /login / /signup /
//      /forgot-password back to / (Home) — unless they explicitly
//      request the recovery page via ?redirect=reset.
//
// Avoid redirect loops by maintaining a clear matcher + per-route logic.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";

const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/health",
];

const AUTH_PAGES = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

function isPathUnderPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix + "/");
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  // CRITICAL: must check req.auth?.user?.id (NOT just req.auth) because
  // the session() callback in auth.ts returns a session object even
  // when the JWT is stale (sessionVersion mismatch) — it clears
  // session.user.id to signal "unauthenticated". Checking only req.auth
  // would let stale JWTs through.
  const isAuthed = !!req.auth?.user?.id;
  const isApi = pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/") && !pathname.startsWith("/api/health");

  // Public technical routes (OAuth callbacks, webhooks, health) — always pass.
  if (
    isPathUnderPrefix(pathname, "/api/auth") ||
    isPathUnderPrefix(pathname, "/api/health") ||
    isPathUnderPrefix(pathname, "/api/vault/webhooks")
  ) {
    return NextResponse.next();
  }

  // Auth pages — redirect authed users to Home unless they're actively
  // performing a recovery (we look at the search string for `?token=`
  // on /reset-password so deep links to a reset don't bounce).
  if (AUTH_PAGES.has(pathname)) {
    if (isAuthed && !(pathname === "/reset-password" && search.includes("token="))) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Public routes (technical routes served statically) — pass.
  // No app routes are public-only beyond auth pages and the API prefixes
  // already handled above.

  // All other routes require auth.
  // For API calls, return a 401 JSON response so the client can handle
  // it gracefully (rather than receiving a redirect to /login).
  if (!isAuthed) {
    if (isApi) {
      return new NextResponse(
        JSON.stringify({ ok: false, error: "You must be signed in.", code: "unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Run on every navigable route except:
  //   - _next/static, _next/image, favicon, branding, sw.js
  //   - public assets (they're served directly by Next.js)
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|apple-icon.png|icon.png|branding|sw.js|manifest.json).*)",
  ],
};

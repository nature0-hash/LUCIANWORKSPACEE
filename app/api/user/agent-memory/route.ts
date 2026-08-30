// LUCIAN Phase 16 — User agent memory API (persistent user-level memory).
//
// GET  /api/user/agent-memory?scope=...  → list memory entries
// PUT  /api/user/agent-memory             → upsert a (scope, key) → value
// DELETE /api/user/agent-memory?id=...    → delete a single entry
//
// Scoped by the authenticated user's id. `scope` defaults to "user".
// Project-scoped memory is NOT migrated here — DevWorkspace project
// files stay in IndexedDB.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { AuthError, badRequest, toAuthError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  try {
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") ?? undefined;
    const entries = await db.agentMemory.findMany({
      where: { userId, ...(scope ? { scope } : {}) },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ ok: true, entries });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

interface PutBody {
  scope?: unknown;
  key?: unknown;
  value?: unknown;
}

export async function PUT(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  let body: PutBody;
  try { body = await req.json() as PutBody; }
  catch { return errorResponse(badRequest("Invalid body.")); }

  const scope = String(body.scope ?? "user");
  const key = String(body.key ?? "");
  const value = String(body.value ?? "");
  if (!key) return errorResponse(badRequest("key is required."));

  try {
    const entry = await db.agentMemory.upsert({
      where: { userId_scope_key: { userId, scope, key } },
      create: { userId, scope, key, value },
      update: { value },
    });
    return NextResponse.json({ ok: true, entry });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

export async function DELETE(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (id) {
      const entry = await db.agentMemory.findFirst({ where: { id, userId }, select: { id: true } });
      if (!entry) return errorResponse(badRequest("Entry not found."));
      await db.agentMemory.delete({ where: { id } });
    } else {
      const scope = url.searchParams.get("scope");
      await db.agentMemory.deleteMany({
        where: { userId, ...(scope ? { scope } : {}) },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

function errorResponse(err: AuthError): NextResponse {
  return NextResponse.json(
    { ok: false, error: err.message, code: err.code },
    { status: err.statusCode },
  );
}

// LUCIAN Phase 16 — User chat by id (single conversation + messages).
//
// GET    /api/user/chats/:id       → fetch conversation + all messages
// POST   /api/user/chats/:id       → append a new message to the conversation
// PATCH  /api/user/chats/:id       → update title
// DELETE /api/user/chats/:id       → delete the conversation (cascades to messages)
//
// All scoped by the authenticated user's id — a user can only see/modify
// their own conversations.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";
import { AuthError, badRequest, unauthorized, toAuthError } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";

interface ChatParams { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: ChatParams) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  const { id } = await params;
  try {
    const conversation = await db.chatConversation.findFirst({
      where: { id, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) return errorResponse(unauthorized());
    return NextResponse.json({ ok: true, conversation });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

interface AppendMessageBody {
  role?: unknown;       // user | assistant | system | tool
  content?: unknown;
  model?: unknown;
  provider?: unknown;
  messageId?: unknown;  // stable client-supplied dedupe id
}

export async function POST(req: Request, { params }: ChatParams) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  const { id } = await params;
  let body: AppendMessageBody;
  try { body = await req.json() as AppendMessageBody; }
  catch { return errorResponse(badRequest("Invalid body.")); }

  const role = String(body.role ?? "user");
  const content = String(body.content ?? "");
  const messageId =
    typeof body.messageId === "string" && body.messageId.trim()
      ? body.messageId.trim()
      : null;
  if (!content) return errorResponse(badRequest("content is required."));

  try {
    // Verify ownership before appending — findFirst with userId scope.
    const conv = await db.chatConversation.findFirst({ where: { id, userId }, select: { id: true } });
    if (!conv) return errorResponse(unauthorized());

    // Dedupe by (conversationId, messageId) so a retry returns the
    // existing message instead of creating a duplicate.
    if (messageId) {
      const existing = await db.chatMessage.findUnique({
        where: { conversationId_messageId: { conversationId: id, messageId } },
        select: { id: true, role: true, content: true, model: true, provider: true, createdAt: true, messageId: true },
      });
      if (existing) {
        return NextResponse.json({ ok: true, message: existing });
      }
    }

    const message = await db.chatMessage.create({
      data: {
        conversationId: id, role, content,
        messageId,
        model: body.model === undefined ? null : String(body.model),
        provider: body.provider === undefined ? null : String(body.provider),
      },
    });
    // Touch the conversation's updatedAt so list re-sorts.
    await db.chatConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

interface PatchBody { title?: unknown; }

export async function PATCH(req: Request, { params }: ChatParams) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  const { id } = await params;
  let body: PatchBody;
  try { body = await req.json() as PatchBody; }
  catch { return errorResponse(badRequest("Invalid body.")); }

  const title = String(body.title ?? "");
  if (!title) return errorResponse(badRequest("title is required."));

  try {
    const conv = await db.chatConversation.findFirst({ where: { id, userId }, select: { id: true } });
    if (!conv) return errorResponse(unauthorized());
    const updated = await db.chatConversation.update({ where: { id }, data: { title } });
    return NextResponse.json({ ok: true, conversation: updated });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

export async function DELETE(_req: Request, { params }: ChatParams) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  const { id } = await params;
  try {
    const conv = await db.chatConversation.findFirst({ where: { id, userId }, select: { id: true } });
    if (!conv) return errorResponse(unauthorized());
    await db.chatConversation.delete({ where: { id } });
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

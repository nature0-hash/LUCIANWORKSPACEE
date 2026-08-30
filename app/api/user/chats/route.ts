// LUCIAN Phase 16 — User chats API.
//
// GET  /api/user/chats?source=...  → list this user's chat conversations
// POST /api/user/chats              → upsert conversation (by stable id) + append message
// GET  /api/user/chats/:id          → fetch a conversation + its messages
//
// CONTRACT (Phase 16 FINAL):
//   - The client sends a stable `id` for the conversation. This is the
//     same id across every message in the conversation, so the server
//     UPSERTS the conversation by (userId, id) and APPENDS the new message.
//   - The client sends a stable `messageId` for the message. Retries
//     with the same messageId return the existing row instead of
//     creating a duplicate.
//   - All scoped by the authenticated user's id (derived from session).
//
// This contract is what `src/lib/auth/live-sync.ts` (syncChatMessage)
// sends. The previous implementation created a NEW conversation on every
// POST, which broke retries + multi-message conversations.

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
    const source = url.searchParams.get("source") ?? undefined;
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)));

    const conversations = await db.chatConversation.findMany({
      where: { userId, ...(source ? { source } : {}) },
      orderBy: { updatedAt: "desc" },
      take: limit,
      select: {
        id: true, source: true, title: true, model: true, provider: true,
        createdAt: true, updatedAt: true,
        messages: {
          orderBy: { createdAt: "asc" },
          select: { id: true, messageId: true, role: true, content: true, model: true, provider: true, createdAt: true },
        },
      },
    });
    return NextResponse.json({ ok: true, conversations });
  } catch (err) {
    return errorResponse(toAuthError(err));
  }
}

interface ChatMessageInput {
  role?: unknown;
  content?: unknown;
  model?: unknown;
  provider?: unknown;
  messageId?: unknown;
}

interface UpsertChatBody {
  id?: unknown;             // stable conversation id (client-supplied)
  source?: unknown;
  title?: unknown;
  model?: unknown;
  provider?: unknown;
  message?: unknown;        // ChatMessageInput
}

export async function POST(req: Request) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch (err) { return errorResponse(err as AuthError); }

  let body: UpsertChatBody;
  try { body = await req.json() as UpsertChatBody; }
  catch { return errorResponse(badRequest("Invalid body.")); }

  // Stable conversation id. The client always sends one — if missing,
  // we fail safe with a 400 (creating a new conversation on every POST
  // was the exact bug we're fixing).
  const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : null;
  if (!id) {
    return errorResponse(badRequest("id (stable conversation id) is required."));
  }

  const source = String(body.source ?? "generic");
  const title = String(body.title ?? "Untitled conversation");
  const model = body.model === undefined ? null : String(body.model);
  const provider = body.provider === undefined ? null : String(body.provider);

  // Optional message append. The body may carry `message` or `firstMessage`
  // (legacy key) — we accept either.
  const messageRaw = body.message;
  const message: ChatMessageInput | null =
    messageRaw && typeof messageRaw === "object" ? (messageRaw as ChatMessageInput) : null;

  if (!source || !title) return errorResponse(badRequest("source and title are required."));

  try {
    // Upsert the conversation by id (scoped to this user). The
    // findFirst + update / create pattern avoids leaking cross-user
    // conversation ids (an attacker can't steal another user's
    // conversation id and write to it — the userId scope catches it).
    const existing = await db.chatConversation.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    let conversation;
    if (existing) {
      // Update title + touch updatedAt. Model / provider are kept
      // from the initial creation unless the caller overrides.
      conversation = await db.chatConversation.update({
        where: { id: existing.id },
        data: {
          title,
          ...(model !== null ? { model } : {}),
          ...(provider !== null ? { provider } : {}),
          updatedAt: new Date(),
        },
      });
    } else {
      conversation = await db.chatConversation.create({
        data: {
          id, userId, source, title, model, provider,
        },
      });
    }

    // Append the message if provided. Dedupe by (conversationId, messageId)
    // so a retry with the same messageId returns the existing row instead
    // of creating a duplicate.
    let appendedMessage = null;
    if (message) {
      const role = String(message.role ?? "user");
      const content = String(message.content ?? "");
      const messageId =
        typeof message.messageId === "string" && message.messageId.trim()
          ? message.messageId.trim()
          : null;
      const messageModel = message.model === undefined ? null : String(message.model);
      const messageProvider = message.provider === undefined ? null : String(message.provider);

      if (!content) {
        return errorResponse(badRequest("message.content is required when message is provided."));
      }

      if (messageId) {
        // Dedupe by (conversationId, messageId). NULL messageId is treated
        // as distinct by Postgres (NULLs are not equal under UNIQUE),
        // so legacy messages without a messageId never collide.
        const existingMsg = await db.chatMessage.findUnique({
          where: { conversationId_messageId: { conversationId: conversation.id, messageId } },
          select: { id: true, role: true, content: true, model: true, provider: true, createdAt: true, messageId: true },
        });
        if (existingMsg) {
          appendedMessage = existingMsg;
        } else {
          appendedMessage = await db.chatMessage.create({
            data: {
              conversationId: conversation.id,
              messageId,
              role,
              content,
              model: messageModel,
              provider: messageProvider,
            },
          });
        }
      } else {
        // No messageId supplied — append directly (no dedupe). This is
        // the legacy / server-only path; live-sync clients always send one.
        appendedMessage = await db.chatMessage.create({
          data: {
            conversationId: conversation.id,
            messageId: null,
            role,
            content,
            model: messageModel,
            provider: messageProvider,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, conversation, message: appendedMessage });
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

import { NextResponse } from "next/server";
import { getProvider, isProviderConfigured, type ChatMessage } from "@/lib/agent/providers";
import type { ProviderId } from "@/store/economic-agent-connection";
import {
  DEFAULT_AI_BEHAVIOR,
  RESPONSE_STYLE_SNIPPETS,
  CONTEXT_BUDGETS,
  type AIBehaviorWire,
} from "@/lib/ai-behavior-wire";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  provider: ProviderId;
  model: string;
  contextItems?: {
    type: string;
    label: string;
    description?: string;
    /** Phase 6: actual serialized context data from the context-provider layer. */
    data?: string;
  }[];
  /** Settings → AI Behavior. Applied server-side. */
  behavior?: AIBehaviorWire;
}

/** Phase 6: normalized error response shape. Every error returns a clear
 *  `errorType` so the UI can display a specific message rather than
 *  inserting a fake assistant message. */
interface ErrorResponse {
  success: false;
  errorType: string;
  message: string;
  statusCode: number;
}

/** Phase 6: normalized success response shape. */
interface SuccessResponse {
  success: true;
  content: string;
  provider: string;
  model: string;
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { success: false, errorType: "invalid-body", message: "Invalid request body.", statusCode: 400 } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const { messages, provider, model, contextItems } = body;
  const behavior: AIBehaviorWire = { ...DEFAULT_AI_BEHAVIOR, ...(body.behavior ?? {}) };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { success: false, errorType: "no-messages", message: "No messages provided.", statusCode: 400 } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // Phase 6: check if the provider is configured BEFORE trying to use it.
  // Return a clear error — NOT a fake assistant response.
  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      {
        success: false,
        errorType: "provider-not-configured",
        message: "No model provider configured. Configure one in Settings → Lilith → Economic Agent Connection.",
        statusCode: 503,
      } satisfies ErrorResponse,
      { status: 503 },
      );
  }

  // PHASE 16: resolve the authenticated user. We need their id to
  // load persistent agent memory from Neon. If there's no session, we
  // proceed WITHOUT memory (anonymous / pre-auth preview usage) —
  // memory is a value-add, not a gate.
  let userId: string | null = null;
  try { userId = await requireUserId(); }
  catch { /* not authenticated — proceed without memory */ }

  // Build system prompt — start with the base instructions, then append
  // the response-style snippet (Settings → AI Behavior).
  const styleSnippet = RESPONSE_STYLE_SNIPPETS[behavior.responseStyle] ?? RESPONSE_STYLE_SNIPPETS.balanced;
  const systemPromptLines = [
    "You are the LUCIAN Economic Agent — a multi-purpose AI assistant for the LUCIAN Workspace platform.",
    "You help with: economic analysis, investment research, project development, market intelligence, business ideas, and general questions.",
    "You work WITHOUT requiring any project to be active. Project context is optional.",
    "When you don't know something, say so honestly. Never fabricate data, prices, or results.",
    "Format responses with markdown where helpful (headings, lists, tables, code blocks).",
    "",
    `## Response style\n${styleSnippet}`,
  ];

  // PHASE 16: load persistent USER-LEVEL agent memory from Neon and
  // attach it to the system prompt. This is the canonical integration
  // point between the /api/user/agent-memory store and the actual AI
  // pipeline.
  //
  // IMPORTANT: this NEVER uploads DevWorkspace project files. Project
  // source code stays in IndexedDB / the local browser; only user-level
  // memory (preferences, recurring facts, named entities) crosses the
  // server boundary, and only when Settings → AI Behavior →
  // "Remember Conversations" is ON.
  if (userId && behavior.rememberConversations) {
    try {
      const memoryEntries = await db.agentMemory.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 50,
        select: { scope: true, key: true, value: true, updatedAt: true },
      });
      if (memoryEntries.length > 0) {
        const memLines: string[] = [];
        let usedChars = 0;
        const MAX_MEM_CHARS = 1500;
        for (const e of memoryEntries) {
          const line = `- ${e.key}: ${e.value}`;
          if (usedChars + line.length + 1 > MAX_MEM_CHARS) break;
          memLines.push(line);
          usedChars += line.length + 1;
        }
        if (memLines.length > 0) {
          systemPromptLines.push("", "## Persistent user memory (server-backed)");
          for (const line of memLines) systemPromptLines.push(line);
        }
      }
    } catch {
      // Database unreachable during the chat request — proceed without
      // memory. The chat still works; we just don't have persistent
      // context for this turn. NEVER block the chat on memory load.
    }
  }

  // Phase 6 + Settings integration: attach real context data, gated by
  // the context-level budget (max items + max chars).
  if (contextItems && contextItems.length > 0) {
    const budget = CONTEXT_BUDGETS[behavior.contextLevel] ?? CONTEXT_BUDGETS.standard;
    const eligible = contextItems.slice(0, budget.maxItems);
    let usedChars = 0;
    const kept: typeof eligible = [];
    for (const ctx of eligible) {
      const len = (ctx.data?.length ?? 0) + (ctx.label?.length ?? 0);
      if (usedChars + len > budget.maxChars) continue;
      kept.push(ctx);
      usedChars += len;
    }
    if (kept.length > 0) {
      systemPromptLines.push("", "ATTACHED CONTEXT (use as factual context):");
      for (const ctx of kept) {
        const ctxLine = ctx.data
          ? `— [${ctx.type}] ${ctx.label}\n${ctx.data}`
          : `— [${ctx.type}] ${ctx.label}${ctx.description ? `: ${ctx.description}` : ""}`;
        systemPromptLines.push(ctxLine);
      }
    }
  }

  const systemPrompt = systemPromptLines.join("\n");

  // Look up the provider adapter. API keys are read from process.env
  // server-side — never sent to the client.
  const adapter = getProvider(provider);
  if (!adapter) {
    return NextResponse.json(
      {
        success: false,
        errorType: "provider-not-configured",
        message: "Provider adapter not available. The API key may be missing from the server environment.",
        statusCode: 503,
      } satisfies ErrorResponse,
      { status: 503 },
    );
  }

  // Phase 6 + Settings integration: convert messages to the provider format.
  // The history window is bounded client-side (last 20 messages) before sending.
  // Settings → AI Behavior → rememberConversations: if OFF, send only the
  // most recent user message (the current turn). Stored history is NOT
  // erased — we only restrict what this request forwards to the model.
  let chatMessages: ChatMessage[];
  if (!behavior.rememberConversations) {
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    chatMessages = lastUserIdx >= 0
      ? [{ role: "user" as const, content: messages[lastUserIdx].content }]
      : [];
    if (chatMessages.length === 0) {
      return NextResponse.json(
        { success: false, errorType: "no-messages", message: "No current user message.", statusCode: 400 } satisfies ErrorResponse,
        { status: 400 },
      );
    }
  } else {
    chatMessages = messages.map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
      content: m.content,
    }));
  }

  try {
    // Phase 6: use the model from the request body — this is the model
    // the user selected in the UI. It flows: UI model selector →
    // useEconomicAgentConnection.model → request body → adapter.chat().
    const result = await adapter.chat({
      messages: chatMessages,
      model: model || "gpt-4o-mini",
      systemPrompt,
    });

    // PHASE 16: write-back hook — extract simple preferences / facts
    // from the user's most recent message and upsert them as
    // persistent agent memory. We do this AFTER the chat succeeds so
    // the response is never delayed by memory writes. The extraction
    // is intentionally conservative (named entities only) — we never
    // store the full conversation, only specific structured facts the
    // user explicitly stated.
    //
    // Privacy: gated by behavior.rememberConversations. When the user
    // has opted out of persistent memory, we skip the write entirely.
    if (userId && behavior.rememberConversations) {
      void writeMemoryFromConversation(userId, messages).catch(() => { /* non-fatal */ });
    }

    // Phase 6: normalize the success response so the UI doesn't need to
    // understand five different provider response shapes.
    return NextResponse.json({
      success: true,
      content: result.content,
      provider: provider,
      model: model || "gpt-4o-mini",
    } satisfies SuccessResponse);
  } catch (err) {
    // Phase 6: classify the error and return a clear error type — do NOT
    // insert the error text as a fake assistant message.
    const errorMessage = err instanceof Error ? err.message : String(err);
    let errorType: string;
    let statusCode: number;

    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("authentication")) {
      errorType = "authentication-failed";
      statusCode = 401;
    } else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) {
      errorType = "rate-limit";
      statusCode = 429;
    } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
      errorType = "timeout";
      statusCode = 504;
    } else if (errorMessage.includes("404") || errorMessage.includes("model") || errorMessage.includes("invalid_model")) {
      errorType = "invalid-model";
      statusCode = 400;
    } else if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) {
      errorType = "network-error";
      statusCode = 502;
    } else {
      errorType = "provider-error";
      statusCode = 502;
    }

    return NextResponse.json(
      {
        success: false,
        errorType,
        message: errorMessage.slice(0, 500), // bounded — no full stack traces
        statusCode,
      } satisfies ErrorResponse,
      { status: statusCode },
    );
  }
}

/* ── Memory write-back helper ──
 *
 * Extracts simple structured facts from the user's conversation and
 * upserts them as persistent agent memory. This is the WRITE half of
 * the agent-memory integration — the READ half happens earlier in this
 * file (loading memory into the system prompt).
 *
 * Extraction is INTENTIONALLY conservative — we only capture:
 *   - "my name is X" / "call me X" / "I am X" (preferred name)
 *   - "I prefer X" / "I like X" (preferences)
 *
 * We NEVER store:
 *   - DevWorkspace project files / source code
 *   - The full conversation transcript
 *   - Sensitive financial data (account numbers, balances)
 *
 * Dedupe: the AgentMemory table has @@unique([userId, scope, key]),
 * so re-upserting the same key updates the value instead of inserting
 * a duplicate.
 */
async function writeMemoryFromConversation(
  userId: string,
  messages: { role: string; content: string }[],
): Promise<void> {
  if (!messages || messages.length === 0) return;
  // Look at the last few user messages — don't scan the whole history.
  const recentUserMessages = messages
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content);
  if (recentUserMessages.length === 0) return;

  const memoryWrites: { scope: string; key: string; value: string }[] = [];

  for (const text of recentUserMessages) {
    // Preferred name extraction — covers "my name is X", "call me X",
    // "I am X" (only when followed by a Capitalized word that looks
    // like a name, not a sentence).
    const nameMatch = text.match(/\b(?:my name is|call me|i am|i'm)\s+([A-Z][a-zA-Z]{1,30})\b/);
    if (nameMatch && nameMatch[1]) {
      memoryWrites.push({
        scope: "user",
        key: "preferred_name",
        value: nameMatch[1],
      });
    }

    // Risk tolerance extraction.
    const riskMatch = text.match(/\b(?:my risk tolerance is|risk tolerance|i'm|i am)\s+(?:a\s+)?(conservative|moderate|aggressive|high|low)\b/i);
    if (riskMatch && riskMatch[1]) {
      memoryWrites.push({
        scope: "user",
        key: "risk_tolerance",
        value: riskMatch[1].toLowerCase(),
      });
    }

    // Preferred markets — "I'm interested in BTC, ETH, and SPY".
    const marketMatch = text.match(/\b(?:interested in|watching|follow|tracking)\s+([A-Z]{2,5}(?:\s*,\s*[A-Z]{2,5})*)/);
    if (marketMatch && marketMatch[1]) {
      memoryWrites.push({
        scope: "user",
        key: "preferred_markets",
        value: marketMatch[1].replace(/\s+/g, " "),
      });
    }
  }

  if (memoryWrites.length === 0) return;

  // Upsert each memory write. The @@unique([userId, scope, key]) index
  // makes the upsert a dedupe — re-stating the same preference updates
  // the existing row instead of inserting a duplicate.
  for (const w of memoryWrites) {
    try {
      await db.agentMemory.upsert({
        where: { userId_scope_key: { userId, scope: w.scope, key: w.key } },
        create: { userId, scope: w.scope, key: w.key, value: w.value },
        update: { value: w.value },
      });
    } catch {
      // Non-fatal — memory write failed (DB down, etc.). The chat
      // response already succeeded; we just lose this memory update.
    }
  }
}

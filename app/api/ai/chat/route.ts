import { NextResponse } from "next/server";
import { getProvider, isProviderConfigured, type ChatMessage } from "@/lib/agent/providers";
import { loadAgentMemorySection, writeMemoryFromConversation } from "@/lib/agent/memory";
import { requireUserId } from "@/lib/auth/session";
import { requireVaultOwner } from "@/lib/auth/vault-ownership";
import type { ProviderId } from "@/store/shared-ai-config";
import { agentCapitalSummary, executeLiveTrade, previewLiveTrade, updateTradingProfile } from "@/lib/quidax/trading";
import {
  DEFAULT_AI_BEHAVIOR,
  RESPONSE_STYLE_SNIPPETS,
  CONTEXT_BUDGETS,
  type AIBehaviorWire,
} from "@/lib/ai-behavior-wire";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Phase 7: shared chat request shape used by both Economic Agent and Lilith. */
interface SharedChatRequest {
  messages: { role: string; content: string }[];
  provider: ProviderId;
  model: string;
  systemPrompt: string;
  /** Optional context items with real serialized data. */
  contextItems?: {
    type: string;
    label: string;
    description?: string;
    data?: string;
  }[];
  /** Settings → AI Behavior. Applied server-side so the client cannot
   *  be tricked into overriding them, and so all interfaces get the
   *  same behavior. */
  behavior?: AIBehaviorWire;
}

interface ErrorResponse {
  success: false;
  errorType: string;
  message: string;
  statusCode: number;
}

interface SuccessResponse {
  success: true;
  content: string;
  provider: string;
  model: string;
}

export async function POST(req: Request) {
  let body: SharedChatRequest;
  try {
    body = (await req.json()) as SharedChatRequest;
  } catch {
    return NextResponse.json(
      { success: false, errorType: "invalid-body", message: "Invalid request body.", statusCode: 400 } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const { messages, provider, model, systemPrompt, contextItems } = body;
  const behavior: AIBehaviorWire = {
    ...DEFAULT_AI_BEHAVIOR,
    ...(body.behavior ?? {}),
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { success: false, errorType: "no-messages", message: "No messages provided.", statusCode: 400 } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  if (!isProviderConfigured(provider)) {
    return NextResponse.json(
      { success: false, errorType: "provider-not-configured", message: "No model provider configured. Configure one in Settings → Lilith → Economic Agent Connection.", statusCode: 503 } satisfies ErrorResponse,
      { status: 503 },
    );
  }

  // ── Apply AI Behavior (server-side enforcement) ──
  // 1. Response style → small instruction snippet prepended to the system prompt.
  const styleSnippet = RESPONSE_STYLE_SNIPPETS[behavior.responseStyle] ?? RESPONSE_STYLE_SNIPPETS.balanced;
  let fullSystemPrompt = `${systemPrompt}\n\n## Response style\n${styleSnippet}`;

  // Phase 17: load persistent USER-LEVEL agent memory from Neon and
  // attach it to the system prompt. This is the canonical integration
  // point between the /api/user/agent-memory store and the shared AI
  // chat pipeline.
  //
  // IMPORTANT: this NEVER uploads DevWorkspace project files. Project
  // source code stays in IndexedDB / the local browser; only user-level
  // memory (preferences, recurring facts, named entities) crosses the
  // server boundary, and only when Settings → AI Behavior →
  // "Remember Conversations" is ON.
  //
  // Auth is NON-BLOCKING — if the user is not authenticated (e.g. using
  // a public endpoint), the chat proceeds without memory. This preserves
  // backward compatibility with existing unauthenticated callers.
  let authenticatedUserId: string | null = null;
  try {
    authenticatedUserId = await requireUserId();
  } catch {
    // Not authenticated — continue without memory. The chat still works.
    authenticatedUserId = null;
  }
  if (authenticatedUserId && behavior.rememberConversations) {
    const memorySection = await loadAgentMemorySection(authenticatedUserId);
    if (memorySection) {
      fullSystemPrompt += `\n\n${memorySection}`;
    }
  }

  // Real-money commands use a deterministic server-side parser rather than
  // trusting free-form model output. Every new order is previewed; execution
  // requires the user to send the returned confirmation id in a later turn.
  if (authenticatedUserId) {
    const latestUserText = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    try {
      const tradingReply = await handleTradingCommand(authenticatedUserId, latestUserText);
      if (tradingReply) {
        return NextResponse.json({ success: true, content: tradingReply, provider: "lucian-trading", model: "quidax" } satisfies SuccessResponse);
      }
      // Give the Economic Agent read-only account context. It can explain the
      // full balance and its own smaller permission envelope without secrets.
      const capital = await agentCapitalSummary(authenticatedUserId);
      fullSystemPrompt += `\n\n## Quidax trading account (server-authoritative)\nQuidax ${capital.quoteCurrency} available: ${capital.actualUsdAvailable.toFixed(2)} ${capital.quoteCurrency}\nAgent Capital allocation: ${capital.profile.allocationUsd.toFixed(2)} ${capital.quoteCurrency}\nAgent Capital currently available: ${capital.availableAgentUsd.toFixed(2)} ${capital.quoteCurrency}\nAgent permission mode: ${capital.profile.permissionMode}\nEmergency stop: ${capital.profile.emergencyStop ? "ON" : "off"}\nNever claim a trade occurred unless LUCIAN returns a Quidax confirmation. Live and AI trading can be server-disabled even when a Quidax balance is visible.`;
    } catch (error) {
      if (looksLikeTradingCommand(latestUserText)) {
        return NextResponse.json({
          success: true,
          content: `I did **not** prepare or execute a trade. ${error instanceof Error ? error.message : "The server rejected the command."}`,
          provider: "lucian-trading",
          model: "quidax",
        } satisfies SuccessResponse);
      }
      // Quidax may be intentionally unconfigured. Normal Economic Agent
      // chat remains available without financial context.
    }
  }

  // 2. Context level → budget (max items + max chars). Items are kept in
  //    their original order; we drop any that would exceed the budget.
  //    Phase 17: if behavior.allowProjectContext is OFF, drop context
  //    items that look like project files (type starts with "project"
  //    or "file"). This is the server-side enforcement of the Project
  //    Agent project-context permission — the client cannot bypass it.
  const budget = CONTEXT_BUDGETS[behavior.contextLevel] ?? CONTEXT_BUDGETS.standard;
  const filteredContext = behavior.allowProjectContext
    ? (contextItems ?? [])
    : (contextItems ?? []).filter(
        (ctx) => !/^(project|file|workspace|devspace)/i.test(ctx.type),
      );
  const eligibleContext = filteredContext.slice(0, budget.maxItems);
  let usedChars = 0;
  const keptContext: typeof eligibleContext = [];
  for (const ctx of eligibleContext) {
    const len = (ctx.data?.length ?? 0) + (ctx.label?.length ?? 0);
    if (usedChars + len > budget.maxChars) continue;
    keptContext.push(ctx);
    usedChars += len;
  }

  if (keptContext.length > 0) {
    fullSystemPrompt += "\n\nATTACHED CONTEXT (use as factual context):";
    for (const ctx of keptContext) {
      const ctxLine = ctx.data
        ? `— [${ctx.type}] ${ctx.label}\n${ctx.data}`
        : `— [${ctx.type}] ${ctx.label}${ctx.description ? `: ${ctx.description}` : ""}`;
      fullSystemPrompt += `\n${ctxLine}`;
    }
  }

  // 3. Remember conversations: if OFF, drop all but the most recent user
  //    message + the system prompt. We do NOT erase stored history on
  //    the client — we only restrict what the server forwards to the
  //    model for THIS request.
  let chatMessages: ChatMessage[];
  if (!behavior.rememberConversations) {
    // Keep only the last user message (the current turn). Assistant
    // history and earlier user turns are dropped for this request.
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

  const adapter = getProvider(provider);
  if (!adapter) {
    return NextResponse.json(
      { success: false, errorType: "provider-not-configured", message: "Provider adapter not available.", statusCode: 503 } satisfies ErrorResponse,
      { status: 503 },
    );
  }

  try {
    const result = await adapter.chat({
      messages: chatMessages,
      model: model || "gpt-4o-mini",
      systemPrompt: fullSystemPrompt,
    });
    // Phase 17: write-back persistent agent memory from the user's
    // recent messages. Non-blocking — the response already succeeded;
    // a memory write failure is silently swallowed. Gated by
    // rememberConversations (don't extract facts when the user has
    // disabled conversation memory).
    if (authenticatedUserId && behavior.rememberConversations) {
      void writeMemoryFromConversation(authenticatedUserId, messages).catch(() => { /* non-fatal */ });
    }
    return NextResponse.json({
      success: true, content: result.content, provider, model: model || "gpt-4o-mini",
    } satisfies SuccessResponse);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    let errorType: string;
    let statusCode: number;
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized") || errorMessage.includes("authentication")) { errorType = "authentication-failed"; statusCode = 401; }
    else if (errorMessage.includes("429") || errorMessage.includes("rate limit")) { errorType = "rate-limit"; statusCode = 429; }
    else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) { errorType = "timeout"; statusCode = 504; }
    else if (errorMessage.includes("404") || errorMessage.includes("model") || errorMessage.includes("invalid_model")) { errorType = "invalid-model"; statusCode = 400; }
    else if (errorMessage.includes("fetch") || errorMessage.includes("network") || errorMessage.includes("ECONNREFUSED")) { errorType = "network-error"; statusCode = 502; }
    else { errorType = "provider-error"; statusCode = 502; }
    return NextResponse.json(
      { success: false, errorType, message: errorMessage.slice(0, 500), statusCode } satisfies ErrorResponse,
      { status: statusCode },
    );
  }
}

function looksLikeTradingCommand(text: string): boolean {
  const value = text.trim();
  if (!value || value.endsWith("?") || /^(should|could|can|would|what|why|how|is|are)\b/i.test(value)) return false;
  if (/^(?:please\s+)?(?:buy|purchase|sell|confirm|execute|approve|allocate|set\s+aside|handle\s+(?:the\s+)?trades?\s+with|trade\s+with)\b/i.test(value)) return true;
  return /^use\b/i.test(value) && /\$\d|\b(agent capital|trad(?:e|ing|es))\b/i.test(value);
}

async function handleTradingCommand(userId: string, raw: string): Promise<string | null> {
  const text = raw.trim();
  if (!text || /^(should|could|can|would|what|why|how|is|are)\b/i.test(text) || text.endsWith("?")) return null;
  if (userId !== await requireVaultOwner()) throw new Error("Only the LUCIAN Vault owner can prepare or confirm a Quidax trade.");
  const quoteCurrency = (process.env.QUIDAX_TRADING_QUOTE_CURRENCY ?? "NGN").trim().toUpperCase() === "USDT" ? "USDT" : "NGN";

  const confirm = text.match(/^(?:confirm|execute|approve)(?:\s+(?:the\s+)?trade)?\s+([a-z0-9]{20,40})$/i);
  if (confirm) {
    const result = await executeLiveTrade(userId, confirm[1]);
    const orderId = (result as { orderId?: string }).orderId ?? "submitted";
    return `Trade submitted to Quidax successfully.\n\n- Order: \`${orderId}\`\n- Audit intent: \`${result.intentId}\`\n\nLUCIAN will reconcile the confirmed Quidax order in Agent Capital.`;
  }

  const allocation = text.match(/\b(?:allocate|set\s+aside|use|handle\s+(?:the\s+)?trades?\s+with|trade\s+with)\s+(?:[$₦]|NGN\s*)?(\d+(?:\.\d{1,2})?)\b/i);
  if (allocation && /\b(agent|capital|trad(?:e|ing|es)|this)\b/i.test(text)) {
    const summary = await updateTradingProfile(userId, { allocationUsd: Number(allocation[1]) });
    return `Agent Capital is now set to **${Number(summary.allocationUsd).toFixed(2)} ${quoteCurrency}**. I can see the full Quidax balance for context, but I cannot trade beyond this allocation. Live execution remains disabled until its server switches are deliberately enabled.`;
  }

  const buyA = text.match(/^\s*(?:please\s+)?(?:buy|purchase)\s+(?:[$₦]|NGN\s*)?(\d+(?:\.\d{1,2})?)\s+(?:of\s+)?([a-z0-9]{2,10})\s*$/i);
  const buyB = text.match(/^\s*(?:please\s+)?(?:buy|purchase)\s+([a-z0-9]{2,10})\s+(?:with|for)\s+(?:[$₦]|NGN\s*)?(\d+(?:\.\d{1,2})?)\s*$/i);
  if (buyA || buyB) {
    const amount = buyA ? buyA[1] : buyB![2];
    const asset = (buyA ? buyA[2] : buyB![1]).toUpperCase();
    const prepared = await previewLiveTrade(userId, { productId: `${asset}-${quoteCurrency}`, side: "BUY", quoteSize: amount, initiatedBy: "ai" });
    const preview = prepared.preview as { baseSize?: string };
    return `I prepared a Quidax market buy, but have **not executed it yet**.\n\n- Product: **${asset}-${quoteCurrency}**\n- Spend cap: **${Number(amount).toFixed(2)} ${quoteCurrency}**\n- Estimated quantity: **${preview.baseSize ?? "pending"} ${asset}**\n- Preview expires: **${new Date(prepared.expiresAt ?? Date.now()).toLocaleTimeString()}**\n\nTo approve it, send exactly:\n\n\`confirm trade ${prepared.intentId}\``;
  }

  const sell = text.match(/^\s*(?:please\s+)?sell\s+(\d+(?:\.\d{1,12})?)\s+([a-z0-9]{2,10})\s*$/i);
  if (sell) {
    const asset = sell[2].toUpperCase();
    const prepared = await previewLiveTrade(userId, { productId: `${asset}-${quoteCurrency}`, side: "SELL", baseSize: sell[1], initiatedBy: "ai" });
    const preview = prepared.preview as { estimatedPrice?: number };
    return `I prepared a Quidax market sell, but have **not executed it yet**.\n\n- Product: **${asset}-${quoteCurrency}**\n- Quantity: **${sell[1]} ${asset}**\n- Estimated price: **${Number(preview.estimatedPrice ?? 0).toFixed(2)} ${quoteCurrency}**\n\nTo approve it, send exactly:\n\n\`confirm trade ${prepared.intentId}\``;
  }
  return null;
}

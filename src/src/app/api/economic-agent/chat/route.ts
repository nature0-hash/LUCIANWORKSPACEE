import { NextResponse } from "next/server";
import { getProvider, type ChatMessage } from "@/lib/agent/providers";
import type { ProviderId } from "@/store/economic-agent-connection";

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
  }[];
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { content: "Invalid request body.", fromModel: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const { messages, provider, model, contextItems } = body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { content: "No messages provided.", fromModel: false, error: "no_messages" },
      { status: 400 },
    );
  }

  // Build system prompt.
  const systemPromptLines = [
    "You are the LUCIAN Economic Agent — a multi-purpose AI assistant for the LUCIAN Workspace platform.",
    "You help with: economic analysis, investment research, project development, market intelligence, business ideas, and general questions.",
    "You work WITHOUT requiring any project to be active. Project context is optional.",
    "When you don't know something, say so honestly. Never fabricate data, prices, or results.",
    "Format responses with markdown where helpful (headings, lists, tables, code blocks).",
    "Keep responses concise unless the user asks for detail.",
  ];

  if (contextItems && contextItems.length > 0) {
    systemPromptLines.push("", "ATTACHED CONTEXT (use as factual context):");
    for (const ctx of contextItems) {
      systemPromptLines.push(
        `— [${ctx.type}] ${ctx.label}${ctx.description ? `: ${ctx.description}` : ""}`,
      );
    }
  }

  const systemPrompt = systemPromptLines.join("\n");

  // Look up the provider adapter. API keys are read from process.env
  // server-side — never sent to the client.
  const adapter = getProvider(provider);
  if (!adapter) {
    return NextResponse.json({
      content:
        "No AI provider configured. Open Settings → Lilith → Economic Agent Connection to connect a provider, or ask your administrator to set the required environment variable on Vercel.",
      fromModel: false,
      error: "provider_not_configured",
    });
  }

  // Convert messages to the provider format.
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
    content: m.content,
  }));

  try {
    const result = await adapter.chat({
      messages: chatMessages,
      model: model || "gpt-4o-mini",
      systemPrompt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        content: `The AI provider returned an error: ${message}`,
        fromModel: false,
        error: "provider_error",
      },
      { status: 502 },
    );
  }
}

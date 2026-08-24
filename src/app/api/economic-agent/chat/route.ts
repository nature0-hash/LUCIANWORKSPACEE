import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

interface ChatRequestBody {
  messages: { role: string; content: string }[];
  modelSelection: string;
  contextItems?: {
    type: string;
    label: string;
    description?: string;
  }[];
}

interface ZaiChatResponse {
  choices?: { message?: { content?: string } }[];
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

  const { messages, contextItems } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { content: "No messages provided.", fromModel: false, error: "no_messages" },
      { status: 400 },
    );
  }

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

  // Build user prompt from recent messages (last 10).
  const recent = messages.slice(-10);
  const userPrompt =
    recent
      .map((m) => `${m.role === "user" ? "User" : "Economic Agent"}: ${m.content}`)
      .join("\n\n") + "\nEconomic Agent:";

  const outDir = join(tmpdir(), "lucian-economic-agent");
  await mkdir(outDir, { recursive: true });
  const outFile = join(
    outDir,
    `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`,
  );

  try {
    await execFileAsync(
      "z-ai",
      ["chat", "--prompt", userPrompt, "--system", systemPrompt, "--output", outFile],
      { timeout: 30_000, maxBuffer: 1024 * 1024, env: { ...process.env } },
    );
    const raw = await readFile(outFile, "utf8");
    const parsed = JSON.parse(raw) as ZaiChatResponse;
    const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({
        content: "I didn't catch that. Could you rephrase?",
        fromModel: false,
      });
    }
    return NextResponse.json({ content, fromModel: true });
  } catch {
    return NextResponse.json(
      {
        content:
          "I'm having trouble connecting to the model provider. Please try again in a moment.",
        fromModel: false,
        error: "provider_unavailable",
      },
      { status: 502 },
    );
  } finally {
    try {
      await unlink(outFile);
    } catch {
      /* ignore */
    }
  }
}

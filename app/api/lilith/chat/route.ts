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
  assistantName: string;
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

  const { messages, assistantName } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { content: "No messages provided.", fromModel: false, error: "no_messages" },
      { status: 400 },
    );
  }

  const systemPrompt = [
    `You are ${assistantName}, LUCIAN's floating AI assistant.`,
    "You are a helpful, concise, and friendly presence integrated into the LUCIAN workspace.",
    "Keep responses short (2-4 sentences) unless the user asks for detail.",
    "If you don't have specific information about the user's current page or project, say so honestly.",
    "Never fabricate data, prices, or market information.",
  ].join("\n");

  // Build user prompt from recent messages (last 10).
  const recent = messages.slice(-10);
  const userPrompt = recent
    .map((m) => `${m.role === "user" ? "User" : assistantName}: ${m.content}`)
    .join("\n\n") + `\n${assistantName}:`;

  const outDir = join(tmpdir(), "lucian-lilith-chat");
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

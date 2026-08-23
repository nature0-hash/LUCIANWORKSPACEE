import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { readFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type {
  MarketChatContext,
  MarketChatMessage,
} from "@/lib/markets/intelligence-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

/** POST /api/markets/chat
 *
 * Body: { messages: MarketChatMessage[], context: MarketChatContext }
 * Returns: { content: string, fromModel: boolean }
 *
 * Uses the z-ai-web-dev-sdk CLI (bundled in this environment) to generate
 * the assistant reply. The conversation includes the user's messages plus
 * the current market context (selected instrument, timeframe, prices,
 * attached news stories).
 *
 * The AI is explicitly instructed to:
 *   - Distinguish between real information it has vs. information it lacks
 *   - Never fabricate live news, quotes, events, or market conditions
 *   - Use the attached news stories as factual context when provided
 */

interface ChatRequestBody {
  messages: MarketChatMessage[];
  context: MarketChatContext;
}

function buildSystemPrompt(ctx: MarketChatContext): string {
  const lines: string[] = [
    "You are LUCIAN Markets AI — a markets intelligence assistant integrated into the LUCIAN trading terminal.",
    "",
    "You are assisting the user with the currently selected market instrument. The user is viewing the LUCIAN Markets page and has the following instrument active:",
    "",
    `- Symbol: ${ctx.symbol}`,
    `- Name: ${ctx.name}`,
    `- Asset class: ${ctx.assetClass}`,
    `- Timeframe: ${ctx.timeframe}`,
    `- Current bid (sell) price: ${ctx.bid}`,
    `- Current ask (buy) price: ${ctx.ask}`,
    ctx.changePct !== null
      ? `- 24h change percent: ${ctx.changePct.toFixed(2)}%`
      : `- 24h change percent: not available`,
    ctx.ohlc
      ? `- Latest candle: Open ${ctx.ohlc.open}, High ${ctx.ohlc.high}, Low ${ctx.ohlc.low}, Close ${ctx.ohlc.close}`
      : `- OHLC snapshot: not available`,
    "",
    "STRICT RULES — follow these exactly:",
    "1. Use ONLY the information provided above, plus general knowledge the user can verify.",
    "2. NEVER fabricate live news, headlines, quotes, market-moving events, or analysis presented as externally sourced.",
    "3. When you do not have current information about a specific topic, say so honestly.",
    "4. If the user has attached real news stories to their message, treat those stories as factual context and cite them as 'the attached story from <source>'.",
    "5. Keep responses concise and trading-terminal-appropriate (3-6 sentences for analysis questions).",
    "6. Do not invent prices, spreads, or order-book details beyond what's in the context.",
    "7. If asked 'what is happening here?', interpret 'here' as the currently selected instrument shown above.",
  ];

  if (ctx.attachedNews && ctx.attachedNews.length > 0) {
    lines.push("");
    lines.push("ATTACHED REAL NEWS STORIES (use as factual context):");
    for (const story of ctx.attachedNews) {
      lines.push(
        `— "${story.headline}" — ${story.source} (${new Date(story.publishedAt).toISOString()})`,
      );
      lines.push(`   Summary: ${story.summary}`);
      lines.push(`   URL: ${story.url}`);
      if (story.symbols.length > 0) {
        lines.push(`   Affected symbols: ${story.symbols.join(", ")}`);
      }
    }
  }

  return lines.join("\n");
}

function buildUserPrompt(messages: MarketChatMessage[]): string {
  // Concatenate the recent conversation as a single prompt for the CLI.
  // Keep last ~10 messages to stay within token limits.
  const recent = messages.slice(-10);
  const lines: string[] = [];
  for (const m of recent) {
    if (m.role === "system") continue;
    const speaker = m.role === "user" ? "User" : "Assistant";
    lines.push(`${speaker}: ${m.content}`);
  }
  lines.push("Assistant:");
  return lines.join("\n\n");
}

interface ZaiChatResponse {
  choices?: {
    message?: { content?: string };
  }[];
}

export async function POST(req: Request) {
  let body: ChatRequestBody;
  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      {
        content: "Invalid request body.",
        fromModel: false,
        error: "invalid_body",
      },
      { status: 400 },
    );
  }

  const { messages, context } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        content: "No messages provided.",
        fromModel: false,
        error: "no_messages",
      },
      { status: 400 },
    );
  }

  const systemPrompt = buildSystemPrompt(context);
  const userPrompt = buildUserPrompt(messages);

  // Use the z-ai CLI with --output to a temp JSON file (avoids stdout
  // parsing issues with multi-line content + emoji etc).
  const outDir = join(tmpdir(), "lucian-markets-chat");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.json`);

  try {
    await execFileAsync(
      "z-ai",
      [
        "chat",
        "--prompt", userPrompt,
        "--system", systemPrompt,
        "--output", outFile,
      ],
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env },
      },
    );
    const raw = await readFile(outFile, "utf8");
    const parsed = JSON.parse(raw) as ZaiChatResponse;
    const content = parsed.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return NextResponse.json({
        content:
          "The model returned an empty response. Please try rephrasing your question.",
        fromModel: false,
      });
    }
    return NextResponse.json({ content, fromModel: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        content:
          "Markets AI is currently unavailable. The model provider could not be reached. Please try again in a moment.",
        fromModel: false,
        error: "provider_unavailable",
        detail: message,
      },
      { status: 502 },
    );
  } finally {
    // Best-effort cleanup of the temp file.
    try {
      await unlink(outFile);
    } catch {
      /* ignore */
    }
  }
}

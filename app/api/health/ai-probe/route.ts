// LUCIAN Settings — AI provider probe.
// GET /api/health/ai-probe?provider=<id>
//
// Reports whether the given AI provider's environment variable is
// configured on the server. NEVER returns the key value itself.
//
// Used by Settings → AI & Models → Provider Status, and by Settings →
// Connections → AI Providers, to display the honest configured state
// without making a real chat completion (which would burn API quota).

import { NextResponse } from "next/server";
import { isProviderConfigured } from "@/lib/agent/providers";
import type { ProviderId } from "@/store/economic-agent-connection";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KNOWN: ProviderId[] = [
  "gemini", "openai", "anthropic", "openrouter", "deepseek", "custom",
];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const provider = url.searchParams.get("provider") as ProviderId | null;
  if (!provider || !KNOWN.includes(provider)) {
    return NextResponse.json(
      { error: "Unknown provider id.", configured: false },
      { status: 400 },
    );
  }
  return NextResponse.json({
    provider,
    configured: isProviderConfigured(provider),
  });
}

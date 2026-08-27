"use client";

/* LUCIAN Project Agent — shared AI provider adapter.
 *
 * Phase 11: replaces the `noopProvider` that previously stubbed out the
 * Project Agent's AI calls. This adapter connects the Project Agent to
 * LUCIAN's EXISTING shared AI infrastructure:
 *
 *   useSharedAIConfig.resolve("dev-workspace-agent")
 *         ↓ { provider, model, usingGlobal }
 *   POST /api/ai/chat  (the same route used by Economic Agent + Lilith)
 *         ↓ { content, errorType? }
 *   Project Agent adapter
 *         ↓ parse for tool calls (normalized format)
 *   Agent tool loop (lib/agent/types.ts → runAgentTurn)
 *
 * The adapter does NOT:
 *   - Store or read API keys (those live in Vercel env vars, read
 *     server-side by /api/ai/chat).
 *   - Implement its own provider adapters (Gemini/OpenAI/Anthropic/etc.
 *     are reused from Phase 7's lib/agent/providers.ts).
 *   - Duplicate model config (it reads from useSharedAIConfig).
 *
 * Tool-call protocol:
 *   Since not every provider supports native tool-calling, we use a strict
 *   normalized format that LUCIAN validates before execution. The model is
 *   instructed (via the system prompt injected by the caller) to emit a
 *   JSON block on a fenced ```tool-call code block when it wants to call a
 *   tool. The adapter parses that block; if parsing fails or the tool name
 *   is unknown, the adapter returns the raw content as a normal assistant
 *   message (the tool loop will then end naturally — no crash).
 */

import type { ModelProvider, AgentMessage, AgentTool } from "./types";
import { useSharedAIConfig, type InterfaceId } from "@/store/shared-ai-config";
import { getProviderInfo, type ProviderInfo } from "@/store/shared-ai-config";
import { readAIBehaviorWire } from "@/lib/ai-behavior";

const INTERFACE: InterfaceId = "dev-workspace-agent";

/** Synchronous read of the resolved provider/model for the Project Agent.
 *  Used by getModelProvider() so the Agent panel UI can render the current
 *  provider label without subscribing to the store (which would cause
 *  re-renders on every config change). */
export function getProjectAgentProviderInfo(): {
  provider: string;
  model: string;
  configured: boolean;
} {
  if (typeof window === "undefined") {
    // SSR: assume not configured (the agent panel is client-only anyway).
    return { provider: "gemini", model: "gemini-2.0-flash", configured: false };
  }
  const resolved = useSharedAIConfig.getState().resolve(INTERFACE);
  return {
    provider: resolved.provider,
    model: resolved.model,
    // We don't know server-side whether the key is configured, so we
    // optimistically assume yes — the actual /api/ai/chat call will return
    // provider-not-configured if it isn't, and the agent panel UI already
    // shows the right message in that case.
    configured: true,
  };
}

/** Marker that opens/closes a tool-call block. */
const TOOL_CALL_MARKER = "tool-call";

interface ParsedToolCall {
  /** Tool name (must match one of the registered AgentTool.name values). */
  name: string;
  /** Arguments object. */
  args: Record<string, unknown>;
}

/**
 * Parse a model response for a ```tool-call``` fenced block.
 *
 * Expected format (the system prompt instructs the model to emit this):
 *
 * ```tool-call
 * { "name": "read_file", "args": { "path": "src/App.tsx" } }
 * ```
 *
 * Returns null if no valid tool-call block is found. Malformed JSON or
 * missing fields also return null (the adapter then treats the response
 * as a plain assistant message).
 */
function parseToolCallBlock(content: string): ParsedToolCall | null {
  // Find the first ```tool-call ... ``` block.
  const marker = "```" + TOOL_CALL_MARKER;
  const startIdx = content.indexOf(marker);
  if (startIdx < 0) return null;
  const jsonStart = startIdx + marker.length;
  // The block ends at the next ``` after jsonStart.
  const endIdx = content.indexOf("```", jsonStart);
  if (endIdx < 0) return null;
  const jsonText = content.slice(jsonStart, endIdx).trim();
  if (!jsonText) return null;
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const name = obj.name;
    const args = obj.args;
    if (typeof name !== "string" || !name) return null;
    if (args !== undefined && typeof args !== "object") return null;
    return {
      name,
      args: (args as Record<string, unknown>) ?? {},
    };
  } catch {
    return null;
  }
}

/**
 * Build the shared ModelProvider instance for the Project Agent.
 *
 * The returned provider reads its config from useSharedAIConfig at submit
 * time (so config changes take effect immediately without re-registering).
 */
export function createSharedAgentProvider(): ModelProvider {
  return {
    id: "lucian-shared",
    label: "LUCIAN Shared AI",
    configured: true,

    async submit({
      messages,
      tools,
      systemPrompt,
    }: {
      messages: AgentMessage[];
      tools: AgentTool[];
      systemPrompt: string;
    }): Promise<{
      content: string;
      toolCall?: { name: string; args: Record<string, unknown> };
    }> {
      // Resolve provider + model from the shared config AT submit time.
      const resolved =
        typeof window !== "undefined"
          ? useSharedAIConfig.getState().resolve(INTERFACE)
          : { provider: "gemini" as const, model: "gemini-2.0-flash", usingGlobal: true };

      const providerInfo: ProviderInfo = getProviderInfo(resolved.provider);

      // Augment the system prompt with the tool catalog so the model knows
      // how to call tools via the normalized ```tool-call``` format.
      const toolCatalog = tools
        .map((t) => {
          const params = t.parameters.required?.length
            ? ` (required: ${t.parameters.required.join(", ")})`
            : "";
          return `- ${t.name}${params}: ${t.description}`;
        })
        .join("\n");
      const toolInstructions = `\n\n## Available tools\n\nYou may call tools by emitting a fenced code block with the language tag \`tool-call\`, containing a JSON object with \`name\` and \`args\` fields. Example:\n\n\`\`\`tool-call\n{ "name": "read_file", "args": { "path": "src/App.tsx" } }\n\`\`\`\n\nOnly call ONE tool per response. After a tool returns its result, you will be asked to continue. If you do not need to call a tool, respond normally without a tool-call block.\n\nTools:\n${toolCatalog}`;
      const fullSystemPrompt = systemPrompt + toolInstructions;

      // Convert agent messages to the shared /api/ai/chat format.
      const chatMessages = messages
        .filter((m) => m.role !== "tool" || true) // include tool results
        .map((m) => {
          if (m.role === "tool") {
            // Surface tool results as user messages so the model sees them
            // as additional context (since /api/ai/chat doesn't natively
            // support tool messages).
            return {
              role: "user" as const,
              content: `[Tool result: ${m.toolName}]\n${m.content}`,
            };
          }
          if (m.role === "assistant" && m.toolCall) {
            // Surface the assistant's intent to call a tool as an assistant
            // message (the actual tool dispatch is handled by runAgentTurn).
            return {
              role: "assistant" as const,
              content: m.content || `Calling tool: ${m.toolCall.name}`,
            };
          }
          return {
            role: (m.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: m.content,
          };
        });

      // Call the shared /api/ai/chat route (server-side, never exposes keys).
      let res: Response;
      try {
        // Read the current AI behavior from Settings so the server can
        // apply response style + context budget + remember-conversations.
        // `allowProjectContext` is enforced HERE on the client (we drop
        // tool results that contain project file contents before sending)
        // AND on the server (the system prompt instructs the model).
        const behavior = readAIBehaviorWire();

        // If allowProjectContext is OFF, strip tool-result messages that
        // contain project file contents (read_file / scan_project results).
        // The model still sees the tool CALLS (so it can reason about the
        // conversation), but NOT the actual file data. This is the
        // privacy/security boundary the Settings toggle controls.
        const sanitizedMessages = behavior.allowProjectContext
          ? chatMessages
          : chatMessages.map((m) => {
              if (m.role === "user" && /^\[Tool result: (read_file|scan_project|list_files|get_framework)\]/.test(m.content)) {
                return { ...m, content: "[Tool result: blocked by Project Agent context permission]" };
              }
              return m;
            });

        res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: sanitizedMessages,
            provider: resolved.provider,
            model: resolved.model,
            systemPrompt: fullSystemPrompt,
            behavior,
          }),
        });
      } catch {
        return {
          content:
            "Could not reach the LUCIAN AI service. Check your network connection and try again.",
        };
      }

      const data = (await res.json().catch(() => null)) as
        | { success: true; content: string }
        | { success: false; errorType: string; message?: string }
        | null;

      if (!data) {
        return {
          content: "The AI service returned an invalid response.",
        };
      }

      if (!data.success) {
        const err = data as { success: false; errorType: string; message?: string };
        // Map the shared API's errorType to an honest user-facing message.
        // We do NOT pass through the raw error message (may contain URLs /
        // partial response bodies).
        if (err.errorType === "provider-not-configured") {
          return {
            content:
              `No AI provider is configured. Open Settings → Lilith → Economic Agent Connection (or set a global provider) to enable AI replies. The configured provider was "${resolved.provider}" but its API key is not set on the server.`,
          };
        }
        const friendly =
          err.errorType === "authentication-failed"
            ? "The configured AI provider rejected the API key."
            : err.errorType === "rate-limit"
              ? "The AI provider rate-limited this request. Wait a moment and try again."
              : err.errorType === "timeout"
                ? "The AI provider timed out."
                : err.errorType === "network-error"
                  ? "Could not reach the AI provider."
                  : err.errorType === "invalid-model"
                    ? `The model "${resolved.model}" is not available on ${providerInfo.name}.`
                    : "The AI provider returned an error.";
        return { content: friendly };
      }

      const ok = data as { success: true; content: string };
      const content = ok.content ?? "";

      // Try to parse a tool-call block from the model's response.
      const toolCall = parseToolCallBlock(content);
      if (toolCall) {
        // Validate the tool name against the registry — unknown tools
        // are dropped (the runner will report "tool does not exist").
        const knownTool = tools.find((t) => t.name === toolCall.name);
        if (knownTool) {
          // Strip the tool-call block from the visible content so the
          // user sees a clean assistant message rather than JSON noise.
          const strippedContent = stripToolCallBlock(content).trim();
          return {
            content: strippedContent || `Calling tool: ${toolCall.name}`,
            toolCall,
          };
        }
        // Unknown tool — return content as-is so the runner can report
        // the error and the model can recover on the next turn.
        return { content };
      }

      return { content };
    },
  };
}

/** Remove the first ```tool-call ... ``` block from the content. */
function stripToolCallBlock(content: string): string {
  const marker = "```" + TOOL_CALL_MARKER;
  const startIdx = content.indexOf(marker);
  if (startIdx < 0) return content;
  const jsonStart = startIdx + marker.length;
  const endIdx = content.indexOf("```", jsonStart);
  if (endIdx < 0) return content;
  return content.slice(0, startIdx) + content.slice(endIdx + 3);
}

/**
 * Register the shared agent provider. Called once at app boot from
 * the agent panel (or AppShell). Safe to call multiple times — it
 * just replaces the current provider.
 */
export function registerSharedAgentProvider(): void {
  // Late import to avoid circular deps at module-load time.
  void import("./types").then(({ setModelProvider }) => {
    setModelProvider(createSharedAgentProvider());
  });
}

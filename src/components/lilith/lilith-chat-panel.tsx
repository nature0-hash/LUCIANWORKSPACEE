"use client";

/* LilithChatPanel — Phase 7: unified AI foundation.
 *
 * Lilith now uses the shared AI provider layer (same as Economic Agent).
 * Multi-turn conversation history is sent. Messages are persisted.
 * Errors are displayed as proper error states (not fake assistant messages).
 * The Model button opens a functional provider/model selector.
 * Response style settings affect the system prompt.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Send, Mic, ChevronDown, X, Sparkles, AlertCircle, RotateCw, Cpu,
} from "lucide-react";
import { useLilithStore, type LilithError } from "@/store/lilith";
import { useSharedAIConfig, PROVIDERS, getProviderInfo, type ProviderId } from "@/store/shared-ai-config";
import { readAIBehaviorWire } from "@/lib/ai-behavior";
import { cn } from "@/lib/utils";

interface Props {
  orbX: number;
  orbY: number;
  orbSize: number;
}

export function LilithChatPanel({ orbX, orbY, orbSize }: Props) {
  const messages = useLilithStore((s) => s.messages);
  const inputText = useLilithStore((s) => s.inputText);
  const setInputText = useLilithStore((s) => s.setInputText);
  const addMessage = useLilithStore((s) => s.addMessage);
  const clearMessages = useLilithStore((s) => s.clearMessages);
  const status = useLilithStore((s) => s.status);
  const setStatus = useLilithStore((s) => s.setStatus);
  const settings = useLilithStore((s) => s.settings);
  const setPanelOpen = useLilithStore((s) => s.setPanelOpen);
  const busy = useLilithStore((s) => s.busy);
  const setBusy = useLilithStore((s) => s.setBusy);
  const error = useLilithStore((s) => s.error);
  const setError = useLilithStore((s) => s.setError);

  // Shared AI config
  const resolve = useSharedAIConfig((s) => s.resolve);
  const setOverride = useSharedAIConfig((s) => s.setOverride);
  const setGlobalProvider = useSharedAIConfig((s) => s.setGlobalProvider);
  const setGlobalModel = useSharedAIConfig((s) => s.setGlobalModel);
  const globalProvider = useSharedAIConfig((s) => s.globalProvider);
  const globalModel = useSharedAIConfig((s) => s.globalModel);
  const overrides = useSharedAIConfig((s) => s.overrides);

  const resolved = resolve("lilith");
  const lilithOverride = overrides["lilith"];

  const scrollRef = useRef<HTMLDivElement>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const modelRef = useRef<HTMLDivElement>(null);

  const PANEL_WIDTH = 320;
  const PANEL_HEIGHT = 440;
  const GAP = 12;

  // Compute panel side from orb position (no effect needed).
  const orbCenter = orbX + orbSize / 2;
  const screenCenter = typeof window !== "undefined" ? window.innerWidth / 2 : 500;
  const panelSide: "left" | "right" = orbCenter > screenCenter ? "left" : "right";

  const panelLeft = panelSide === "left"
    ? Math.max(8, orbX - PANEL_WIDTH - GAP)
    : Math.min(window.innerWidth - PANEL_WIDTH - 8, orbX + orbSize + GAP);
  const panelTop = Math.max(8, Math.min(window.innerHeight - PANEL_HEIGHT - 8, orbY));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Close model popover on outside click.
  useEffect(() => {
    if (!modelOpen) return;
    const handler = (e: MouseEvent) => {
      if (!modelRef.current?.contains(e.target as Node)) setModelOpen(false);
    };
    const id = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => { clearTimeout(id); document.removeEventListener("mousedown", handler); };
  }, [modelOpen]);

  // Phase 8: consume handoff context from other modules (Notes, Investing, Chess, etc.)
  const [handoffContext, setHandoffContext] = useState<{
    staticContext: { module: string; label: string; content: string }[];
    contextRefs: { module: string; entityType: string; entityId: string }[];
    prompt: string;
  } | null>(null);
  const [handoffConsumed, setHandoffConsumed] = useState(false);

  useEffect(() => {
    if (handoffConsumed) return;
    // Defer setState to a microtask so we don't call it synchronously
    // inside the effect body (React 19 set-state-in-effect rule).
    const id = window.setTimeout(() => {
      const { consumeLilithHandoff } = require("@/lib/cross-module-bridge");
      const handoff = consumeLilithHandoff();
      if (handoff && (handoff.staticContext.length > 0 || handoff.contextRefs.length > 0)) {
        setHandoffContext(handoff);
      }
      setHandoffConsumed(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [handoffConsumed]);

  // Resolve handoff context at send time (dynamic refs → fresh data).
  const resolveHandoffContext = useCallback((): { type: string; label: string; description: string; data: string }[] => {
    if (!handoffContext) return [];
    const { resolveAllContext } = require("@/lib/context-resolver");
    return resolveAllContext(handoffContext.contextRefs, handoffContext.staticContext);
  }, [handoffContext]);

  // Phase 7: build Lilith's system prompt with response style.
  const buildSystemPrompt = useCallback(() => {
    const styleInstructions: Record<string, string> = {
      concise: "Keep responses very short (1-3 sentences). Be direct and to the point.",
      balanced: "Keep responses concise but complete (2-5 sentences). Balance brevity with useful detail.",
      detailed: "Provide thorough, detailed responses. Include context and explanation where helpful.",
    };
    return [
      `You are ${settings.name}, LUCIAN's floating AI assistant.`,
      "You are a helpful, friendly presence integrated into the LUCIAN workspace.",
      "If you don't have specific information, say so honestly.",
      "Never fabricate data, prices, or market information.",
      styleInstructions[settings.responseStyle] ?? styleInstructions.balanced,
    ].join("\n");
  }, [settings.name, settings.responseStyle]);

  // Phase 7: send multi-turn conversation history (last 20 messages).
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || busy) return;

    setError(null);
    addMessage({ role: "user", content: text, fromModel: false });
    setInputText("");
    setStatus("thinking");
    setBusy(true);

    // Build history window from persisted messages + the new user message.
    const allMessages = [...useLilithStore.getState().messages];
    const historyWindow = allMessages.slice(-20).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Phase 8: resolve handoff context at send time (dynamic refs → fresh data).
      const resolvedCtx = resolveHandoffContext();
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyWindow,
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: buildSystemPrompt(),
          contextItems: resolvedCtx.length > 0 ? resolvedCtx.map((c: { type: string; label: string; description: string; data: string }) => ({
            type: c.type, label: c.label, description: c.description, data: c.data,
          })) : undefined,
          behavior: readAIBehaviorWire(),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        content: string;
        provider?: string;
        model?: string;
        errorType?: string;
        message?: string;
      };

      if (data.success) {
        setStatus("speaking");
        addMessage({ role: "assistant", content: data.content, fromModel: true });
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        // Phase 7: do NOT insert failure text as a fake assistant message.
        const errorType = (data.errorType as LilithError["type"]) ?? "unknown";
        setError({
          type: errorType,
          message: data.message ?? "An unknown error occurred.",
        });
        setStatus("idle");
        // Phase 10: fire a deduped notification for meaningful provider
        // failures (not for "provider-not-configured" — that's surfaced
        // inline and would spam the bell).
        void import("@/lib/notification-producers").then(({ notifyAiProviderFailure }) => {
          notifyAiProviderFailure({
            provider: resolved.provider,
            errorType,
            interface: "lilith",
          });
        }).catch(() => { /* non-fatal */ });
      }
    } catch {
      setError({
        type: "network-error",
        message: "Could not reach the model provider. Check your network connection.",
      });
      setStatus("idle");
      // Phase 10: notify on network errors too (deduped).
      void import("@/lib/notification-producers").then(({ notifyAiProviderFailure }) => {
        notifyAiProviderFailure({
          provider: resolved.provider,
          errorType: "network-error",
          interface: "lilith",
        });
      }).catch(() => { /* non-fatal */ });
    } finally {
      setBusy(false);
    }
  }, [inputText, busy, addMessage, setInputText, setStatus, setBusy, setError, resolved, buildSystemPrompt, resolveHandoffContext]);

  // Phase 7: retry the last failed request.
  const handleRetry = useCallback(async () => {
    if (busy || !error) return;
    const state = useLilithStore.getState();
    if (state.messages.length === 0) return;

    const lastUserMsg = [...state.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    setError(null);
    setStatus("thinking");
    setBusy(true);

    const historyWindow = state.messages.slice(-20).map((m) => ({
      role: m.role, content: m.content,
    }));

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historyWindow,
          provider: resolved.provider,
          model: resolved.model,
          systemPrompt: buildSystemPrompt(),
          behavior: readAIBehaviorWire(),
        }),
      });
      const data = (await res.json()) as { success: boolean; content: string; errorType?: string; message?: string };
      if (data.success) {
        setStatus("speaking");
        addMessage({ role: "assistant", content: data.content, fromModel: true });
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setError({ type: (data.errorType as LilithError["type"]) ?? "unknown", message: data.message ?? "An unknown error occurred." });
        setStatus("idle");
      }
    } catch {
      setError({ type: "network-error", message: "Could not reach the model provider." });
      setStatus("idle");
    } finally {
      setBusy(false);
    }
  }, [busy, error, addMessage, setStatus, setBusy, setError, resolved, buildSystemPrompt]);

  const providerInfo = getProviderInfo(resolved.provider);
  const displayModel = resolved.model || providerInfo.defaultModel || "model";

  return (
    <div
      className="themed fixed z-[101] flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
      style={{ left: panelLeft, top: panelTop, width: PANEL_WIDTH, height: PANEL_HEIGHT }}
    >
      {/* Header */}
      <div className="themed flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{settings.name}</span>
          {busy && <span className="text-[9px] text-fg-faint">thinking…</span>}
        </div>
        <button onClick={() => setPanelOpen(false)} className="text-fg-faint hover:text-fg" aria-label="Close panel">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Phase 7: Error display */}
      {error && (
        <div className="border-b border-[#f23645]/20 bg-[#f23645]/5 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-[#f23645]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#f23645]">
                {error.type.replace(/-/g, " ")}
              </span>
              <p className="text-[10px] text-fg-muted">{error.message}</p>
            </div>
            <button onClick={() => void handleRetry()} disabled={busy}
              className="rounded border border-line-muted bg-surface-2 px-2 py-1 text-[10px] font-medium text-fg-muted hover:text-fg disabled:opacity-40">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Phase 8: Handoff context chips from other modules */}
      {handoffContext && (handoffContext.staticContext.length > 0 || handoffContext.contextRefs.length > 0) && (
        <div className="border-b border-line-muted bg-surface-2/50 px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[8px] uppercase tracking-wide text-fg-faint">Attached:</span>
            {handoffContext.staticContext.map((c, i) => (
              <span key={`s-${i}`} className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[8px] text-[var(--accent)]">
                {c.module} · {c.label}
              </span>
            ))}
            {handoffContext.contextRefs.map((r, i) => (
              <span key={`r-${i}`} className="rounded bg-[var(--accent)]/10 px-1.5 py-0.5 text-[8px] text-[var(--accent)]">
                {r.module} · {r.entityType}
              </span>
            ))}
            <button
              onClick={() => setHandoffContext(null)}
              className="text-[8px] text-fg-faint hover:text-fg"
              title="Remove attached context"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Conversation area */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 ? <EmptyState name={settings.name} /> : (
          messages.map((m) => <MessageBubble key={m.id} message={m} assistantName={settings.name} />)
        )}
        {busy && (
          <div className="flex items-center gap-2 text-[10px] text-fg-faint">
            <span className="animate-pulse">●</span>
            <span>{settings.name} is thinking…</span>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-line-muted p-2">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
          }}
          placeholder={`Ask ${settings.name}…`}
          rows={2}
          disabled={busy}
          className="w-full resize-none rounded border border-line-muted bg-surface-2 px-2 py-1.5 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed disabled:opacity-60"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Phase 7: Mic button — honestly marked unavailable */}
            <button
              type="button"
              title="Voice input — coming later"
              onClick={() => setStatus(status === "listening" ? "idle" : "listening")}
              className={cn("flex h-5 w-5 items-center justify-center rounded transition-colors opacity-50",
                status === "listening" ? "bg-[var(--accent)] text-[var(--accent-fg)]" : "text-fg-muted")}
            >
              <Mic className="h-2.5 w-2.5" />
            </button>

            {/* Phase 7: Model button — now functional */}
            <div ref={modelRef} className="relative">
              <button
                type="button"
                onClick={() => setModelOpen((v) => !v)}
                className="flex items-center gap-0.5 text-[9px] text-fg-muted hover:text-fg"
                title="Provider & Model"
              >
                <Cpu className="h-2.5 w-2.5" />
                <span className="max-w-[60px] truncate">{displayModel}</span>
                <ChevronDown className="h-2 w-2" />
              </button>
              {modelOpen && (
                <div className="absolute bottom-full left-0 mb-1 w-64 overflow-hidden rounded-md border border-line bg-overlay shadow-pop">
                  <div className="border-b border-line-muted px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
                    Lilith Provider & Model
                  </div>
                  <div className="space-y-2 p-2">
                    {/* Override toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-fg-muted">
                        {lilithOverride ? "Using custom override" : "Using global default"}
                      </span>
                      <button
                        onClick={() => {
                          if (lilithOverride) {
                            setOverride("lilith", null);
                          } else {
                            setOverride("lilith", { provider: globalProvider, model: globalModel });
                          }
                        }}
                        className="rounded border border-line-muted px-1.5 py-0.5 text-[9px] text-fg-muted hover:text-fg"
                      >
                        {lilithOverride ? "Use global" : "Override"}
                      </button>
                    </div>
                    {/* Provider dropdown */}
                    <div>
                      <label className="text-[9px] uppercase tracking-wide text-fg-faint">Provider</label>
                      <select
                        value={lilithOverride?.provider ?? globalProvider}
                        onChange={(e) => {
                          const p = e.target.value as ProviderId;
                          if (lilithOverride) {
                            setOverride("lilith", { provider: p, model: getProviderInfo(p).defaultModel });
                          } else {
                            setGlobalProvider(p);
                            setGlobalModel(getProviderInfo(p).defaultModel);
                          }
                        }}
                        className="mt-1 w-full rounded border border-line-muted bg-surface px-2 py-1 text-[11px] text-fg"
                      >
                        {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    {/* Model input */}
                    <div>
                      <label className="text-[9px] uppercase tracking-wide text-fg-faint">Model</label>
                      <input
                        type="text"
                        value={lilithOverride?.model ?? globalModel}
                        onChange={(e) => {
                          if (lilithOverride) {
                            setOverride("lilith", { ...lilithOverride, model: e.target.value });
                          } else {
                            setGlobalModel(e.target.value);
                          }
                        }}
                        placeholder={providerInfo.modelPlaceholder}
                        className="mt-1 w-full rounded border border-line-muted bg-surface px-2 py-1 text-[11px] text-fg"
                      />
                    </div>
                    <div className="text-[9px] text-fg-faint">
                      The selected provider + model are used for Lilith&apos;s next request.
                      Configure API keys in Settings → Lilith → Economic Agent Connection.
                    </div>
                  </div>
                </div>
              )}
            </div>

            {messages.length > 0 && (
              <button onClick={clearMessages} className="text-[9px] text-fg-faint hover:text-fg" title="Clear conversation">
                Clear
              </button>
            )}
          </div>
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || busy}
            className="flex items-center gap-1 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {busy ? <RotateCw className="h-2.5 w-2.5 animate-spin" /> : <Send className="h-2.5 w-2.5" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Sparkles className="h-5 w-5 text-[var(--accent)]" />
      <p className="mt-2 text-[12px] font-medium text-fg">How can I help?</p>
      <p className="mt-1 text-[10px] text-fg-muted">
        {name} is ready to assist. Ask anything about your workspace.
      </p>
    </div>
  );
}

function MessageBubble({
  message,
  assistantName,
}: {
  message: { role: string; content: string; fromModel: boolean; timestamp: number };
  assistantName: string;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "rounded px-2 py-1.5 text-[11px] leading-relaxed",
        isUser ? "ml-4 bg-[var(--accent)]/15 text-fg" : "mr-4 bg-surface-2 text-fg",
      )}
    >
      <div className="mb-0.5 text-[8px] uppercase tracking-wide text-fg-faint">
        {isUser ? "You" : assistantName}
        {!isUser && !message.fromModel && (
          <span className="ml-1 text-amber-500">⚠ unconfigured</span>
        )}
      </div>
      <p className="whitespace-pre-wrap">{message.content}</p>
    </div>
  );
}

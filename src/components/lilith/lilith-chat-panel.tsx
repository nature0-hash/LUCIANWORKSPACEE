"use client";

/* LilithChatPanel — compact chat popover that opens beside the orb.
 *
 * The panel positions itself intelligently based on the orb's screen
 * position: if the orb is on the right half of the screen, the panel
 * opens to the LEFT of the orb; otherwise it opens to the RIGHT.
 *
 * Architecture is provider-independent: when no AI provider is
 * configured, the panel honestly shows a "configuration required"
 * state instead of fabricating responses.
 */

import { useEffect, useRef, useState } from "react";
import {
  Send,
  Mic,
  ChevronDown,
  X,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { useLilithStore } from "@/store/lilith";
import { cn } from "@/lib/utils";

interface Props {
  /** Pixel position of the orb (top-left corner). */
  orbX: number;
  orbY: number;
  /** Orb size in px. */
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const [panelSide, setPanelSide] = useState<"left" | "right">("left");

  const PANEL_WIDTH = 320;
  const PANEL_HEIGHT = 440;
  const GAP = 12;

  // Determine which side to render the panel based on orb position.
  useEffect(() => {
    const orbCenter = orbX + orbSize / 2;
    const screenCenter = window.innerWidth / 2;
    setPanelSide(orbCenter > screenCenter ? "left" : "right");
  }, [orbX, orbSize]);

  // Compute panel position (clamped to viewport).
  const panelLeft =
    panelSide === "left"
      ? Math.max(8, orbX - PANEL_WIDTH - GAP)
      : Math.min(
          window.innerWidth - PANEL_WIDTH - 8,
          orbX + orbSize + GAP,
        );
  const panelTop = Math.max(
    8,
    Math.min(window.innerHeight - PANEL_HEIGHT - 8, orbY),
  );

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text) return;

    addMessage({ role: "user", content: text, fromModel: false });
    setInputText("");
    setStatus("thinking");

    // Try to call the AI provider (reuses the existing /api/markets/chat
    // endpoint pattern — but Lilith has her own context-free endpoint).
    try {
      const res = await fetch("/api/lilith/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
          assistantName: settings.name,
        }),
      });
      const data = (await res.json()) as { content: string; fromModel: boolean };
      setStatus("speaking");
      addMessage({
        role: "assistant",
        content: data.content,
        fromModel: data.fromModel,
      });
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("attention");
      addMessage({
        role: "assistant",
        content:
          "I couldn't reach the model provider. Please try again in a moment.",
        fromModel: false,
      });
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <div
      className="themed fixed z-[101] flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
      style={{
        left: panelLeft,
        top: panelTop,
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
      }}
    >
      {/* Header */}
      <div className="themed flex h-9 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-fg">{settings.name}</span>
          {status === "thinking" && (
            <span className="text-[9px] text-fg-faint">thinking…</span>
          )}
          {status === "speaking" && (
            <span className="text-[9px] text-[var(--accent)]">speaking…</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(false)}
          className="text-fg-faint hover:text-fg"
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {messages.length === 0 ? (
          <EmptyState name={settings.name} />
        ) : (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} assistantName={settings.name} />
          ))
        )}
        {status === "thinking" && (
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={`Ask ${settings.name}…`}
          rows={2}
          className="w-full resize-none rounded border border-line-muted bg-surface-2 px-2 py-1.5 text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-[var(--accent)] themed"
        />
        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              title="Voice input"
              onClick={() => setStatus(status === "listening" ? "idle" : "listening")}
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded transition-colors",
                status === "listening"
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <Mic className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              title="Model"
              className="flex items-center gap-0.5 text-[9px] text-fg-muted hover:text-fg"
            >
              Model
              <ChevronDown className="h-2 w-2" />
            </button>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearMessages}
                className="text-[9px] text-fg-faint hover:text-fg"
                title="Clear conversation"
              >
                Clear
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputText.trim() || status === "thinking"}
            className="flex items-center gap-1 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-fg)] transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <Send className="h-2.5 w-2.5" />
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
      <p className="mt-2 text-[12px] font-medium text-fg">
        How can I help?
      </p>
      <p className="mt-1 text-[10px] text-fg-muted">
        {name} is ready to assist. Ask anything about your workspace.
      </p>
      <div className="mt-3 space-y-1">
        {[
          "What can you do?",
          "Summarize my markets activity",
          "Help me with Vault",
        ].map((q) => (
          <div
            key={q}
            className="rounded border border-line-muted bg-surface-2 px-2 py-1 text-[10px] text-fg-muted"
          >
            {q}
          </div>
        ))}
      </div>
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
        isUser
          ? "ml-4 bg-[var(--accent)]/15 text-fg"
          : "mr-4 bg-surface-2 text-fg",
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

/* Re-export AlertCircle to avoid unused import warning if the
    "configuration required" state is later added as a banner. */
void AlertCircle;

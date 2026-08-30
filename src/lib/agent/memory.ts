// LUCIAN Phase 17 — Shared Agent Memory helpers.
//
// This module provides the READ and WRITE halves of the user-level
// AgentMemory integration. It is used by eligible AI chat routes
// (/api/ai/chat, /api/economic-agent/chat) so they all share the same
// memory semantics:
//
//   READ:
//     - Gated by Settings → AI Behavior → "Remember Conversations".
//     - If OFF, no memory is loaded (privacy: don't inject persistent
//       conversational memory when the user has disabled it).
//     - Bounded: at most 50 entries, at most 1500 chars total.
//     - DB failure is non-fatal — the chat proceeds without memory.
//
//   WRITE:
//     - Extracts simple structured facts from recent user messages
//       (preferred name, risk tolerance, preferred markets).
//     - NEVER stores full transcripts, project files, or sensitive data.
//     - Upserts by (userId, scope, key) so re-stating a preference
//       updates instead of duplicating.
//     - DB failure is non-fatal — the chat response already succeeded.
//
// IMPORTANT: this module NEVER uploads DevWorkspace project files.
// Project source code stays in IndexedDB / the local browser; only
// user-level memory (preferences, recurring facts) crosses the server
// boundary, and only when "Remember Conversations" is ON.

import { db } from "@/lib/db";

const MAX_MEMORY_ENTRIES = 50;
const MAX_MEMORY_CHARS = 1500;

/** Load the authenticated user's persistent agent memory and format it
 *  as a system-prompt section. Returns null if no memory or if the
 *  DB is unreachable.
 *
 *  Callers MUST gate this behind `behavior.rememberConversations` —
 *  do not call this function when the user has disabled conversation
 *  memory. */
export async function loadAgentMemorySection(userId: string): Promise<string | null> {
  try {
    const memoryEntries = await db.agentMemory.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: MAX_MEMORY_ENTRIES,
      select: { scope: true, key: true, value: true, updatedAt: true },
    });
    if (memoryEntries.length === 0) return null;

    const lines: string[] = [];
    let usedChars = 0;
    for (const e of memoryEntries) {
      const line = `- ${e.key}: ${e.value}`;
      if (usedChars + line.length + 1 > MAX_MEMORY_CHARS) break;
      lines.push(line);
      usedChars += line.length + 1;
    }
    if (lines.length === 0) return null;

    return ["## Persistent user memory (server-backed)", ...lines].join("\n");
  } catch {
    // Database unreachable during the chat request — proceed without
    // memory. The chat still works; we just don't have persistent
    // context for this turn. NEVER block the chat on memory load.
    return null;
  }
}

/** Extract simple structured facts from the user's recent messages and
 *  upsert them as persistent agent memory. This is the WRITE half of
 *  the agent-memory integration.
 *
 *  Extraction is INTENTIONALLY conservative — we only capture:
 *    - "my name is X" / "call me X" / "I am X" (preferred name)
 *    - "my risk tolerance is X" / "I am X" (risk tolerance)
 *    - "interested in X, Y, Z" (preferred markets)
 *
 *  We NEVER store:
 *    - DevWorkspace project files / source code
 *    - The full conversation transcript
 *    - Sensitive financial data (account numbers, balances)
 *
 *  Dedupe: the AgentMemory table has @@unique([userId, scope, key]),
 *  so re-upserting the same key updates the value instead of inserting
 *  a duplicate. */
export async function writeMemoryFromConversation(
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

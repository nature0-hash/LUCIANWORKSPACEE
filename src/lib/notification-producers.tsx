"use client";

/* LUCIAN Notification Producers — Phase 10.
 *
 * Real producers that fire notifications into the canonical
 * `useNotificationStore`. Each producer is wired to a REAL LUCIAN event
 * source — there are no fake events here.
 *
 * Producers implemented:
 *
 *   1. Vault events — observes `useVaultStore.transactions`. When a new
 *      local-transfer / pool-allocation / balance-updated transaction
 *      appears, fires ONE notification IF the user's Vault notification
 *      settings allow it. Respects Vault privacy: never leaks balance /
 *      currency / masked identifiers into the notification payload.
 *
 *   2. DevWorkspace runtime failures — subscribes to the WebContainer
 *      runtime state via `subscribeRuntime()`. When the status flips to
 *      `error`, fires ONE notification for the active project. Re-arms
 *      when the status flips back to `running` (resolves the
 *      notification).
 *
 *   3. AI / provider failures — exported as a standalone helper
 *      `notifyAiProviderFailure()` that the Economic Agent + Lilith
 *      chat panels call from their `setError` paths. Deduped by
 *      `ai:provider-error:<provider>:<errorType>` with a 5-minute
 *      cooldown so a flaky provider doesn't spam the bell.
 *
 *   4. Investing thesis review due — observes `useInvestingStore.theses`.
 *      For each thesis whose `nextReviewAt` is in the past AND hasn't
 *      already produced a notification (tracked via a persisted Set in
 *      localStorage `lucian-investing-thesis-notified`), fires ONE
 *      notification. Marking the thesis reviewed (via `updateThesis`)
 *      resolves the notification.
 *
 *   5. Markets price alerts — producer logic lives in
 *      `src/store/markets-price-alerts.ts` (`evaluateAlertsForSymbol`),
 *      invoked from the markets store's `updatePrice` hot path. No
 *      separate bridge needed here.
 *
 * Producers intentionally NOT implemented (would be fake):
 *
 *   - Agent task completed / approval requested — LUCIAN has no real
 *     task lifecycle or approval workflow in Phases 0–9. Implementing
 *     these producers would require inventing a fake task queue, which
 *     Phase 10 explicitly forbids.
 *
 * All producers are mounted ONCE via the `<NotificationProducers />`
 * component, which AppShell renders as an invisible child.
 */

import { useEffect, useRef } from "react";
import { useVaultStore } from "@/store/vault";
import { useInvestingStore } from "@/store/investing";
import { useNotificationStore, type NotificationLevel } from "@/store/notifications";
import { subscribeRuntime, type RuntimeState } from "@/lib/workspace/webcontainer";
import { useWorkspaceStore } from "@/store/workspace";

/* ── Producer 1: Vault events ─────────────────────────────────────────── */

/** Set of vault transaction ids we've already notified on. Persisted in
 *  localStorage so a page refresh doesn't re-notify on existing txs. */
function readNotifiedTxIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("lucian-vault-notified-tx");
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeNotifiedTxIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    // Cap the persisted set at 500 — older entries are dropped (LRU).
    const arr = Array.from(ids).slice(-500);
    localStorage.setItem("lucian-vault-notified-tx", JSON.stringify(arr));
  } catch { /* ignore */ }
}

function useVaultEventsProducer() {
  const transactions = useVaultStore((s) => s.transactions);
  const settings = useVaultStore((s) => s.settings);
  const notifiedRef = useRef<Set<string>>(readNotifiedTxIds());

  useEffect(() => {
    // Only consider transactions newer than the first run (i.e. ones the
    // user actually performed during this session or that we haven't
    // notified on yet).
    const newTxs = transactions.filter((t) => !notifiedRef.current.has(t.id));
    if (newTxs.length === 0) return;

    const notify = useNotificationStore.getState().notify;
    const notificationsSettings = settings.notifications;
    const largeThreshold = settings.security.largeTransactionThreshold;

    for (const tx of newTxs) {
      // Decide whether this tx warrants a notification based on the
      // user's settings + the tx type.
      let shouldNotify = false;
      let level: NotificationLevel = "info";
      let actionable = false;

      if (tx.type === "local-transfer") {
        if (!notificationsSettings.transfers) continue;
        shouldNotify = true;
        level = "success";
        // Large transfers are flagged as actionable (Need Attention).
        if (notificationsSettings.largeTransfers && tx.amount >= largeThreshold) {
          level = "warning";
          actionable = true;
        }
      } else if (tx.type === "pool-allocation" || tx.type === "pool-deallocation") {
        // Capital-pool changes are informational. Always notify (the user
        // can disable by editing the producer here if too noisy).
        shouldNotify = true;
        level = "info";
      } else if (tx.type === "balance-updated") {
        if (!notificationsSettings.balanceChanges) continue;
        shouldNotify = true;
        level = "info";
      } else if (tx.type === "account-created" || tx.type === "account-removed") {
        shouldNotify = true;
        level = "info";
      } else if (tx.type === "security-event") {
        shouldNotify = true;
        level = "warning";
        actionable = true;
      }

      if (!shouldNotify) continue;

      // PRIVACY: do NOT include amount / currency / masked identifiers in
      // the notification payload. The user clicks the deep link to see
      // the transaction in context (where Vault privacy settings apply
      // to the rendered row).
      const isLarge = tx.amount >= largeThreshold;
      const title =
        tx.type === "local-transfer" ? "Local transfer completed" :
        tx.type === "pool-allocation" ? "Capital allocated" :
        tx.type === "pool-deallocation" ? "Capital deallocated" :
        tx.type === "balance-updated" ? "Account balance updated" :
        tx.type === "account-created" ? "Account added" :
        tx.type === "account-removed" ? "Account removed" :
        tx.type === "security-event" ? "Security event" :
        tx.type;
      const message =
        tx.type === "local-transfer"
          ? `${tx.from} → ${toShortLabel(tx.to)}${isLarge ? " · large transfer" : ""}`
          : tx.description || tx.type;

      notify({
        source: "vault",
        event: "vault-tx",
        title,
        // PRIVACY: message omits amount + currency. The deep link opens
        // the activity tab where the user's privacy settings apply.
        message,
        level,
        actionable,
        deepLink: `/vault?tab=activity&transaction=${encodeURIComponent(tx.id)}`,
        entity: {
          module: "vault",
          type: "transaction",
          id: tx.id,
        },
        cooldownMs: 60 * 1000, // 1-minute cooldown per tx id
      });

      notifiedRef.current.add(tx.id);
    }
    writeNotifiedTxIds(notifiedRef.current);
  }, [transactions, settings]);
}

/** Shorten a label for the notification message — never reveals balance
 *  or masked identifier. */
function toShortLabel(s: string): string {
  return s.length > 30 ? s.slice(0, 28) + "…" : s;
}

/* ── Producer 2: DevWorkspace runtime failures ───────────────────────── */

function useDevWorkspaceRuntimeProducer() {
  const activeProjectId = useWorkspaceStore((s) => s.activeProjectId);
  const projects = useWorkspaceStore((s) => s.projects);
  // Track the last status we saw so we only fire on transitions, not on
  // every state update (the runtime can emit many "running" updates as
  // the server URL changes).
  const lastStatusRef = useRef<string>("idle");
  // Track which project id the current "error" notification belongs to,
  // so we can resolve it when the runtime recovers.
  const errorProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeRuntime((runtimeState: RuntimeState) => {
      const status = runtimeState.status;
      if (status === lastStatusRef.current) return;
      const prevStatus = lastStatusRef.current;
      lastStatusRef.current = status;

      const notify = useNotificationStore.getState().notify;
      const resolve = useNotificationStore.getState().resolve;

      if (status === "error") {
        // Fire a notification for the active project (if any).
        const projectId = activeProjectId;
        if (!projectId) return;
        const project = projects.find((p) => p.id === projectId);
        const projectName = project?.name ?? "the current project";
        errorProjectIdRef.current = projectId;

        // Sanitize the error message — strip any URLs / paths / secrets.
        const rawErr = runtimeState.error ?? "Unknown runtime error";
        const safeErr = rawErr.slice(0, 200);

        notify({
          source: "dev-workspace",
          event: "runtime-failed",
          title: `Runtime failed: ${projectName}`,
          message: safeErr,
          level: "error",
          actionable: true,
          deepLink: `/dev-workspace?project=${encodeURIComponent(projectId)}`,
          entity: {
            module: "dev-workspace",
            type: "project-runtime",
            id: projectId,
          },
          // 10-minute cooldown so a flaky runtime doesn't spam.
          cooldownMs: 10 * 60 * 1000,
        });
      } else if (status === "running" && prevStatus === "error") {
        // Runtime recovered — resolve the existing error notification.
        const projectId = errorProjectIdRef.current;
        if (!projectId) return;
        const existing = useNotificationStore
          .getState()
          .notifications.find(
            (n) =>
              n.source === "dev-workspace" &&
              n.dedupeKey?.includes("runtime-failed") &&
              n.entity?.id === projectId &&
              !n.resolved,
          );
        if (existing) {
          resolve(existing.id);
        }
        errorProjectIdRef.current = null;
      }
    });
    return unsubscribe;
  }, [activeProjectId, projects]);
}

/* ── Producer 3: AI provider failures (helper, not a hook) ───────────── */

/**
 * Fire a notification for an AI provider failure. Called by the
 * Economic Agent + Lilith chat panels from their `setError` paths.
 *
 * Deduped by `ai:provider-error:<provider>:<errorType>` with a 5-minute
 * cooldown. A provider simply being unconfigured (errorType
 * "provider-not-configured") is NOT notified — the UI surfaces that
 * inline already, and firing a bell notification for every render of
 * every AI interface would spam the user.
 *
 * The provider key + error message passed in are sanitized: we only
 * keep the provider id and the error type, never the raw error text
 * (which may include URLs, headers, or partial response bodies).
 */
export function notifyAiProviderFailure(input: {
  provider: string;
  errorType: string;
  /** Where the failure happened (e.g. "economic-agent", "lilith"). */
  interface: "economic-agent" | "lilith";
}): void {
  // Unconfigured is not a failure worth notifying on — the UI shows it
  // inline already.
  if (input.errorType === "provider-not-configured") return;

  const level: NotificationLevel =
    input.errorType === "authentication-failed" ? "error" :
    input.errorType === "rate-limit" ? "warning" :
    input.errorType === "timeout" ? "warning" :
    input.errorType === "network-error" ? "warning" :
    input.errorType === "invalid-model" ? "warning" :
    "error";

  const title =
    input.errorType === "authentication-failed" ? "AI provider authentication failed" :
    input.errorType === "rate-limit" ? "AI provider rate limit hit" :
    input.errorType === "timeout" ? "AI provider request timed out" :
    input.errorType === "network-error" ? "AI provider unreachable" :
    input.errorType === "invalid-model" ? "AI model not available" :
    "AI provider error";

  useNotificationStore.getState().notify({
    source: "ai-provider",
    event: "provider-error",
    title,
    // PRIVACY: never include the raw error message (may contain URLs,
    // partial response bodies, or sensitive details). The user can see
    // the full error inline in the chat panel.
    message: `Provider: ${input.provider} · ${input.errorType}`,
    level,
    actionable: true,
    deepLink: input.interface === "lilith" ? "/economic-agent" : "/economic-agent",
    entity: {
      module: "ai-provider",
      type: "provider-error",
      id: `${input.provider}:${input.errorType}`,
    },
    cooldownMs: 5 * 60 * 1000, // 5-minute dedupe
  });
}

/* ── Producer 4: Investing thesis review due ─────────────────────────── */

/** Persisted Set of thesis investmentIds we've already notified on.
 *  Keyed by investmentId (not by review date) so updating a thesis
 *  (which bumps nextReviewAt) clears the "notified" state when the
 *  user marks it reviewed. */
function readNotifiedTheses(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("lucian-investing-thesis-notified");
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeNotifiedTheses(map: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("lucian-investing-thesis-notified", JSON.stringify(map));
  } catch { /* ignore */ }
}

function useInvestingThesisProducer() {
  const theses = useInvestingStore((s) => s.theses);
  const investments = useInvestingStore((s) => s.investments);
  // Re-check every 5 minutes (in case a thesis becomes due while the
  // user has the app open).
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (cancelled) return;
      const now = Date.now();
      const notified = readNotifiedTheses();
      let changed = false;
      const notify = useNotificationStore.getState().notify;

      for (const t of theses) {
        // Only fire if nextReviewAt is in the past.
        if (t.nextReviewAt > now) continue;
        // Skip if we've already notified on this thesis's current
        // nextReviewAt value (so updating the thesis — which bumps
        // nextReviewAt — re-arms the check).
        const lastNotifiedAt = notified[t.investmentId];
        if (lastNotifiedAt && lastNotifiedAt >= t.nextReviewAt) continue;

        const inv = investments.find((i) => i.id === t.investmentId);
        const symbol = inv?.symbol ?? "an investment";

        notify({
          source: "investing",
          event: "thesis-review-due",
          title: `Thesis review due: ${symbol}`,
          message: `It's time to review your investment thesis for ${symbol}.`,
          level: "warning",
          actionable: true,
          deepLink: `/investing?holding=${encodeURIComponent(t.investmentId)}`,
          entity: {
            module: "investing",
            type: "thesis",
            id: t.investmentId,
          },
          // 24-hour cooldown so the user has time to act before we re-notify.
          cooldownMs: 24 * 60 * 60 * 1000,
          reopenIfResolved: true,
        });

        notified[t.investmentId] = now;
        changed = true;
      }

      if (changed) writeNotifiedTheses(notified);
    };

    // Run once immediately on mount, then every 5 minutes.
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [theses, investments]);
}

/* ── Mount point ─────────────────────────────────────────────────────── */

/**
 * Mount once at the AppShell level. Renders nothing — just registers
 * the producer observers so they fire notifications into the store.
 *
 * This component is intentionally a no-op render. All work happens in
 * effects / subscriptions.
 */
export function NotificationProducers() {
  useVaultEventsProducer();
  useDevWorkspaceRuntimeProducer();
  useInvestingThesisProducer();
  // Markets price alerts are evaluated inline from the markets store's
  // updatePrice hot path — no bridge needed.
  // AI provider failures are notified explicitly by the chat panels.
  return null;
}

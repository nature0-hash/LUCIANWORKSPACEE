"use client";

/* LUCIAN Settings — Connections section.
 *
 * Global external-service status center. Status only — actual
 * provider linking / configuration lives inside each module
 * (AI config, Vault, DevWorkspace).
 *
 * Vault provider state uses the honest model:
 *   not_configured → setup_required → configured → connected
 * Stub adapters NEVER show "connected" just from env keys.
 *
 * DATABASE_URL is NEVER exposed — only its availability is reported.
 */

import { useEffect, useState } from "react";
import {
  SettingsGroup, SettingsRow, SettingsSectionHeader, StatusPill,
} from "@/components/settings/primitives";
import { PROVIDERS, type ProviderId } from "@/store/shared-ai-config";

type ProbeStatus = "checking" | "configured" | "not_configured" | "unavailable";

interface AiProbeResult {
  provider: ProviderId;
  status: ProbeStatus;
}

interface VaultProvidersResult {
  stripe: { state: string; configured: boolean; detail: string };
  plaid: { state: string; configured: boolean; detail: string };
  coinbase: { state: string; configured: boolean; detail: string };
  alpaca: { state: string; configured: boolean; detail: string };
  database: { configured: boolean };
}

export function ConnectionsSection() {
  const [aiResults, setAiResults] = useState<AiProbeResult[]>(
    PROVIDERS.map((p) => ({ provider: p.id, status: "checking" as ProbeStatus })),
  );
  const [vault, setVault] = useState<VaultProvidersResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Probe all AI providers in parallel.
      const results = await Promise.all(
        PROVIDERS.map(async (p): Promise<AiProbeResult> => {
          try {
            const res = await fetch(`/api/health/ai-probe?provider=${encodeURIComponent(p.id)}`, { cache: "no-store" });
            if (!res.ok) return { provider: p.id, status: "unavailable" };
            const data = (await res.json()) as { configured: boolean };
            return { provider: p.id, status: data.configured ? "configured" : "not_configured" };
          } catch {
            return { provider: p.id, status: "unavailable" };
          }
        }),
      );
      if (!cancelled) setAiResults(results);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/vault/providers", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) { setVault(null); return; }
        const data = (await res.json()) as {
          providers: Array<{ id: string; name: string; type: string; configured: boolean; state: string; stateDetail?: string }>;
        };
        const byId = Object.fromEntries(data.providers.map((p) => [p.name, p]));
        setVault({
          stripe: { state: byId.stripe?.state ?? "not_configured", configured: byId.stripe?.configured ?? false, detail: byId.stripe?.stateDetail ?? "" },
          plaid: { state: byId.plaid?.state ?? "not_configured", configured: byId.plaid?.configured ?? false, detail: byId.plaid?.stateDetail ?? "" },
          coinbase: { state: byId.coinbase?.state ?? "not_configured", configured: byId.coinbase?.configured ?? false, detail: byId.coinbase?.stateDetail ?? "" },
          alpaca: { state: byId.alpaca?.state ?? "not_configured", configured: byId.alpaca?.configured ?? false, detail: byId.alpaca?.stateDetail ?? "" },
          database: { configured: false }, // probed separately
        });

        // Probe database availability separately (it's not in the providers list).
        const dbRes = await fetch("/api/vault/balances", { cache: "no-store" });
        if (cancelled) return;
        if (dbRes.ok) {
          const dbData = (await dbRes.json()) as { databaseAvailable?: boolean };
          setVault((v) => v ? { ...v, database: { configured: dbData.databaseAvailable === true } } : v);
        }
      } catch {
        if (!cancelled) setVault(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <SettingsSectionHeader
        title="Connections"
        subtitle="Status of every external service LUCIAN can talk to. Status only — actual setup lives inside each module."
      />

      <SettingsGroup title="AI Providers">
        {PROVIDERS.map((p) => {
          const result = aiResults.find((r) => r.provider === p.id);
          return (
            <SettingsRow
              key={p.id}
              title={p.name}
              description={`Environment variable: ${p.envKey} (server-side only).`}
            >
              <ProbeStatusPill status={result?.status ?? "checking"} />
            </SettingsRow>
          );
        })}
        <div className="py-2 text-[11px] text-fg-muted">
          &quot;Configured&quot; means the environment variable is present. It does NOT mean the key is valid — run Test Connection in AI &amp; Models to verify.
        </div>
      </SettingsGroup>

      <SettingsGroup title="Development">
        <SettingsRow title="GitHub Public Import" description="Import a public GitHub repository as a DevWorkspace project. No authentication required.">
          <StatusPill status="ready" label="Available" />
        </SettingsRow>
        <SettingsRow title="GitHub Account" description="Private repository access requires GitHub account authentication.">
          <StatusPill status="setup_required" label="Authentication not configured" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Market / Data">
        <SettingsRow title="Markets data provider" description="The markets data provider used by the Markets module.">
          <StatusPill status="ready" label="Available" />
        </SettingsRow>
        <SettingsRow title="News / data providers" description="News, sports, weather, and watchlist-match providers.">
          <StatusPill status="ready" label="Available" />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Vault / Finance">
        <SettingsRow
          title="Stripe"
          description="Vault payment provider (card deposits / payouts). Honest state from the Vault adapter."
        >
          <VaultStatusPill state={vault?.stripe.state ?? "not_configured"} detail={vault?.stripe.detail} />
        </SettingsRow>
        <SettingsRow
          title="Plaid"
          description="Vault bank provider (ACH deposits / withdrawals)."
        >
          <VaultStatusPill state={vault?.plaid.state ?? "not_configured"} detail={vault?.plaid.detail} />
        </SettingsRow>
        <SettingsRow
          title="Coinbase"
          description="Vault crypto provider (custody / withdrawals)."
        >
          <VaultStatusPill state={vault?.coinbase.state ?? "not_configured"} detail={vault?.coinbase.detail} />
        </SettingsRow>
        <SettingsRow
          title="Alpaca"
          description="Vault broker provider (trading / funding)."
        >
          <VaultStatusPill state={vault?.alpaca.state ?? "not_configured"} detail={vault?.alpaca.detail} />
        </SettingsRow>
        <SettingsRow
          title="Database / Neon"
          description="Postgres connection for the Vault financial ledger. The DATABASE_URL value is never exposed."
        >
          {vault?.database.configured
            ? <StatusPill status="configured" label="Database configured" />
            : <StatusPill status="not_configured" label="Database not configured" />}
        </SettingsRow>
        <div className="py-2 text-[11px] text-fg-muted">
          Stub Vault providers never display &quot;Connected&quot; — they show &quot;Integration required&quot; until the real SDK is installed AND the user completes the provider-side link flow. API keys alone do NOT enable a stub provider.
        </div>
      </SettingsGroup>
    </div>
  );
}

/* ── Helpers ── */

function ProbeStatusPill({ status }: { status: ProbeStatus }) {
  if (status === "checking") return <StatusPill status="unavailable" label="Checking…" />;
  if (status === "configured") return <StatusPill status="configured" label="Configured" />;
  if (status === "unavailable") return <StatusPill status="unavailable" label="Probe failed" />;
  return <StatusPill status="not_configured" label="Not configured" />;
}

function VaultStatusPill({ state, detail }: { state: string; detail?: string }) {
  switch (state) {
    case "connected":      return <StatusPill status="ready" label="Connected" />;
    case "configured":     return <StatusPill status="configured" label="Configured" />;
    case "setup_required": return <StatusPill status="setup_required" label="Integration required" />;
    case "connecting":     return <StatusPill status="configured" label="Connecting…" />;
    case "restricted":     return <StatusPill status="error" label="Restricted" />;
    case "error":          return <StatusPill status="error" label="Error" />;
    case "not_configured":
    default:               return <StatusPill status="not_configured" label={detail || "Not configured"} />;
  }
}

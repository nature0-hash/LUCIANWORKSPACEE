"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Bitcoin, Copy, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import { toast } from "@/hooks/use-toast";
import { VaultCard, VaultCardBody, VaultCardHeader } from "@/components/vault/primitives";

type WalletAccount = { id: string; name: string; asset: string; balance: string; available: string; primary: boolean; type: string };
type Settings = { configured: boolean; transfersEnabled: boolean; maxSendUsd: number; allowedAssets: string[]; allowedNetworks: string[] };
type ReceiveAddress = { id: string; asset: string; network: string; address: string; label?: string | null; createdAt: string };
type Transfer = { id: string; asset: string; network: string; destinationMasked: string; amount: string; estimatedUsd: string; state: string; providerTransactionId?: string | null; createdAt: string };
type Preview = {
  intentId: string; asset: string; network: string; amount: string; estimatedUsd: number;
  destinationMasked: string; destinationTag?: string; confirmationText: string;
  expiresAt: string; transfersEnabled: boolean; warning: string;
};

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}

function statusClass(state: string): string {
  if (state === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
  if (["rejected", "failed", "expired", "submission_unknown"].includes(state)) return "border-red-500/30 bg-red-500/10 text-red-300";
  return "border-amber-500/30 bg-amber-500/10 text-amber-300";
}

export function CoinbaseMoneyCenter() {
  const [accounts, setAccounts] = useState<WalletAccount[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [addresses, setAddresses] = useState<ReceiveAddress[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiveAccountId, setReceiveAccountId] = useState("");
  const [receiveNetwork, setReceiveNetwork] = useState("");
  const [sendAccountId, setSendAccountId] = useState("");
  const [sendNetwork, setSendNetwork] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [destinationTag, setDestinationTag] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [password, setPassword] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accountResponse, addressResponse, transferResponse] = await Promise.all([
        fetch("/api/vault/coinbase/accounts", { cache: "no-store" }),
        fetch("/api/vault/coinbase/receive", { cache: "no-store" }),
        fetch("/api/vault/coinbase/transfers", { cache: "no-store" }),
      ]);
      const accountData = await readJson<{ accounts: WalletAccount[]; settings: Settings }>(accountResponse);
      const addressData = await readJson<{ addresses: ReceiveAddress[] }>(addressResponse);
      const transferData = await readJson<{ transfers: Transfer[] }>(transferResponse);
      setAccounts(accountData.accounts);
      setSettings(accountData.settings);
      setAddresses(addressData.addresses);
      setTransfers(transferData.transfers);
      setError(null);
      const first = accountData.accounts[0];
      if (first) {
        setReceiveAccountId((current) => current || first.id);
        setSendAccountId((current) => current || first.id);
      }
      const firstNetwork = accountData.settings.allowedNetworks[0] ?? "";
      setReceiveNetwork((current) => current || firstNetwork);
      setSendNetwork((current) => current || firstNetwork);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Coinbase could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const sendAccount = useMemo(() => accounts.find((account) => account.id === sendAccountId), [accounts, sendAccountId]);

  async function generateAddress() {
    if (!receiveAccountId || !receiveNetwork) return;
    setWorking(true);
    try {
      const response = await fetch("/api/vault/coinbase/receive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: receiveAccountId, network: receiveNetwork, label: "LUCIAN Vault deposit" }),
      });
      const data = await readJson<{ address: ReceiveAddress }>(response);
      setAddresses((current) => [data.address, ...current.filter((item) => item.id !== data.address.id)]);
      toast({ title: "Receive address generated", description: `Verify the ${data.address.network} network before sending funds.` });
    } catch (requestError) {
      toast({ title: "Address generation failed", description: requestError instanceof Error ? requestError.message : "Unknown error", variant: "destructive" });
    } finally { setWorking(false); }
  }

  async function copyAddress(address: string) {
    await navigator.clipboard.writeText(address);
    toast({ title: "Address copied", description: "Verify it again in Coinbase before transferring a large amount." });
  }

  async function createPreview() {
    setWorking(true);
    setPreview(null);
    setPassword("");
    setConfirmationText("");
    try {
      const response = await fetch("/api/vault/coinbase/send/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: sendAccountId, amount, destination, destinationTag, network: sendNetwork }),
      });
      setPreview(await readJson<Preview>(response));
    } catch (requestError) {
      toast({ title: "Transfer preview failed", description: requestError instanceof Error ? requestError.message : "Unknown error", variant: "destructive" });
    } finally { setWorking(false); }
  }

  async function confirmSend() {
    if (!preview) return;
    setWorking(true);
    try {
      const response = await fetch("/api/vault/coinbase/send/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId: preview.intentId, password, confirmationText }),
      });
      const data = await readJson<{ state: string; providerTransactionId: string }>(response);
      toast({ title: "Coinbase transfer submitted", description: `Status: ${data.state}. Coinbase transaction: ${data.providerTransactionId}` });
      setPreview(null);
      setPassword("");
      setConfirmationText("");
      setAmount("");
      setDestination("");
      setDestinationTag("");
      await load();
    } catch (requestError) {
      toast({ title: "Transfer was not confirmed", description: requestError instanceof Error ? requestError.message : "Unknown error", variant: "destructive" });
    } finally { setWorking(false); }
  }

  if (loading) {
    return <VaultCard><VaultCardBody><div className="flex items-center gap-2 text-[11px] text-fg-muted"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Loading Coinbase wallets…</div></VaultCardBody></VaultCard>;
  }
  if (error || !settings) {
    return <VaultCard><VaultCardHeader title="Coinbase Live Crypto" icon={<Bitcoin className="h-4 w-4" />} /><VaultCardBody><div className="rounded border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-200/80">{error ?? "Coinbase is not connected."}</div></VaultCardBody></VaultCard>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 themed">
        <div className="flex items-center gap-2 text-[11px] text-fg-muted"><ShieldCheck className="h-4 w-4 text-emerald-400" />Coinbase owner connection · Receive enabled · Sends require password and exact confirmation</div>
        <Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <VaultCard>
          <VaultCardHeader title="Receive Crypto" subtitle="Generate a Coinbase deposit address" icon={<ArrowDownToLine className="h-4 w-4" />} />
          <VaultCardBody>
            <div className="space-y-3">
              <FieldSelect label="Coinbase wallet" value={receiveAccountId} onChange={setReceiveAccountId} options={accounts.map((account) => ({ value: account.id, label: `${account.name} · ${account.available} ${account.asset}` }))} />
              <FieldSelect label="Network" value={receiveNetwork} onChange={setReceiveNetwork} options={settings.allowedNetworks.map((network) => ({ value: network, label: network }))} />
              <Button onClick={() => void generateAddress()} disabled={working || !receiveAccountId}>Generate receive address</Button>
              <p className="text-[10.5px] leading-relaxed text-fg-faint">Only send the selected asset on the exact network shown. A mismatched asset or network can permanently lose funds.</p>
              {addresses.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-md border border-line-muted bg-inset p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[11px] font-medium text-fg">{item.asset} · {item.network}</span><Button variant="ghost" size="sm" onClick={() => void copyAddress(item.address)}><Copy className="h-3.5 w-3.5" />Copy</Button></div>
                  <code className="mt-2 block break-all text-[10.5px] text-fg-muted">{item.address}</code>
                </div>
              ))}
            </div>
          </VaultCardBody>
        </VaultCard>

        <VaultCard>
          <VaultCardHeader title="Send Crypto" subtitle={`Owner-only · Current limit $${settings.maxSendUsd.toFixed(2)} USD`} icon={<ArrowUpFromLine className="h-4 w-4" />} />
          <VaultCardBody>
            {!settings.transfersEnabled && <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/5 p-2.5 text-[10.5px] text-amber-200/80">Preview is available, but submission is locked. Set COINBASE_TRANSFERS_ENABLED=true only after a receive/balance test succeeds.</div>}
            <div className="space-y-3">
              <FieldSelect label="From Coinbase wallet" value={sendAccountId} onChange={(value) => { setSendAccountId(value); setPreview(null); }} options={accounts.map((account) => ({ value: account.id, label: `${account.name} · ${account.available} ${account.asset}` }))} />
              <div className="grid grid-cols-2 gap-3"><Field label={`Amount${sendAccount ? ` (${sendAccount.asset})` : ""}`} value={amount} onChange={setAmount} type="number" /><FieldSelect label="Network" value={sendNetwork} onChange={setSendNetwork} options={settings.allowedNetworks.map((network) => ({ value: network, label: network }))} /></div>
              <Field label="Destination address" value={destination} onChange={setDestination} />
              <Field label="Destination tag / memo (only if required)" value={destinationTag} onChange={setDestinationTag} />
              <Button variant="outline" className="border-line-muted" onClick={() => void createPreview()} disabled={working || !sendAccountId}>Review transfer</Button>
            </div>

            {preview && (
              <div className="mt-4 space-y-3 rounded-md border border-red-500/35 bg-red-500/5 p-3">
                <div className="text-[11px] font-semibold text-red-300">Irreversible transfer confirmation</div>
                <div className="grid grid-cols-2 gap-2 text-[10.5px] text-fg-muted"><span>Amount</span><span className="text-right font-mono text-fg">{preview.amount} {preview.asset}</span><span>Estimated value</span><span className="text-right font-mono text-fg">${Number(preview.estimatedUsd).toFixed(2)}</span><span>Network</span><span className="text-right text-fg">{preview.network}</span><span>Destination</span><span className="text-right font-mono text-fg">{preview.destinationMasked}</span></div>
                <p className="text-[10.5px] leading-relaxed text-red-200/80">{preview.warning}</p>
                <Field label="Current LUCIAN password" value={password} onChange={setPassword} type="password" />
                <div><Label className="text-[10.5px] text-fg-muted">Type exactly: <code className="select-all text-red-300">{preview.confirmationText}</code></Label><Input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} className="mt-1.5 font-mono text-[11px]" autoComplete="off" /></div>
                <Button onClick={() => void confirmSend()} disabled={working || !settings.transfersEnabled || confirmationText !== preview.confirmationText || !password} className="w-full">Confirm and send through Coinbase</Button>
              </div>
            )}
          </VaultCardBody>
        </VaultCard>
      </div>

      {transfers.length > 0 && <VaultCard><VaultCardHeader title="Coinbase Send Audit" subtitle="Cross-device owner transfer history" /><VaultCardBody><div className="space-y-2">{transfers.slice(0, 10).map((item) => <div key={item.id} className="flex items-center gap-3 rounded-md border border-line-muted bg-surface p-3"><div className="flex-1"><div className="text-[11px] font-medium text-fg">{item.amount} {item.asset} · {item.network}</div><div className="mt-0.5 text-[10px] text-fg-faint">To {item.destinationMasked} · ~${Number(item.estimatedUsd).toFixed(2)} · {new Date(item.createdAt).toLocaleString()}</div></div><span className={`rounded border px-2 py-0.5 text-[9px] font-semibold uppercase ${statusClass(item.state)}`}>{item.state.replace("_", " ")}</span></div>)}</div></VaultCardBody></VaultCard>}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <div><Label className="text-[10.5px] uppercase tracking-wider text-fg-muted">{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 font-mono text-[11px]" autoComplete={type === "password" ? "current-password" : "off"} /></div>;
}

function FieldSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <div><Label className="text-[10.5px] uppercase tracking-wider text-fg-muted">{label}</Label><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-9 w-full rounded-md border border-line-muted bg-surface px-3 text-[11px] text-fg"><option value="">Select…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}

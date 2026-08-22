"use client";

import { useState } from "react";
import {
  Banknote,
  CreditCard,
  Plus,
  Trash2,
  Wallet,
  TrendingUp,
  Building2,
  Bot,
  Shield,
  ArrowRight,
} from "lucide-react";
import { useVaultStore, type ConnectedAccount } from "@/store/vault";
import { useMarketsStore } from "@/store/markets";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-devspace/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-devspace/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function VaultDashboard() {
  const {
    accounts,
    pools,
    transactions,
    addAccount,
    removeAccount,
    allocateToPool,
    deallocateFromPool,
    setPoolFeedsMarkets,
    setPoolAgentAccessible,
    getTotalConnectedCapital,
    getAllocatedCapital,
    getAvailableCapital,
    getTradingCapital,
    getAgentCapital,
  } = useVaultStore();

  const [addOpen, setAddOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState<string | null>(null);
  const [allocAmount, setAllocAmount] = useState("");

  const totalConnected = getTotalConnectedCapital();
  const allocated = getAllocatedCapital();
  const available = getAvailableCapital();
  const trading = getTradingCapital();
  const agent = getAgentCapital();

  return (
    <div className="themed h-full overflow-y-auto bg-canvas text-fg">
      <div className="mx-auto max-w-5xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">LUCIAN Vault</h1>
            <p className="mt-0.5 text-xs text-fg-muted">
              Financial control center — connected accounts, capital pools, and allocations.
            </p>
          </div>
        </div>

        {/* Summary row */}
        <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="Connected" value={totalConnected} icon={Wallet} />
          <SummaryCard label="Allocated" value={allocated} icon={ArrowRight} />
          <SummaryCard label="Available" value={available} icon={Banknote} />
          <SummaryCard label="Trading" value={trading} icon={TrendingUp} accent />
        </div>

        {/* Connected accounts */}
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
              Connected Accounts ({accounts.length})
            </h2>
            <Button size="sm" className="h-6 text-[11px]" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1 h-3 w-3" /> Connect
            </Button>
          </div>
          {accounts.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-muted px-4 py-6 text-center">
              <p className="text-xs text-fg-muted">No connected accounts.</p>
              <p className="mt-0.5 text-[11px] text-fg-faint">
                Connect a bank, card, crypto wallet, or brokerage to start managing capital.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line-muted rounded-md border border-line">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 bg-surface px-3 py-2">
                  <AccountIcon type={a.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-fg">{a.label}</p>
                    <p className="text-[10px] text-fg-faint">
                      {a.provider} · {a.maskedIdentifier} · {a.currency}
                    </p>
                  </div>
                  <span className="font-mono text-xs text-fg">${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button
                    onClick={() => removeAccount(a.id)}
                    className="text-fg-faint hover:text-red-500"
                    title="Disconnect"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Capital pools */}
        <section className="mb-6">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
            Capital Pools
          </h2>
          <div className="rounded-md border border-line">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line-muted text-fg-faint">
                  <th className="px-3 py-1.5 text-left font-medium">Pool</th>
                  <th className="px-3 py-1.5 text-right font-medium">Allocated</th>
                  <th className="px-3 py-1.5 text-center font-medium">Markets</th>
                  <th className="px-3 py-1.5 text-center font-medium">Agent</th>
                  <th className="px-3 py-1.5 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((p) => (
                  <tr key={p.id} className="border-b border-line-muted/50 hover:bg-hover">
                    <td className="px-3 py-1.5 font-medium text-fg">{p.label}</td>
                    <td className="px-3 py-1.5 text-right font-mono tabular-nums text-fg">
                      ${p.allocated.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Toggle checked={p.feedsMarkets} onChange={(v) => setPoolFeedsMarkets(p.id, v)} />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <Toggle checked={p.agentAccessible} onChange={(v) => setPoolAgentAccessible(p.id, v)} />
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <button
                        onClick={() => { setAllocOpen(p.id); setAllocAmount(""); }}
                        className="text-[10px] text-accent hover:underline"
                      >
                        {p.allocated > 0 ? "Adjust" : "Allocate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allocOpen && (
            <AllocateDialog
              poolId={allocOpen}
              poolLabel={pools.find((p) => p.id === allocOpen)?.label ?? allocOpen}
              currentAmount={pools.find((p) => p.id === allocOpen)?.allocated ?? 0}
              amount={allocAmount}
              setAmount={setAllocAmount}
              onAllocate={(amt) => { allocateToPool(allocOpen, amt); setAllocOpen(null); toast({ title: "Capital allocated" }); }}
              onDeallocate={(amt) => { deallocateFromPool(allocOpen, amt); setAllocOpen(null); toast({ title: "Capital deallocated" }); }}
              onClose={() => setAllocOpen(null)}
            />
          )}
        </section>

        {/* Agent Capital */}
        <section className="mb-6">
          <div className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2">
            <Bot className="h-4 w-4 text-accent" />
            <div className="flex-1">
              <p className="text-xs font-medium text-fg">Agent Capital</p>
              <p className="text-[10px] text-fg-faint">
                Explicitly allocated. The Agent can only use capital from this pool — never automatic access to all funds.
              </p>
            </div>
            <span className="font-mono text-xs text-fg">
              ${agent.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </section>

        {/* Recent activity */}
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">
            Recent Activity
          </h2>
          {transactions.length === 0 ? (
            <div className="rounded-md border border-dashed border-line-muted px-4 py-3 text-center text-xs text-fg-faint">
              No transactions yet.
            </div>
          ) : (
            <ul className="divide-y divide-line-muted rounded-md border border-line">
              {transactions.slice(0, 20).map((t) => (
                <li key={t.id} className="flex items-center gap-2 bg-surface px-3 py-1.5 text-[11px]">
                  <span className="font-mono text-fg-muted">{t.from}</span>
                  <ArrowRight className="h-2.5 w-2.5 text-fg-faint" />
                  <span className="font-mono text-fg-muted">{t.to}</span>
                  <span className="ml-auto font-mono text-fg">${t.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <span className="text-[9px] text-fg-faint">{new Date(t.timestamp).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Add account dialog */}
      <AddAccountDialog open={addOpen} onOpenChange={setAddOpen} onAdd={addAccount} />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: typeof Wallet;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-md border px-3 py-2", accent ? "border-accent/30 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))]" : "border-line bg-surface")}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3 w-3", accent ? "text-accent" : "text-fg-faint")} />
        <span className="text-[10px] uppercase tracking-wide text-fg-faint">{label}</span>
      </div>
      <p className="mt-1 font-mono text-sm font-medium text-fg">
        ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}

function AccountIcon({ type }: { type: ConnectedAccount["type"] }) {
  const Icon =
    type === "bank" ? Building2
    : type === "card" ? CreditCard
    : type === "crypto-wallet" ? Wallet
    : type === "brokerage" ? TrendingUp
    : type === "trading" ? TrendingUp
    : Banknote;
  return <Icon className="h-4 w-4 shrink-0 text-fg-muted" />;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-3.5 w-6 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
          checked ? "translate-x-3" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function AllocateDialog({
  poolId,
  poolLabel,
  currentAmount,
  amount,
  setAmount,
  onAllocate,
  onDeallocate,
  onClose,
}: {
  poolId: string;
  poolLabel: string;
  currentAmount: number;
  amount: string;
  setAmount: (v: string) => void;
  onAllocate: (amt: number) => void;
  onDeallocate: (amt: number) => void;
  onClose: () => void;
}) {
  void poolId;
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-3 py-2">
          <DialogTitle className="text-xs font-medium">{poolLabel}</DialogTitle>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">✕</button>
        </DialogHeader>
        <div className="space-y-2 p-3">
          <p className="text-[10px] text-fg-faint">Current: ${currentAmount.toFixed(2)}</p>
          <Input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (USD)"
            className="text-xs"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1"
              disabled={!amount || parseFloat(amount) <= 0}
              onClick={() => onAllocate(parseFloat(amount))}
            >
              Allocate
            </Button>
            {currentAmount > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={!amount || parseFloat(amount) <= 0}
                onClick={() => onDeallocate(parseFloat(amount))}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddAccountDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (a: Omit<ConnectedAccount, "id" | "connectedAt">) => void;
}) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState<ConnectedAccount["type"]>("bank");
  const [provider, setProvider] = useState("");
  const [balance, setBalance] = useState("");
  const [maskedId, setMaskedId] = useState("");

  const handleSubmit = () => {
    if (!label.trim() || !provider.trim()) return;
    onAdd({
      label: label.trim(),
      type,
      provider: provider.trim(),
      maskedIdentifier: maskedId.trim() || "••••",
      balance: parseFloat(balance) || 0,
      currency: "USD",
    });
    setLabel("");
    setProvider("");
    setBalance("");
    setMaskedId("");
    onOpenChange(false);
    toast({ title: "Account connected" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-3 py-2">
          <DialogTitle className="text-xs font-medium">Connect Account</DialogTitle>
          <button onClick={() => onOpenChange(false)} className="text-fg-muted hover:text-fg">✕</button>
        </DialogHeader>
        <div className="space-y-2 p-3">
          <div>
            <Label className="text-[10px] text-fg-faint">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Main checking" className="mt-0.5 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-fg-faint">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ConnectedAccount["type"])}>
              <SelectTrigger className="mt-0.5 h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">Bank account</SelectItem>
                <SelectItem value="card">Card / payment</SelectItem>
                <SelectItem value="crypto-wallet">Crypto wallet</SelectItem>
                <SelectItem value="brokerage">Brokerage</SelectItem>
                <SelectItem value="trading">Trading account</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] text-fg-faint">Provider</Label>
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. Chase, Binance" className="mt-0.5 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-fg-faint">Masked identifier (last 4)</Label>
            <Input value={maskedId} onChange={(e) => setMaskedId(e.target.value)} placeholder="e.g. 1234" className="mt-0.5 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] text-fg-faint">Balance (USD)</Label>
            <Input type="number" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" className="mt-0.5 text-xs" />
          </div>
          <p className="flex items-center gap-1 text-[9px] text-fg-faint">
            <Shield className="h-2.5 w-2.5" />
            No raw card numbers are stored. Use masked identifiers only.
          </p>
          <Button size="sm" className="w-full" disabled={!label.trim() || !provider.trim()} onClick={handleSubmit}>
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

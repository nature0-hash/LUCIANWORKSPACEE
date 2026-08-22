"use client";

import { useState, useCallback } from "react";
import { PieChart, Plus, Trash2, Pencil, TrendingUp, TrendingDown } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import { Textarea } from "@/components/ui-devspace/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui-devspace/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-investments";

type Status = "WATCHING" | "HOLDING" | "EXITED";

interface Holding {
  id: string; symbol: string; name: string; quantity: number; avgCost: number;
  status: Status; thesis: string; horizon: string; invalidation: string;
  createdAt: number;
}

function load(): Holding[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function save(items: Holding[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export default function InvestingPage() {
  const [holdings, setHoldings] = useState<Holding[]>(() => load());
  const [dialog, setDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<Holding | null>(null);


  const update = useCallback((next: Holding[]) => { setHoldings(next); save(next); }, []);

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-accent" />
          <h1 className="text-base font-semibold">Investing</h1>
        </div>
        <Button size="sm" className="h-6 text-[11px]" onClick={() => { setEditTarget(null); setDialog(true); }}>
          <Plus className="mr-1 h-3 w-3" />Add Position
        </Button>
      </div>

      {holdings.length === 0 ? (
        <div className="rounded-md border border-dashed border-line-muted p-8 text-center">
          <p className="text-xs text-fg-muted">No positions yet.</p>
          <p className="mt-0.5 text-[11px] text-fg-faint">Track your long-term investment holdings with thesis, horizon, and exit conditions.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {holdings.map(h => (
            <div key={h.id} className="themed rounded-md border border-line bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs font-medium text-fg">{h.symbol}</p>
                  <p className="truncate text-[10px] text-fg-faint">{h.name}</p>
                </div>
                <span className={cn("shrink-0 rounded px-1 py-0.5 text-[9px] font-bold", h.status === "HOLDING" ? "bg-green-500/20 text-green-500" : h.status === "WATCHING" ? "bg-amber-500/20 text-amber-500" : "bg-zinc-500/20 text-zinc-500")}>
                  {h.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-fg-faint">
                <span>Qty: <span className="font-mono text-fg-muted">{h.quantity}</span></span>
                <span>Avg: <span className="font-mono text-fg-muted">${h.avgCost.toFixed(2)}</span></span>
                <span>Value: <span className="font-mono text-fg-muted">${(h.quantity * h.avgCost).toFixed(2)}</span></span>
                <span>Horizon: <span className="text-fg-muted">{h.horizon || "—"}</span></span>
              </div>
              {h.thesis && <p className="mt-1.5 line-clamp-2 text-[10px] text-fg-muted">{h.thesis}</p>}
              {h.invalidation && <p className="mt-1 text-[9px] text-amber-500">⚠ Exit if: {h.invalidation}</p>}
              <div className="mt-2 flex gap-1">
                <Button size="sm" variant="ghost" className="h-5 text-[9px]" onClick={() => { setEditTarget(h); setDialog(true); }}>
                  <Pencil className="h-2.5 w-2.5" /> Edit
                </Button>
                <Button size="sm" variant="ghost" className="h-5 text-[9px] text-red-500" onClick={() => update(holdings.filter(x => x.id !== h.id))}>
                  <Trash2 className="h-2.5 w-2.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {dialog && (
        <HoldingDialog
          target={editTarget}
          onClose={() => setDialog(false)}
          onSave={(h) => {
            if (editTarget) {
              update(holdings.map(x => x.id === editTarget.id ? { ...h, id: editTarget.id, createdAt: editTarget.createdAt } : x));
              toast({ title: "Position updated" });
            } else {
              update([{ ...h, id: `inv_${Date.now()}`, createdAt: Date.now() }, ...holdings]);
              toast({ title: "Position added" });
            }
            setDialog(false);
          }}
        />
      )}
    </PageShell>
  );
}

function HoldingDialog({ target, onClose, onSave }: { target: Holding | null; onClose: () => void; onSave: (h: Omit<Holding, "id" | "createdAt">) => void }) {
  const [symbol, setSymbol] = useState(target?.symbol ?? "");
  const [name, setName] = useState(target?.name ?? "");
  const [quantity, setQuantity] = useState(String(target?.quantity ?? ""));
  const [avgCost, setAvgCost] = useState(String(target?.avgCost ?? ""));
  const [status, setStatus] = useState<Status>(target?.status ?? "WATCHING");
  const [thesis, setThesis] = useState(target?.thesis ?? "");
  const [horizon, setHorizon] = useState(target?.horizon ?? "");
  const [invalidation, setInvalidation] = useState(target?.invalidation ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-md">
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-3 py-2">
          <DialogTitle className="text-xs font-medium">{target ? "Edit Position" : "Add Position"}</DialogTitle>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">✕</button>
        </DialogHeader>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-fg-faint">Symbol</Label><Input value={symbol} onChange={e => setSymbol(e.target.value)} placeholder="BTCUSDT" className="mt-0.5 text-xs" /></div>
            <div><Label className="text-[10px] text-fg-faint">Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Bitcoin" className="mt-0.5 text-xs" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-[10px] text-fg-faint">Quantity</Label><Input type="number" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-0.5 text-xs" /></div>
            <div><Label className="text-[10px] text-fg-faint">Avg Cost</Label><Input type="number" value={avgCost} onChange={e => setAvgCost(e.target.value)} className="mt-0.5 text-xs" /></div>
          </div>
          <div>
            <Label className="text-[10px] text-fg-faint">Status</Label>
            <div className="mt-0.5 flex gap-1">
              {(["WATCHING", "HOLDING", "EXITED"] as Status[]).map(s => (
                <button key={s} onClick={() => setStatus(s)} className={cn("flex-1 rounded py-0.5 text-[10px] font-medium", status === s ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg-muted hover:bg-hover")}>{s}</button>
              ))}
            </div>
          </div>
          <div><Label className="text-[10px] text-fg-faint">Thesis</Label><Textarea value={thesis} onChange={e => setThesis(e.target.value)} rows={2} className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Horizon</Label><Input value={horizon} onChange={e => setHorizon(e.target.value)} placeholder="e.g. 2 years" className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Invalidation condition</Label><Input value={invalidation} onChange={e => setInvalidation(e.target.value)} placeholder="e.g. Price drops below $30K" className="mt-0.5 text-xs" /></div>
          <Button size="sm" className="w-full" disabled={!symbol.trim() || !quantity} onClick={() => onSave({ symbol, name, quantity: parseFloat(quantity) || 0, avgCost: parseFloat(avgCost) || 0, status, thesis, horizon, invalidation })}>
            {target ? "Update" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

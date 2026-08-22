"use client";

import { useState, useCallback } from "react";
import { LayoutGrid, Plus, Trash2, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { Input } from "@/components/ui-devspace/input";
import { Label } from "@/components/ui-devspace/label";
import { Textarea } from "@/components/ui-devspace/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui-devspace/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui-devspace/dialog";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-economy-hub";

type Stage = "discovered" | "evaluating" | "validated" | "testing" | "profitable" | "failed" | "rejected";
const STAGES: Stage[] = ["discovered", "evaluating", "validated", "testing", "profitable", "failed", "rejected"];

interface Opportunity {
  id: string; name: string; description: string; score: number;
  stage: Stage; source: "manual" | "agent"; recommendation: string;
  createdAt: number;
}
interface Business {
  id: string; name: string; status: string; budget: number;
  entries: { id: string; type: "REVENUE" | "EXPENSE"; amount: number; category: string; note: string; timestamp: number }[];
  createdAt: number;
}

function loadData(): { opportunities: Opportunity[]; businesses: Business[] } {
  if (typeof window === "undefined") return { opportunities: [], businesses: [] };
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"opportunities":[],"businesses":[]}'); } catch { return { opportunities: [], businesses: [] }; }
}
function saveData(data: { opportunities: Opportunity[]; businesses: Business[] }) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function EconomyHubPage() {
  const [tab, setTab] = useState<"opportunities" | "businesses">("opportunities");
  const [data, setData] = useState(() => loadData());
  const [oppDialog, setOppDialog] = useState(false);
  const [bizDialog, setBizDialog] = useState(false);

  const update = useCallback((next: typeof data) => { setData(next); saveData(next); }, []);

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-accent" />
          <h1 className="text-base font-semibold">Economy Hub</h1>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setTab("opportunities")} className={cn("rounded px-2 py-0.5 text-[11px] font-medium", tab === "opportunities" ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}>Opportunities ({data.opportunities.length})</button>
          <button onClick={() => setTab("businesses")} className={cn("rounded px-2 py-0.5 text-[11px] font-medium", tab === "businesses" ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}>Businesses ({data.businesses.length})</button>
        </div>
      </div>

      {tab === "opportunities" ? (
        <div>
          <div className="mb-2 flex justify-end">
            <Button size="sm" className="h-6 text-[11px]" onClick={() => setOppDialog(true)}><Plus className="mr-1 h-3 w-3" />New Opportunity</Button>
          </div>
          {data.opportunities.length === 0 ? (
            <p className="py-8 text-center text-xs text-fg-faint">No opportunities yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.opportunities.map(opp => (
                <div key={opp.id} className="themed rounded-md border border-line bg-surface p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-fg">{opp.name}</p>
                      <p className="mt-0.5 text-[11px] text-fg-muted">{opp.description}</p>
                      <div className="mt-1 flex items-center gap-2 text-[9px] text-fg-faint">
                        <span>Score: {opp.score}</span>
                        <span>·</span>
                        <span className="capitalize">{opp.source}</span>
                        <span>·</span>
                        <span>{new Date(opp.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Select value={opp.stage} onValueChange={(v) => update({ ...data, opportunities: data.opportunities.map(o => o.id === opp.id ? { ...o, stage: v as Stage } : o) })}>
                        <SelectTrigger className="h-6 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{STAGES.map(s => <SelectItem key={s} value={s} className="text-[11px] capitalize">{s}</SelectItem>)}</SelectContent>
                      </Select>
                      <button onClick={() => update({ ...data, opportunities: data.opportunities.filter(o => o.id !== opp.id) })} className="text-fg-faint hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                  {opp.recommendation && <p className="mt-1.5 text-[10px] text-fg-faint">→ {opp.recommendation}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-2 flex justify-end">
            <Button size="sm" className="h-6 text-[11px]" onClick={() => setBizDialog(true)}><Plus className="mr-1 h-3 w-3" />New Business</Button>
          </div>
          {data.businesses.length === 0 ? (
            <p className="py-8 text-center text-xs text-fg-faint">No businesses yet.</p>
          ) : (
            <div className="space-y-2">
              {data.businesses.map(biz => {
                const revenue = biz.entries.filter(e => e.type === "REVENUE").reduce((s, e) => s + e.amount, 0);
                const expenses = biz.entries.filter(e => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
                const profit = revenue - expenses;
                return (
                  <div key={biz.id} className="themed rounded-md border border-line bg-surface p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-fg">{biz.name}</p>
                      <button onClick={() => update({ ...data, businesses: data.businesses.filter(b => b.id !== biz.id) })} className="text-fg-faint hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <div className="mt-2 flex gap-3 text-[11px]">
                      <span className="flex items-center gap-1 text-green-500"><TrendingUp className="h-2.5 w-2.5" />${revenue.toFixed(0)}</span>
                      <span className="flex items-center gap-1 text-red-500"><TrendingDown className="h-2.5 w-2.5" />${expenses.toFixed(0)}</span>
                      <span className="flex items-center gap-1 text-fg-muted"><DollarSign className="h-2.5 w-2.5" />${profit.toFixed(0)}</span>
                    </div>
                    <div className="mt-2 flex gap-1">
                      <Button size="sm" variant="outline" className="h-5 text-[9px]" onClick={() => {
                        const amt = parseFloat(prompt("Revenue amount:") || "0");
                        if (amt > 0) update({ ...data, businesses: data.businesses.map(b => b.id === biz.id ? { ...b, entries: [...b.entries, { id: `e${Date.now()}`, type: "REVENUE", amount: amt, category: "general", note: "", timestamp: Date.now() }] } : b) });
                      }}>+ Revenue</Button>
                      <Button size="sm" variant="outline" className="h-5 text-[9px]" onClick={() => {
                        const amt = parseFloat(prompt("Expense amount:") || "0");
                        if (amt > 0) update({ ...data, businesses: data.businesses.map(b => b.id === biz.id ? { ...b, entries: [...b.entries, { id: `e${Date.now()}`, type: "EXPENSE", amount: amt, category: "general", note: "", timestamp: Date.now() }] } : b) });
                      }}>+ Expense</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {oppDialog && (
        <OpportunityDialog onClose={() => setOppDialog(false)} onCreate={(opp) => {
          update({ ...data, opportunities: [{ ...opp, id: `opp_${Date.now()}`, source: "manual", createdAt: Date.now() }, ...data.opportunities] });
          setOppDialog(false); toast({ title: "Opportunity created" });
        }} />
      )}
      {bizDialog && (
        <BusinessDialog onClose={() => setBizDialog(false)} onCreate={(biz) => {
          update({ ...data, businesses: [{ ...biz, id: `biz_${Date.now()}`, entries: [], createdAt: Date.now() }, ...data.businesses] });
          setBizDialog(false); toast({ title: "Business created" });
        }} />
      )}
    </PageShell>
  );
}

function OpportunityDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (o: Omit<Opportunity, "id" | "source" | "createdAt">) => void }) {
  const [name, setName] = useState(""); const [desc, setDesc] = useState("");
  const [score, setScore] = useState("50"); const [rec, setRec] = useState("");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-3 py-2">
          <DialogTitle className="text-xs font-medium">New Opportunity</DialogTitle>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">✕</button>
        </DialogHeader>
        <div className="space-y-2 p-3">
          <div><Label className="text-[10px] text-fg-faint">Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Description</Label><Textarea value={desc} onChange={e => setDesc(e.target.value)} className="mt-0.5 text-xs" rows={2} /></div>
          <div><Label className="text-[10px] text-fg-faint">Score (0-100)</Label><Input type="number" value={score} onChange={e => setScore(e.target.value)} className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Recommendation</Label><Input value={rec} onChange={e => setRec(e.target.value)} className="mt-0.5 text-xs" /></div>
          <Button size="sm" className="w-full" disabled={!name.trim()} onClick={() => onCreate({ name, description: desc, score: parseInt(score) || 0, stage: "discovered", recommendation: rec })}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BusinessDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (b: Omit<Business, "id" | "entries" | "createdAt">) => void }) {
  const [name, setName] = useState(""); const [status, setStatus] = useState("active"); const [budget, setBudget] = useState("0");
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader className="flex-row items-center justify-between border-b border-line-muted px-3 py-2">
          <DialogTitle className="text-xs font-medium">New Business</DialogTitle>
          <button onClick={onClose} className="text-fg-muted hover:text-fg">✕</button>
        </DialogHeader>
        <div className="space-y-2 p-3">
          <div><Label className="text-[10px] text-fg-faint">Name</Label><Input value={name} onChange={e => setName(e.target.value)} className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Status</Label><Input value={status} onChange={e => setStatus(e.target.value)} className="mt-0.5 text-xs" /></div>
          <div><Label className="text-[10px] text-fg-faint">Budget (USD)</Label><Input type="number" value={budget} onChange={e => setBudget(e.target.value)} className="mt-0.5 text-xs" /></div>
          <Button size="sm" className="w-full" disabled={!name.trim()} onClick={() => onCreate({ name, status, budget: parseFloat(budget) || 0 })}>Create</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

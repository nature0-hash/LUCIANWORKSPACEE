"use client";

import { useState } from "react";
import { LayoutDashboard, CandlestickChart, Settings, Vault } from "lucide-react";
import { MarketTerminal } from "@/components/markets/market-terminal";
import { VaultDashboard } from "@/components/vault/vault-dashboard";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { cn } from "@/lib/utils";

type View = "vault" | "markets" | "settings";

const NAV: { id: View; label: string; icon: typeof Vault }[] = [
  { id: "vault", label: "Vault", icon: Vault },
  { id: "markets", label: "Markets", icon: CandlestickChart },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function Home() {
  const [view, setView] = useState<View>("markets");
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="themed flex h-screen w-full overflow-hidden bg-canvas text-fg">
      {/* Left rail */}
      <nav
        aria-label="Workspace navigation"
        className="flex h-full w-16 shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3"
      >
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg">
          <LayoutDashboard className="h-4 w-4" />
        </div>
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => {
                if (item.id === "settings") {
                  setSettingsOpen(true);
                } else {
                  setView(item.id);
                }
              }}
              title={item.label}
              className={cn(
                "focus-ring themed flex h-10 w-10 items-center justify-center rounded-md border border-transparent text-fg-muted transition-colors hover:bg-hover hover:text-fg",
                active && "border-line bg-active-bg text-accent",
              )}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </nav>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-hidden">
        {view === "vault" && (
          <div className="h-full">
            <VaultDashboard />
          </div>
        )}
        {view === "markets" && (
          <div className="h-full">
            <MarketTerminal />
          </div>
        )}
      </main>

      {/* Settings modal (overlay) */}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

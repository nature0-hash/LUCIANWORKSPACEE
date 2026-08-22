"use client";

import { useEffect } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {
  BarChart3,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  History,
  CalendarDays,
  CircleUser,
} from "lucide-react";
import { useMarketsStore } from "@/store/markets";
import { AccountBar } from "./account-bar";
import { InstrumentList } from "./instrument-list";
import { ChartPanel } from "./chart-panel";
import { TradingPanel } from "./trading-panel";
import { IntelligencePanel } from "./intelligence-panel";
import { cn } from "@/lib/utils";

export function MarketTerminal() {
  const initialize = useMarketsStore((s) => s.initialize);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);

  useEffect(() => {
    initialize();
    refreshAccount();
  }, [initialize, refreshAccount]);

  return (
    <div className="themed flex h-full bg-canvas text-fg">
      {/* Far-left vertical tool rail (~48px) */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-line-muted bg-surface py-2">
        <RailIcon icon={CircleUser} label="Profile" />
        <div className="my-1 h-px w-6 bg-line-muted" />
        <RailIcon icon={BarChart3} label="Instruments" active />
        <RailIcon icon={ArrowDownToLine} label="Deposit" />
        <RailIcon icon={ArrowUpFromLine} label="Withdraw" />
        <RailIcon icon={ArrowLeftRight} label="Transfer" />
        <RailIcon icon={History} label="History" />
        <RailIcon icon={CalendarDays} label="Calendar" />
        <div className="mt-auto">
          {/* Bottom icons */}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top account bar */}
        <AccountBar />

        {/* Resizable 3-pane layout */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Left: Instrument list */}
            <Panel defaultSize={20} minSize={14} maxSize={28}>
              <InstrumentList />
            </Panel>
            <PanelResizeHandle className="w-px bg-line hover:bg-accent/30 transition-colors" />

            {/* Center: Chart + bottom trading panel */}
            <Panel defaultSize={52} minSize={28}>
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ChartPanel />
                </div>
                <TradingPanel />
              </div>
            </Panel>
            <PanelResizeHandle className="w-px bg-line hover:bg-accent/30 transition-colors" />

            {/* Right: Intelligence panel */}
            <Panel defaultSize={24} minSize={16}>
              <IntelligencePanel />
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}

function RailIcon({
  icon: Icon,
  label,
  active = false,
}: {
  icon: typeof BarChart3;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      title={label}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-fg-faint hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

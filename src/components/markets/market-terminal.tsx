"use client";

import { useEffect } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useMarketsStore } from "@/store/markets";
import { AccountBar } from "./account-bar";
import { InstrumentList } from "./instrument-list";
import { ChartPanel } from "./chart-panel";
import { TradingPanel } from "./trading-panel";
import { IntelligencePanel } from "./intelligence-panel";

export function MarketTerminal() {
  const initialize = useMarketsStore((s) => s.initialize);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);

  useEffect(() => {
    initialize();
    refreshAccount();
  }, [initialize, refreshAccount]);

  return (
    <div className="themed flex h-full flex-col bg-canvas text-fg">
      {/* Account bar (top) */}
      <AccountBar />

      {/* Main 3-pane layout */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          {/* Left: Instrument list */}
          <Panel defaultSize={18} minSize={12} maxSize={28}>
            <InstrumentList />
          </Panel>
          <PanelResizeHandle className="w-1 bg-line hover:bg-accent/30 transition-colors" />

          {/* Center: Chart */}
          <Panel defaultSize={55} minSize={30}>
            <div className="flex h-full flex-col">
              <div className="min-h-0 flex-1 overflow-hidden">
                <ChartPanel />
              </div>
              {/* Bottom: Trading panel */}
              <TradingPanel />
            </div>
          </Panel>
          <PanelResizeHandle className="w-1 bg-line hover:bg-accent/30 transition-colors" />

          {/* Right: Intelligence panel */}
          <Panel defaultSize={27} minSize={18}>
            <IntelligencePanel />
          </Panel>
        </PanelGroup>
      </div>
    </div>
  );
}

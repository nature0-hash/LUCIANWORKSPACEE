"use client";

import { useEffect } from "react";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { useMarketsStore } from "@/store/markets";
import { AccountBar } from "./account-bar";
import { InstrumentList } from "./instrument-list";
import { ChartPanel } from "./chart-panel";
import { TradingPanel } from "./trading-panel";
import { ToolRail } from "./tool-rail";

export function MarketTerminal() {
  const initialize = useMarketsStore((s) => s.initialize);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);

  useEffect(() => {
    initialize();
    refreshAccount();
  }, [initialize, refreshAccount]);

  return (
    <div className="flex h-full bg-[#13161c] text-white">
      {/* Far-left vertical tool rail (48px fixed) */}
      <ToolRail />

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top account bar */}
        <AccountBar />

        {/* 2-pane resizable layout (instruments + chart/trading) */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <PanelGroup direction="horizontal">
            {/* Instruments panel */}
            <Panel defaultSize={20} minSize={14} maxSize={28}>
              <InstrumentList />
            </Panel>
            <PanelResizeHandle className="w-px bg-[#2d333b] hover:bg-[#3b82f6] transition-colors" />

            {/* Center: chart + bottom trading panel */}
            <Panel defaultSize={80} minSize={40}>
              <div className="flex h-full flex-col">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <ChartPanel />
                </div>
                <TradingPanel />
              </div>
            </Panel>
          </PanelGroup>
        </div>
      </div>
    </div>
  );
}

"use client";

/* LUCIAN Markets — central trading workspace.
 *
 * Recreates the red-boxed trading workspace from the reference
 * screenshot. Layout (top to bottom):
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ TOP CHART TOOLBAR                                        │
 *   │ EURUSD  -0.03%  ★  ⓘ ⓘ  M1  [New order]  ⊕        ⚙    │
 *   ├─┬────────────────────────────────────────────────────────┤
 *   │D│  [SELL] [− 0.01 +] [BUY]                               │
 *   │R│  O 1.16795 H 1.16806 L 1.16795 C 1.16803 −0.00008      │
 *   │A│                                                        │
 *   │W│             CANDLESTICK CHART                          │
 *   │I│             (lightweight-charts)                       │
 *   │N│                                                        │
 *   │G│                                                        │
 *   ├─┴────────────────────────────────────────────────────────┤
 *   │ Market 0  Pending 0  Closed       Floating profit $0  Close │
 *   └──────────────────────────────────────────────────────────┘
 *
 * Behavior rules:
 *  - Visual structure only — no fake trading logic, no fake account activity
 *  - Real candlestick chart from lightweight-charts (deterministic demo data
 *    since the project's Binance provider isn't wired in this layout)
 *  - Timeframe selector cycles M1/M5/M15/M30/H1/H4/D1/W
 *  - Drawing toolbar icons are visual only for this stage
 *  - Bottom strip tabs are visual only for this stage
 */

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type IPriceLine,
} from "lightweight-charts";
import {
  Star,
  Bell,
  Info,
  Clock,
  Settings,
  Crosshair,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Save,
  FolderOpen,
  HelpCircle,
  Check,
  X,
  LayoutGrid,
  Columns2,
  Rows2,
  Columns3,
  Grid2x2,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMarketsStore } from "@/store/markets";
import { getInstrumentBySymbol } from "@/lib/markets/catalog";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

/* Chart layout modes — controls how many chart panes are visible
   and how they are arranged. */
type ChartLayout =
  | "single"
  | "double-columns"
  | "double-rows"
  | "triple"
  | "quadruple";

/* Layout option metadata — drives both the popup UI and the grid
   container arrangement. */
const LAYOUT_OPTIONS: {
  id: ChartLayout;
  label: string;
  icon: typeof LayoutGrid;
  /* CSS grid template — columns × rows */
  cols: number;
  rows: number;
  /* Optional col-span overrides for cells (1-indexed) used to build
     asymmetric layouts like "triple" (1 big + 2 small). */
  spans?: { col: number; row: number }[];
}[] = [
  { id: "single", label: "Single", icon: Square, cols: 1, rows: 1 },
  {
    id: "double-columns",
    label: "Double in columns",
    icon: Columns2,
    cols: 2,
    rows: 1,
  },
  {
    id: "double-rows",
    label: "Double in rows",
    icon: Rows2,
    cols: 1,
    rows: 2,
  },
  { id: "triple", label: "Triple", icon: Columns3, cols: 2, rows: 2, spans: [{ col: 1, row: 2 }] },
  { id: "quadruple", label: "Quadruple", icon: Grid2x2, cols: 2, rows: 2 },
];

/* Number of chart panes each layout renders. */
const PANE_COUNT: Record<ChartLayout, number> = {
  single: 1,
  "double-columns": 2,
  "double-rows": 2,
  triple: 3,
  quadruple: 4,
};

/* Reference colors — match the screenshot palette. */
const C_BG = "#131722"; // chart background
const C_PANEL = "#1e222d"; // toolbar / drawing rail / bottom strip
const C_BORDER = "#2a2e39";
const C_GRID = "#1e222d";
const C_TEXT = "#d1d4dc";
const C_TEXT_MUTED = "#787b86";
const C_UP = "#089981"; // bullish green
const C_DOWN = "#f23645"; // bearish red
const C_BLUE = "#2962ff"; // action blue

/* ------------------------------------------------------------------ */
/* Chart settings state + persistence                                  */
/* ------------------------------------------------------------------ */

const CHART_SETTINGS_KEY = "lucian-markets-chart-settings";

interface ChartSettings {
  showBid: boolean;
  showAsk: boolean;
  showMarketOrders: boolean;
  showPendingOrders: boolean;
}

const DEFAULT_SETTINGS: ChartSettings = {
  showBid: true,
  showAsk: true,
  showMarketOrders: true,
  showPendingOrders: true,
};

/** Hook: load + persist chart view settings (4 toggles) in localStorage. */
function useChartSettings() {
  const [settings, setSettings] = useState<ChartSettings>(DEFAULT_SETTINGS);

  // Load on mount (client-only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CHART_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ChartSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const update = useCallback((patch: Partial<ChartSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(CHART_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  return { settings, update };
}

/* ------------------------------------------------------------------ */
/* Save / Load full chart config                                       */
/* ------------------------------------------------------------------ */

const CHART_CONFIG_KEY = "lucian-markets-chart-config";

interface SavedChartConfig {
  symbol: string;
  timeframe: Timeframe;
  showBid: boolean;
  showAsk: boolean;
  showMarketOrders: boolean;
  showPendingOrders: boolean;
  savedAt: number;
}

function saveChartConfig(config: SavedChartConfig): boolean {
  try {
    localStorage.setItem(CHART_CONFIG_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

function loadChartConfig(): SavedChartConfig | null {
  try {
    const raw = localStorage.getItem(CHART_CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedChartConfig;
  } catch {
    return null;
  }
}

export function ChartWorkspace({
  pendingOrderPriceOverride,
}: {
  pendingOrderPriceOverride?: number | null;
}) {
  const [timeframe, setTimeframe] = useState<Timeframe>("M1");
  const [selectedTool, setSelectedTool] = useState<string>("rect");
  const { settings, update } = useChartSettings();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [bottomExpanded, setBottomExpanded] = useState(false);
  const [internalPendingPrice, setInternalPendingPrice] = useState<number | null>(null);
  // Chart layout — controls how many chart panes are visible.
  const [chartLayout, setChartLayout] = useState<ChartLayout>("single");
  const [layoutPopupOpen, setLayoutPopupOpen] = useState(false);
  // The pending-order chart line takes its price from EITHER the lifted
  // override (from OrderDetails panel) OR the bottom panel's pending tab,
  // whichever was last set. The override takes priority when defined.
  const pendingOrderPrice =
    pendingOrderPriceOverride !== undefined
      ? pendingOrderPriceOverride
      : internalPendingPrice;

  // ── Selected instrument comes from the shared markets store ──
  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const onToggleInstruments = useMarketsStore((s) => s.onToggleInstruments ?? (() => {}));
  const instrument = useMemo(
    () => (selectedSymbol ? getInstrumentBySymbol(selectedSymbol) : null),
    [selectedSymbol],
  );

  // Use the catalog's bid/ask/changePct for the selected instrument.
  // Falls back to EURUSD defaults when no selection yet.
  const fallback = getInstrumentBySymbol("EURUSD");
  const inst = instrument ?? fallback;
  const SELL_PRICE = inst?.bid ?? 1.16744;
  const BUY_PRICE = inst?.ask ?? 1.16796;
  const CHANGE_PCT = inst?.changePct ?? 0;
  const SYMBOL = inst?.symbol ?? "EURUSD";

  const handleSave = useCallback(() => {
    const ok = saveChartConfig({
      symbol: SYMBOL,
      timeframe,
      showBid: settings.showBid,
      showAsk: settings.showAsk,
      showMarketOrders: settings.showMarketOrders,
      showPendingOrders: settings.showPendingOrders,
      savedAt: Date.now(),
    });
    setSaveMessage(ok ? "Chart saved" : "Save failed");
    setTimeout(() => setSaveMessage(null), 1800);
  }, [timeframe, settings, SYMBOL]);

  const handleLoad = useCallback(() => {
    const cfg = loadChartConfig();
    if (!cfg) {
      setSaveMessage("No saved chart found");
      setTimeout(() => setSaveMessage(null), 1800);
      return;
    }
    setTimeframe(cfg.timeframe);
    update({
      showBid: cfg.showBid,
      showAsk: cfg.showAsk,
      showMarketOrders: cfg.showMarketOrders,
      showPendingOrders: cfg.showPendingOrders,
    });
    setSaveMessage("Chart loaded");
    setTimeout(() => setSaveMessage(null), 1800);
  }, [update]);

  return (
    <div className="themed flex h-full min-w-0 flex-1 flex-col bg-canvas">
      {/* ── Top chart toolbar ── */}
      <ChartToolbar
        symbol={SYMBOL}
        changePct={CHANGE_PCT}
        timeframe={timeframe}
        onTimeframe={setTimeframe}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        onToggleInstruments={onToggleInstruments}
        onNewOrder={() => useMarketsStore.getState().setLeftPanelMode("order")}
        layoutPopupOpen={layoutPopupOpen}
        onToggleLayoutPopup={() => setLayoutPopupOpen((v) => !v)}
        chartLayout={chartLayout}
        onSelectLayout={(l) => {
          setChartLayout(l);
          setLayoutPopupOpen(false);
        }}
      />

      {/* ── Body: drawing rail + chart panes + overlays ── */}
      <div className="relative flex min-h-0 flex-1">
        <DrawingRail selected={selectedTool} onSelect={setSelectedTool} />

        {/* Chart container fills the rest */}
        <div className="relative min-w-0 flex-1 bg-[#131722]">
          {/* Multi-pane chart layout — driven by chartLayout state */}
          <ChartPaneGrid
            layout={chartLayout}
            timeframe={timeframe}
            symbol={SYMBOL}
            settings={settings}
            bidPrice={SELL_PRICE}
            askPrice={BUY_PRICE}
            pendingOrderPrice={pendingOrderPrice}
          />

          {/* Quick Sell/Buy block — upper-left overlay (only on Single) */}
          {chartLayout === "single" && (
            <QuickTrade sellPrice={SELL_PRICE} buyPrice={BUY_PRICE} />
          )}

          {/* Chart settings popover — anchored top-right */}
          {settingsOpen && (
            <ChartSettingsPopover
              settings={settings}
              onToggle={(key) =>
                update({ [key]: !settings[key] } as Partial<ChartSettings>)
              }
              onSave={handleSave}
              onLoad={handleLoad}
              onClose={() => setSettingsOpen(false)}
              message={saveMessage}
            />
          )}

          {/* Layout setup popup — anchored top-right, below the toolbar */}
          {layoutPopupOpen && (
            <LayoutSetupPopover
              currentLayout={chartLayout}
              onSelect={(l) => {
                setChartLayout(l);
                setLayoutPopupOpen(false);
              }}
              onClose={() => setLayoutPopupOpen(false)}
            />
          )}
        </div>
      </div>

      {/* ── Bottom trading strip + optional expanded panel ── */}
      <BottomPanel
        expanded={bottomExpanded}
        onToggleExpand={() => setBottomExpanded((v) => !v)}
        onPendingPriceChange={setInternalPendingPrice}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top chart toolbar                                                   */
/* ------------------------------------------------------------------ */

function ChartToolbar({
  symbol,
  changePct,
  timeframe,
  onTimeframe,
  settingsOpen,
  onToggleSettings,
  onToggleInstruments,
  onNewOrder,
  layoutPopupOpen,
  onToggleLayoutPopup,
  chartLayout,
  onSelectLayout,
}: {
  symbol: string;
  changePct: number | null;
  timeframe: Timeframe;
  onTimeframe: (t: Timeframe) => void;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onToggleInstruments: () => void;
  onNewOrder: () => void;
  layoutPopupOpen: boolean;
  onToggleLayoutPopup: () => void;
  chartLayout: ChartLayout;
  onSelectLayout: (l: ChartLayout) => void;
}) {
  const [fav, setFav] = useState(false);
  const chgColor = (changePct ?? 0) < 0 ? C_DOWN : C_UP;
  const chgSign = (changePct ?? 0) >= 0 ? "+" : "";
  const chgText =
    changePct === null
      ? "0.00%"
      : `${chgSign}${changePct.toFixed(2)}%`;

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-2 border-b px-3 themed"
      style={{
        background: C_PANEL,
        borderColor: C_BORDER,
      }}
    >
      {/* Instrument symbol — clicking toggles the Instruments panel */}
      <button
        type="button"
        onClick={onToggleInstruments}
        title="Toggle instruments panel"
        className="rounded px-1 py-0.5 text-[13px] font-bold text-white transition-colors hover:bg-[#2a2e39]"
      >
        {symbol}
      </button>

      {/* Percentage badge */}
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
        style={{ background: chgColor }}
      >
        {chgText}
      </span>

      {/* Favorite star */}
      <button
        type="button"
        title="Add to favorites"
        onClick={() => setFav((v) => !v)}
        className="flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-[#2a2e39]"
      >
        <Star
          className="h-3.5 w-3.5"
          style={{
            color: fav ? "#d4a72c" : C_TEXT_MUTED,
            fill: fav ? "#d4a72c" : "transparent",
          }}
        />
      </button>

      {/* Toolbar info icons — match screenshot arrangement */}
      <ToolbarBtn icon={Bell} title="Alerts" />
      <ToolbarBtn icon={Info} title="Details" />
      <ToolbarBtn icon={Clock} title="History" />

      <Separator />

      {/* Timeframe selector */}
      <div className="flex items-center gap-0.5 rounded p-0.5" style={{ background: "#2a2e39" }}>
        {TIMEFRAMES.slice(0, 5).map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => onTimeframe(tf)}
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              timeframe === tf
                ? "bg-[#363a45] text-white"
                : "text-[#787b86] hover:text-white",
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      <Separator />

      {/* Layout setup button — opens the chart-layout popup */}
      <button
        type="button"
        title="Layout setup"
        aria-label="Layout setup"
        aria-expanded={layoutPopupOpen}
        onClick={onToggleLayoutPopup}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded transition-colors",
          layoutPopupOpen
            ? "bg-[#2a2e39] text-white"
            : "text-[#787b86] hover:bg-[#2a2e39] hover:text-white",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>

      <Separator />

      {/* New order button — opens Order Details in the left contextual panel */}
      <button
        type="button"
        onClick={onNewOrder}
        className="flex items-center gap-1.5 rounded px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:opacity-90"
        style={{ background: C_BLUE }}
      >
        <Plus className="h-3 w-3" />
        New order
      </button>

      {/* Round target button beside New order */}
      <button
        type="button"
        title="Trade options"
        className="flex h-6 w-6 items-center justify-center rounded text-white transition-colors hover:bg-[#2a2e39]"
        style={{ background: "#363a45" }}
      >
        <Crosshair className="h-3 w-3" />
      </button>

      {/* Spacer pushes the gear to the far right */}
      <div className="flex-1" />

      {/* Settings gear (far right) — toggles the Chart Settings popover */}
      <button
        type="button"
        title="Chart settings"
        aria-label="Chart settings"
        aria-expanded={settingsOpen}
        onClick={onToggleSettings}
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded transition-colors",
          settingsOpen
            ? "bg-[#2a2e39] text-white"
            : "text-[#787b86] hover:bg-[#2a2e39] hover:text-white",
        )}
      >
        <Settings className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ToolbarBtn({
  icon: Icon,
  title,
}: {
  icon: typeof Star;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] transition-colors hover:bg-[#2a2e39] hover:text-white"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function Separator() {
  return <div className="h-4 w-px" style={{ background: C_BORDER }} />;
}

/* ------------------------------------------------------------------ */
/* Chart Settings popover                                              */
/* ------------------------------------------------------------------ */

function ChartSettingsPopover({
  settings,
  onToggle,
  onSave,
  onLoad,
  onClose,
  message,
}: {
  settings: ChartSettings;
  onToggle: (key: keyof ChartSettings) => void;
  onSave: () => void;
  onLoad: () => void;
  onClose: () => void;
  message: string | null;
}) {
  // Close on outside click + Escape key.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (!rootRef.current) return;
      // Use composedPath so clicks inside shadow DOM or chart canvas
      // are correctly detected as "outside" the popover.
      if (!e.composedPath().includes(rootRef.current)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Defer attaching by one tick so the click that opened the popover
    // doesn't immediately close it.
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointer);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="absolute right-3 top-3 z-30 w-[230px] overflow-hidden rounded-md shadow-xl themed"
      style={{
        background: "#1e1e2d",
        border: "1px solid #2a2a3c",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Header */}
      <div className="px-4 pb-2 pt-3">
        <span className="text-[13px] font-semibold text-white">Chart settings</span>
      </div>

      {/* Save / Load rows */}
      <div className="pb-1">
        <SettingsRow icon={Save} label="Save current chart" onClick={onSave} />
        <SettingsRow icon={FolderOpen} label="Load saved chart" onClick={onLoad} />
      </div>

      {/* Divider */}
      <div className="mx-4 my-1 h-px" style={{ background: "#2e2e3e" }} />

      {/* Subheading */}
      <div className="px-4 pb-1 pt-1">
        <span className="text-[11px] text-[#8a8a9a]">
          Select the trading tools you want to view.
        </span>
      </div>

      {/* Checkbox rows */}
      <div className="pb-2">
        <CheckRow
          label="Show Bid price"
          checked={settings.showBid}
          onChange={() => onToggle("showBid")}
        />
        <CheckRow
          label="Show Ask price"
          checked={settings.showAsk}
          onChange={() => onToggle("showAsk")}
        />
        <CheckRow
          label="Show Market orders"
          checked={settings.showMarketOrders}
          onChange={() => onToggle("showMarketOrders")}
        />
        <CheckRow
          label="Show Pending orders"
          checked={settings.showPendingOrders}
          onChange={() => onToggle("showPendingOrders")}
        />
      </div>

      {/* Optional transient message (Save/Load feedback) */}
      {message && (
        <div className="border-t px-4 py-1.5 text-[10px] text-[#8a8a9a]" style={{ borderColor: "#2e2e3e" }}>
          {message}
        </div>
      )}
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Save;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2 text-left text-[12px] text-[#e0e0e0] transition-colors hover:bg-[#2a2a3c]"
    >
      <Icon className="h-3.5 w-3.5 text-[#8a8a9a]" />
      <span>{label}</span>
    </button>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between px-4 py-2 transition-colors hover:bg-[#252535]"
    >
      <span className="flex items-center gap-1.5 text-[12px] text-[#e0e0e0]">
        {label}
        <HelpCircle className="h-3 w-3 text-[#6a6a7a]" />
      </span>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onChange}
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded transition-colors",
          checked
            ? "border-0 bg-[#4b9eff] text-white"
            : "border border-[#3a3a4c] bg-[#2a2a3c] text-transparent",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Quick Sell/Buy block (upper-left chart overlay)                    */
/* ------------------------------------------------------------------ */

function QuickTrade({
  sellPrice,
  buyPrice,
}: {
  sellPrice: number;
  buyPrice: number;
}) {
  const [size, setSize] = useState(0.01);

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col gap-1">
      {/* Sell / Size / Buy row */}
      <div
        className="pointer-events-auto flex overflow-hidden rounded text-[10px] font-bold text-white shadow-md"
        style={{ background: C_PANEL, border: `1px solid ${C_BORDER}` }}
      >
        {/* Sell */}
        <button
          type="button"
          className="flex w-[72px] flex-col items-center justify-center px-2 py-1.5 transition-opacity hover:opacity-90"
          style={{ background: C_DOWN }}
        >
          <span className="text-[9px] uppercase tracking-wide opacity-90">Sell</span>
          <span className="font-mono text-[12px] tabular-nums">{sellPrice.toFixed(5)}</span>
        </button>

        {/* Size controls */}
        <div className="flex w-[88px] flex-col items-center justify-center px-1 py-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSize((s) => Math.max(0.01, +(s - 0.01).toFixed(2)))}
              className="flex h-5 w-5 items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-white"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-10 text-center font-mono text-[12px] tabular-nums text-white">
              {size.toFixed(2)}
            </span>
            <button
              type="button"
              onClick={() => setSize((s) => +(s + 0.01).toFixed(2))}
              className="flex h-5 w-5 items-center justify-center rounded text-[#787b86] hover:bg-[#2a2e39] hover:text-white"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Buy */}
        <button
          type="button"
          className="flex w-[72px] flex-col items-center justify-center px-2 py-1.5 transition-opacity hover:opacity-90"
          style={{ background: C_UP }}
        >
          <span className="text-[9px] uppercase tracking-wide opacity-90">Buy</span>
          <span className="font-mono text-[12px] tabular-nums">{buyPrice.toFixed(5)}</span>
        </button>
      </div>

      {/* OHLC / movement line — below the block */}
      <div className="pointer-events-none px-1 font-mono text-[9px] tabular-nums" style={{ color: C_TEXT_MUTED }}>
        O 1.16795 H 1.16806 L 1.16795 C 1.16803{" "}
        <span style={{ color: C_DOWN }}>−0.00008 (−0.01%)</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chart layout popover + multi-pane grid                              */
/* ------------------------------------------------------------------ */

function LayoutSetupPopover({
  currentLayout,
  onSelect,
  onClose,
}: {
  currentLayout: ChartLayout;
  onSelect: (l: ChartLayout) => void;
  onClose: () => void;
}) {
  // Close on outside click + Escape key.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handlePointer = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!e.composedPath().includes(rootRef.current)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointer);
      document.addEventListener("keydown", handleKey);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      className="absolute right-3 top-3 z-30 w-[220px] overflow-hidden rounded-md shadow-xl themed"
      style={{
        background: "#1e1e2d",
        border: "1px solid #2a2a3c",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-3">
        <span className="text-[13px] font-semibold text-white">Layout setup</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close layout popup"
          title="Close"
          className="text-fg-faint transition-colors hover:text-fg"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Layout option rows */}
      <div className="pb-2">
        {LAYOUT_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = currentLayout === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2 text-left text-[12px] transition-colors themed",
                active
                  ? "text-[var(--accent)]"
                  : "text-[#c4cbde] hover:bg-[#2a2a3c] hover:text-white",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  active ? "text-[var(--accent)]" : "text-[#787b86]",
                )}
              />
              <span className="font-medium">{opt.label}</span>
              {active && (
                <Check
                  className="ml-auto h-3 w-3 text-[var(--accent)]"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Renders N chart panes arranged according to the selected layout.
    Each pane is a CandleChart instance reusing the existing chart
    component. The QuickTrade overlay + pending-order price line are
    only rendered on the first pane to avoid visual clutter. */
function ChartPaneGrid({
  layout,
  timeframe,
  symbol,
  settings,
  bidPrice,
  askPrice,
  pendingOrderPrice,
}: {
  layout: ChartLayout;
  timeframe: Timeframe;
  symbol: string;
  settings: ChartSettings;
  bidPrice: number;
  askPrice: number;
  pendingOrderPrice: number | null;
}) {
  const meta = LAYOUT_OPTIONS.find((o) => o.id === layout)!;
  const paneCount = PANE_COUNT[layout];

  // Build the grid template. For "triple" we use a 2×2 grid where the
  // first cell spans 2 rows (1 big left + 2 small right).
  const gridStyle: React.CSSProperties =
    layout === "triple"
      ? {
          gridTemplateColumns: "1.4fr 1fr",
          gridTemplateRows: "1fr 1fr",
        }
      : {
          gridTemplateColumns: `repeat(${meta.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${meta.rows}, minmax(0, 1fr))`,
        };

  return (
    <div
      className="grid h-full w-full"
      style={{
        ...gridStyle,
        background: "#131722",
        gap: "1px",
      }}
    >
      {Array.from({ length: paneCount }).map((_, i) => {
        const isPrimary = i === 0;
        // For "triple", pane 0 spans both rows (the big left chart).
        const cellStyle: React.CSSProperties =
          layout === "triple" && i === 0
            ? { gridColumn: "1", gridRow: "1 / span 2" }
            : {};
        return (
          <div
            key={i}
            className="relative min-w-0 overflow-hidden bg-[#131722]"
            style={cellStyle}
          >
            <CandleChart
              timeframe={timeframe}
              symbol={symbol}
              settings={isPrimary ? settings : { ...settings, showBid: false, showAsk: false }}
              bidPrice={bidPrice}
              askPrice={askPrice}
              pendingOrderPrice={isPrimary ? pendingOrderPrice : null}
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Drawing rail (left vertical chart toolbar)                          */
/* ------------------------------------------------------------------ */
/* The drawing toolbar's icons have been intentionally removed for this
   step. The container (width + border + background) is kept so the
   overall Markets layout structure remains stable. Tools will be
   re-added one by one in future updates. */

function DrawingRail({
  selected: _selected,
  onSelect: _onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex w-8 shrink-0 flex-col items-center border-r themed"
      style={{
        background: C_PANEL,
        borderColor: C_BORDER,
      }}
      aria-hidden
    />
  );
}

/* ------------------------------------------------------------------ */
/* Candlestick chart (lightweight-charts)                              */
/* ------------------------------------------------------------------ */

function CandleChart({
  timeframe,
  symbol,
  settings,
  bidPrice,
  askPrice,
  pendingOrderPrice,
}: {
  timeframe: Timeframe;
  symbol: string;
  settings: ChartSettings;
  bidPrice: number;
  askPrice: number;
  pendingOrderPrice: number | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const bidLineRef = useRef<IPriceLine | null>(null);
  const askLineRef = useRef<IPriceLine | null>(null);
  const pendingLineRef = useRef<IPriceLine | null>(null);

  // Deterministic demo candles around the selected instrument's mid-price.
  // Re-keyed on symbol AND timeframe so the chart visibly responds to both.
  const midPrice = useMemo(() => (bidPrice + askPrice) / 2, [bidPrice, askPrice]);
  const candles = useMemo<CandlestickData<UTCTimestamp>[]>(
    () => generateDemoCandles(timeframe, 120, midPrice, symbol),
    [timeframe, midPrice, symbol],
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: C_BG },
        textColor: C_TEXT,
        fontSize: 10,
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      },
      grid: {
        vertLines: { color: C_GRID },
        horzLines: { color: C_GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#363a45", width: 1, style: 2, labelBackgroundColor: "#363a45" },
        horzLine: { color: "#363a45", width: 1, style: 2, labelBackgroundColor: "#363a45" },
      },
      rightPriceScale: {
        borderColor: C_BORDER,
      },
      timeScale: {
        borderColor: C_BORDER,
        timeVisible: true,
        secondsVisible: false,
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: C_UP,
      downColor: C_DOWN,
      borderUpColor: C_UP,
      borderDownColor: C_DOWN,
      wickUpColor: C_UP,
      wickDownColor: C_DOWN,
    });
    seriesRef.current = series;
    series.setData(candles);

    // Resize observer keeps the chart filling its container
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      chart.resize(e.contentRect.width, e.contentRect.height);
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      bidLineRef.current = null;
      askLineRef.current = null;
      pendingLineRef.current = null;
    };
  }, [candles]);

  // Sync Bid price line with settings.showBid.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    // Always remove the existing line first; we'll re-add it if needed.
    if (bidLineRef.current) {
      series.removePriceLine(bidLineRef.current);
      bidLineRef.current = null;
    }

    if (settings.showBid) {
      bidLineRef.current = series.createPriceLine({
        price: bidPrice,
        color: C_DOWN,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: "Bid",
      });
    }
  }, [settings.showBid, bidPrice, candles]);

  // Sync Ask price line with settings.showAsk.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (askLineRef.current) {
      series.removePriceLine(askLineRef.current);
      askLineRef.current = null;
    }

    if (settings.showAsk) {
      askLineRef.current = series.createPriceLine({
        price: askPrice,
        color: C_UP,
        lineWidth: 1,
        lineStyle: 2, // dashed
        axisLabelVisible: true,
        title: "Ask",
      });
    }
  }, [settings.showAsk, askPrice, candles]);

  // Sync pending-order price line.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    if (pendingLineRef.current) {
      series.removePriceLine(pendingLineRef.current);
      pendingLineRef.current = null;
    }

    if (pendingOrderPrice !== null && Number.isFinite(pendingOrderPrice)) {
      pendingLineRef.current = series.createPriceLine({
        price: pendingOrderPrice,
        color: "#7c3aed", // purple — matches the rail active-tool color
        lineWidth: 1,
        lineStyle: 0, // solid
        axisLabelVisible: true,
        title: "Pending order",
      });
    }
  }, [pendingOrderPrice, candles]);

  // Fit content when candles change
  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

/** Generate deterministic demo candles around the supplied mid-price.
    Scales volatility by symbol so e.g. BTCUSD candles look bigger than
    EURUSD candles. */
function generateDemoCandles(
  timeframe: Timeframe,
  count: number,
  midPrice: number,
  symbol: string,
): CandlestickData<UTCTimestamp>[] {
  // Seed shifts per timeframe + symbol so the chart visibly changes
  // when either is changed in the toolbar.
  let symbolSeed = 0;
  for (let i = 0; i < symbol.length; i++) {
    symbolSeed = (symbolSeed * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  const seedMap: Record<Timeframe, number> = {
    M1: 1,
    M5: 5,
    M15: 15,
    M30: 30,
    H1: 60,
    H4: 240,
    D1: 1440,
    W: 10080,
  };
  const seed = seedMap[timeframe] + symbolSeed;
  const baseTime = Math.floor(Date.now() / 1000);
  // Time delta per timeframe (in seconds)
  const deltaMap: Record<Timeframe, number> = {
    M1: 60,
    M5: 300,
    M15: 900,
    M30: 1800,
    H1: 3600,
    H4: 14400,
    D1: 86400,
    W: 604800,
  };
  const delta = deltaMap[timeframe];

  // Volatility scales relative to price — bigger for crypto (BTC, ETH…),
  // tiny for forex majors. Use 0.25% by default.
  const isCrypto =
    symbol.startsWith("BTC") ||
    symbol.startsWith("ETH") ||
    symbol.startsWith("SOL") ||
    symbol.startsWith("XRP");
  const volPct = isCrypto ? 0.01 : 0.0025;
  const moveScale = midPrice * volPct;
  const wickScale = moveScale * 0.5;

  let price = midPrice;
  const out: CandlestickData<UTCTimestamp>[] = [];
  for (let i = 0; i < count; i++) {
    const s = (seed + i) * 9301 + 49297;
    const rnd = ((s % 233280) / 233280) * 2 - 1; // -1..1
    const open = price;
    const move = rnd * moveScale;
    const close = open + move;
    const high = Math.max(open, close) + Math.abs(rnd) * wickScale;
    const low = Math.min(open, close) - Math.abs(rnd) * wickScale;
    out.push({
      time: (baseTime - (count - i - 1) * delta) as UTCTimestamp,
      open,
      high,
      low,
      close,
    });
    price = close;
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Bottom trading panel (strip + expandable tables + close popup)       */
/* ------------------------------------------------------------------ */

function BottomPanel({
  expanded,
  onToggleExpand,
  onPendingPriceChange,
}: {
  expanded: boolean;
  onToggleExpand: () => void;
  onPendingPriceChange: (price: number | null) => void;
}) {
  const [tab, setTab] = useState<"market" | "pending" | "closed">("market");
  const [closePopupOpen, setClosePopupOpen] = useState(false);
  const positions = useMarketsStore((s) => s.positions);
  const pendingOrders = useMarketsStore((s) => s.pendingOrders);
  const closedPositions = useMarketsStore((s) => s.closedPositions);
  const account = useMarketsStore((s) => s.account);

  const floating = account?.floatingPnl ?? 0;
  const floatingColor = floating > 0 ? C_UP : floating < 0 ? C_DOWN : "#ffffff";

  return (
    <div
      className="shrink-0 border-t themed"
      style={{ background: C_PANEL, borderColor: C_BORDER }}
    >
      {/* ── Strip row ── */}
      <div className="flex h-9 items-center gap-2 px-3">
        <StripTab
          label="Market"
          count={positions.length}
          active={tab === "market" && expanded}
          onClick={() => {
            setTab("market");
            if (!expanded) onToggleExpand();
          }}
        />
        <StripTab
          label="Pending"
          count={pendingOrders.length}
          active={tab === "pending" && expanded}
          onClick={() => {
            setTab("pending");
            if (!expanded) onToggleExpand();
          }}
        />
        <StripTab
          label="Closed"
          count={closedPositions.length}
          active={tab === "closed" && expanded}
          onClick={() => {
            setTab("closed");
            if (!expanded) onToggleExpand();
          }}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Floating profit + close */}
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-[#787b86]">Floating profit:</span>
          <span
            className="font-mono tabular-nums"
            style={{ color: floatingColor }}
          >
            ${floating.toFixed(2)}
          </span>
        </div>

        <Separator />

        {/* Close button — opens the close-positions popup */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setClosePopupOpen((v) => !v)}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white transition-colors hover:opacity-90"
            style={{ background: "#2a2e39" }}
          >
            Close
            <ChevronDown className="h-3 w-3" />
          </button>
          {closePopupOpen && (
            <ClosePositionsPopup
              onClose={() => setClosePopupOpen(false)}
            />
          )}
        </div>

        {/* Expand/collapse toggle */}
        <button
          type="button"
          onClick={onToggleExpand}
          title={expanded ? "Collapse" : "Expand"}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] transition-colors hover:bg-[#2a2e39] hover:text-white"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          title="Maximize"
          aria-label="Maximize"
          className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] transition-colors hover:bg-[#2a2e39] hover:text-white"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Expanded table area ── */}
      {expanded && (
        <div
          className="h-[220px] overflow-auto border-t themed"
          style={{ borderColor: C_BORDER, background: "#161922" }}
        >
          {tab === "market" && (
            <PositionsTable positions={positions} />
          )}
          {tab === "pending" && (
            <PendingOrdersTable
              orders={pendingOrders}
              onPendingPriceChange={onPendingPriceChange}
            />
          )}
          {tab === "closed" && (
            <ClosedTable closed={closedPositions} />
          )}
        </div>
      )}
    </div>
  );
}

function StripTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 text-[11px] transition-colors",
        active
          ? "text-white"
          : "text-[#787b86] hover:text-white",
      )}
      style={active ? { borderBottom: `2px solid ${C_BLUE}` } : undefined}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className="flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold"
          style={{
            background: active ? C_BLUE : "#2a2e39",
            color: "#ffffff",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

/* ── Close-positions popup ── */

function ClosePositionsPopup({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<
    "all" | "profitable" | "losing" | "long" | "short"
  >("all");
  const closeMatching = useMarketsStore((s) => s.closeMatching);
  const positions = useMarketsStore((s) => s.positions);

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!e.composedPath().includes(rootRef.current)) onClose();
    };
    const id = window.setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  const handleConfirm = () => {
    closeMatching(choice);
    onClose();
  };

  const options: { id: typeof choice; label: string }[] = [
    { id: "all", label: "All currently open" },
    { id: "profitable", label: "All profitable" },
    { id: "losing", label: "All losing" },
    { id: "long", label: "All long" },
    { id: "short", label: "All short" },
  ];

  return (
    <div
      ref={rootRef}
      className="absolute bottom-9 right-0 z-30 w-[280px] overflow-hidden rounded-md shadow-xl themed"
      style={{
        background: "#1e1e2d",
        border: "1px solid #2a2a3c",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
      }}
    >
      <div className="px-4 pb-2 pt-3 text-[12px] text-white">
        Which positions would you like
        <br />
        to close at market prices?
      </div>
      <div className="px-2 pb-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[12px] text-[#e0e0e0] hover:bg-[#2a2a3c] rounded"
          >
            <input
              type="radio"
              name="close-choice"
              checked={choice === opt.id}
              onChange={() => setChoice(opt.id)}
              className="h-3 w-3 accent-[#4b9eff]"
            />
            {opt.label}
          </label>
        ))}
      </div>
      <div className="flex gap-2 border-t px-3 py-2" style={{ borderColor: "#2e2e3e" }}>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={positions.length === 0}
          className="flex-1 rounded bg-[#2962ff] px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded bg-[#2a2e39] px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-[#363a45]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ── Trading tables ── */

function PositionsTable({ positions }: { positions: ReturnType<typeof useMarketsStore.getState>["positions"] }) {
  if (positions.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[11px] text-[#787b86]">
        No open positions. Place an order from the Order Details panel.
      </div>
    );
  }
  return (
    <table className="w-full text-[11px] text-[#d1d4dc]">
      <thead className="text-[10px] uppercase text-[#787b86] sticky top-0 bg-[#161922]">
        <tr>
          <Th>Instrument</Th>
          <Th>Direction</Th>
          <Th>Volume</Th>
          <Th>Open time</Th>
          <Th>Open price</Th>
          <Th>Current price</Th>
          <Th>Price change</Th>
          <Th>P/L</Th>
        </tr>
      </thead>
      <tbody>
        {positions.map((p) => (
          <tr key={p.id} className="border-t border-[#2a2e39]">
            <Td className="font-semibold text-white">{p.symbol}</Td>
            <Td>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                style={{ background: p.side === "buy" ? C_UP : C_DOWN }}
              >
                {p.side === "buy" ? "Buy" : "Sell"}
              </span>
            </Td>
            <Td className="font-mono tabular-nums">{p.quantity.toFixed(2)}</Td>
            <Td className="font-mono tabular-nums">{new Date(p.openedAt).toLocaleString()}</Td>
            <Td className="font-mono tabular-nums">{p.entryPrice.toFixed(5)}</Td>
            <Td className="font-mono tabular-nums">{p.entryPrice.toFixed(5)}</Td>
            <Td className="font-mono tabular-nums">0.00%</Td>
            <Td>
              <span
                className="font-mono tabular-nums"
                style={{
                  color:
                    p.unrealizedPnl > 0 ? C_UP : p.unrealizedPnl < 0 ? C_DOWN : "#fff",
                }}
              >
                ${p.unrealizedPnl.toFixed(2)}
              </span>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PendingOrdersTable({
  orders,
  onPendingPriceChange,
}: {
  orders: ReturnType<typeof useMarketsStore.getState>["pendingOrders"];
  onPendingPriceChange: (price: number | null) => void;
}) {
  // When the pending tab is shown, propagate the first pending order's
  // entry price to the chart so the pending-order line shows.
  useEffect(() => {
    if (orders.length > 0) {
      onPendingPriceChange(orders[0].price);
    } else {
      onPendingPriceChange(null);
    }
    return () => onPendingPriceChange(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders.length, orders[0]?.price]);

  if (orders.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[11px] text-[#787b86]">
        No pending orders. Configure one from the Order Details → Pending tab.
      </div>
    );
  }
  return (
    <table className="w-full text-[11px] text-[#d1d4dc]">
      <thead className="text-[10px] uppercase text-[#787b86] sticky top-0 bg-[#161922]">
        <tr>
          <Th>Instrument</Th>
          <Th>Type</Th>
          <Th>Direction</Th>
          <Th>Entry price</Th>
          <Th>Volume</Th>
          <Th>Created</Th>
          <Th>SL</Th>
          <Th>TP</Th>
          <Th></Th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => (
          <tr key={o.id} className="border-t border-[#2a2e39]">
            <Td className="font-semibold text-white">{o.symbol}</Td>
            <Td className="capitalize">{o.type}</Td>
            <Td>
              <span
                className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                style={{ background: o.side === "buy" ? C_UP : C_DOWN }}
              >
                {o.side === "buy" ? "Buy" : "Sell"}
              </span>
            </Td>
            <Td className="font-mono tabular-nums">{o.price.toFixed(5)}</Td>
            <Td className="font-mono tabular-nums">{o.quantity.toFixed(2)}</Td>
            <Td className="font-mono tabular-nums">{new Date(o.createdAt).toLocaleString()}</Td>
            <Td className="font-mono tabular-nums">{o.stopLoss || "—"}</Td>
            <Td className="font-mono tabular-nums">{o.takeProfit || "—"}</Td>
            <Td>
              <button
                type="button"
                onClick={() => useMarketsStore.getState().cancelPending(o.id)}
                className="text-[10px] text-[#787b86] hover:text-white"
              >
                Cancel
              </button>
            </Td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClosedTable({ closed }: { closed: ReturnType<typeof useMarketsStore.getState>["closedPositions"] }) {
  if (closed.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-[11px] text-[#787b86]">
        No closed positions yet.
      </div>
    );
  }

  // Group closed positions by date for the history layout.
  const groups = new Map<string, typeof closed>();
  for (const c of closed) {
    const key = new Date(c.closedAt).toLocaleDateString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  return (
    <div className="text-[11px] text-[#d1d4dc]">
      {Array.from(groups.entries()).map(([date, items]) => (
        <div key={date}>
          <div className="sticky top-0 bg-[#1e222d] px-3 py-1 text-[10px] font-bold uppercase text-[#787b86]">
            {date}
          </div>
          <table className="w-full">
            <thead className="text-[10px] uppercase text-[#787b86]">
              <tr>
                <Th>Instrument</Th>
                <Th>Direction</Th>
                <Th>Volume</Th>
                <Th>Close time</Th>
                <Th>Close price</Th>
                <Th>Price change</Th>
                <Th>P/L</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} className="border-t border-[#2a2e39]">
                  <Td className="font-semibold text-white">{c.symbol}</Td>
                  <Td>
                    <span
                      className="rounded px-1.5 py-0.5 text-[9px] font-bold text-white"
                      style={{ background: c.side === "buy" ? C_UP : C_DOWN }}
                    >
                      {c.side === "buy" ? "Buy" : "Sell"}
                    </span>
                  </Td>
                  <Td className="font-mono tabular-nums">{c.quantity.toFixed(2)}</Td>
                  <Td className="font-mono tabular-nums">
                    {new Date(c.closedAt).toLocaleTimeString()}
                  </Td>
                  <Td className="font-mono tabular-nums">{c.exitPrice.toFixed(5)}</Td>
                  <Td className="font-mono tabular-nums">
                    {((c.exitPrice - c.entryPrice) / c.entryPrice * 100).toFixed(2)}%
                  </Td>
                  <Td>
                    <span
                      className="font-mono tabular-nums"
                      style={{
                        color:
                          c.realizedPnl > 0 ? C_UP : c.realizedPnl < 0 ? C_DOWN : "#fff",
                      }}
                    >
                      ${c.realizedPnl.toFixed(2)}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-1.5 text-left font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <td className={cn("px-3 py-1.5", className)}>{children}</td>;
}

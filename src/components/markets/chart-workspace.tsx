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

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  Star,
  Bell,
  Info,
  Clock,
  Settings,
  Crosshair,
  TrendingUp,
  Minus,
  Plus,
  MousePointer2,
  Ruler,
  PenTool,
  Eraser,
  ZoomIn,
  Trash2,
  Type,
  Minus as HorizontalLine,
  MoveVertical as VerticalLine,
  Triangle,
  Circle,
  Square,
  Pencil,
  Magnet,
  ChevronDown,
  Maximize2,
  MinusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                           */
/* ------------------------------------------------------------------ */

const TIMEFRAMES = ["M1", "M5", "M15", "M30", "H1", "H4", "D1", "W"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];

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
const C_ACTIVE_TOOL = "#7c3aed"; // purple active-tool indicator

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */

export function ChartWorkspace() {
  const [timeframe, setTimeframe] = useState<Timeframe>("M1");
  const [selectedTool, setSelectedTool] = useState<string>("rect");

  // Static reference values matching the screenshot — these are
  // visual placeholders for the EURUSD snapshot. Real market data
  // will overlay these once a provider is wired in.
  const SELL_PRICE = 1.16744;
  const BUY_PRICE = 1.16796;
  const CHANGE_PCT = -0.03;

  return (
    <div className="themed flex h-full min-w-0 flex-1 flex-col bg-canvas">
      {/* ── Top chart toolbar ── */}
      <ChartToolbar changePct={CHANGE_PCT} timeframe={timeframe} onTimeframe={setTimeframe} />

      {/* ── Body: drawing rail + chart + overlays ── */}
      <div className="relative flex min-h-0 flex-1">
        <DrawingRail selected={selectedTool} onSelect={setSelectedTool} />

        {/* Chart container fills the rest */}
        <div className="relative min-w-0 flex-1 bg-[#131722]">
          <CandleChart timeframe={timeframe} />

          {/* Quick Sell/Buy block — upper-left overlay */}
          <QuickTrade sellPrice={SELL_PRICE} buyPrice={BUY_PRICE} />
        </div>
      </div>

      {/* ── Bottom trading strip ── */}
      <BottomStrip />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Top chart toolbar                                                   */
/* ------------------------------------------------------------------ */

function ChartToolbar({
  changePct,
  timeframe,
  onTimeframe,
}: {
  changePct: number;
  timeframe: Timeframe;
  onTimeframe: (t: Timeframe) => void;
}) {
  const [fav, setFav] = useState(false);
  const chgColor = changePct < 0 ? C_DOWN : C_UP;
  const chgSign = changePct >= 0 ? "+" : "";

  return (
    <div
      className="flex h-10 shrink-0 items-center gap-2 border-b px-3 themed"
      style={{
        background: C_PANEL,
        borderColor: C_BORDER,
      }}
    >
      {/* Instrument symbol */}
      <span className="text-[13px] font-bold text-white">EURUSD</span>

      {/* Percentage badge */}
      <span
        className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
        style={{ background: chgColor }}
      >
        {chgSign}
        {changePct.toFixed(2)}%
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

      {/* New order button */}
      <button
        type="button"
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

      {/* Settings gear (far right) */}
      <ToolbarBtn icon={Settings} title="Chart settings" />
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
/* Drawing rail (left vertical chart toolbar)                          */
/* ------------------------------------------------------------------ */

interface RailTool {
  id: string;
  icon: typeof Star;
  label: string;
}

const RAIL_GROUPS: RailTool[][] = [
  [
    { id: "cursor", icon: MousePointer2, label: "Cursor" },
    { id: "crosshair", icon: Crosshair, label: "Crosshair" },
    { id: "trend", icon: TrendingUp, label: "Trend line" },
    { id: "hline", icon: HorizontalLine, label: "Horizontal line" },
    { id: "vline", icon: VerticalLine, label: "Vertical line" },
  ],
  [
    { id: "rect", icon: Square, label: "Rectangle" },
    { id: "circle", icon: Circle, label: "Ellipse" },
    { id: "triangle", icon: Triangle, label: "Triangle" },
    { id: "text", icon: Type, label: "Text" },
  ],
  [
    { id: "brush", icon: PenTool, label: "Brush" },
    { id: "pencil", icon: Pencil, label: "Pencil" },
    { id: "eraser", icon: Eraser, label: "Eraser" },
  ],
  [
    { id: "magnet", icon: Magnet, label: "Magnet" },
    { id: "ruler", icon: Ruler, label: "Measure" },
    { id: "zoom", icon: ZoomIn, label: "Zoom" },
    { id: "trash", icon: Trash2, label: "Remove drawings" },
  ],
];

function DrawingRail({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      className="flex w-8 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r py-1 themed"
      style={{
        background: C_PANEL,
        borderColor: C_BORDER,
      }}
    >
      {RAIL_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col items-center gap-0.5">
          {group.map((tool) => (
            <RailButton
              key={tool.id}
              tool={tool}
              active={selected === tool.id}
              onClick={() => onSelect(tool.id)}
            />
          ))}
          {gi < RAIL_GROUPS.length - 1 && (
            <div className="my-1 h-px w-5" style={{ background: C_BORDER }} />
          )}
        </div>
      ))}
    </div>
  );
}

function RailButton({
  tool,
  active,
  onClick,
}: {
  tool: RailTool;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = tool.icon;
  return (
    <button
      type="button"
      title={tool.label}
      aria-label={tool.label}
      onClick={onClick}
      className={cn(
        "relative flex h-6 w-6 items-center justify-center rounded transition-colors",
        active ? "text-white" : "text-[#787b86] hover:bg-[#2a2e39] hover:text-white",
      )}
      style={active ? { background: "#2a2e39" } : undefined}
    >
      {active && (
        <span
          aria-hidden
          className="absolute left-[-4px] top-0 h-full w-[3px] rounded-r"
          style={{ background: C_ACTIVE_TOOL }}
        />
      )}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Candlestick chart (lightweight-charts)                              */
/* ------------------------------------------------------------------ */

function CandleChart({ timeframe }: { timeframe: Timeframe }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Deterministic demo candles — produces a stable, realistic-looking
  // chart. Re-generated when the timeframe changes so the chart visibly
  // responds to the toolbar control.
  const candles = useMemo<CandlestickData<UTCTimestamp>[]>(
    () => generateDemoCandles(timeframe, 120),
    [timeframe],
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
    };
  }, [candles]);

  // Fit content when candles change
  useEffect(() => {
    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />;
}

/** Generate deterministic demo candles around a realistic EURUSD price. */
function generateDemoCandles(
  timeframe: Timeframe,
  count: number,
): CandlestickData<UTCTimestamp>[] {
  // Seed shifts per timeframe so the chart visibly changes when
  // the user picks a different timeframe in the toolbar.
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
  const seed = seedMap[timeframe];
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

  let price = 1.16750;
  const out: CandlestickData<UTCTimestamp>[] = [];
  for (let i = 0; i < count; i++) {
    const s = (seed + i) * 9301 + 49297;
    const rnd = ((s % 233280) / 233280) * 2 - 1; // -1..1
    const open = price;
    const move = rnd * 0.0003;
    const close = open + move;
    const high = Math.max(open, close) + Math.abs(rnd) * 0.00015;
    const low = Math.min(open, close) - Math.abs(rnd) * 0.00015;
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
/* Bottom trading strip                                                 */
/* ------------------------------------------------------------------ */

function BottomStrip() {
  const [tab, setTab] = useState<"market" | "pending" | "closed">("market");

  return (
    <div
      className="flex h-9 shrink-0 items-center gap-2 border-t px-3 themed"
      style={{
        background: C_PANEL,
        borderColor: C_BORDER,
      }}
    >
      {/* Tabs — left side */}
      <StripTab
        label="Market"
        count={0}
        active={tab === "market"}
        onClick={() => setTab("market")}
      />
      <StripTab
        label="Pending"
        count={0}
        active={tab === "pending"}
        onClick={() => setTab("pending")}
      />
      <StripTab
        label="Closed"
        active={tab === "closed"}
        onClick={() => setTab("closed")}
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right side — floating profit + close */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className="text-[#787b86]">Floating profit:</span>
        <span className="font-mono tabular-nums text-white">$0.00</span>
      </div>

      <Separator />

      <button
        type="button"
        className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-white transition-colors hover:opacity-90"
        style={{ background: "#2a2e39" }}
      >
        Close
        <ChevronDown className="h-3 w-3" />
      </button>

      <button
        type="button"
        title="Minimize"
        aria-label="Minimize"
        className="flex h-6 w-6 items-center justify-center rounded text-[#787b86] transition-colors hover:bg-[#2a2e39] hover:text-white"
      >
        <MinusCircle className="h-3.5 w-3.5" />
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

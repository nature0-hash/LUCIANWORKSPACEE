"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type UTCTimestamp,
  type LineData,
  type AreaData,
  type MouseEventParams,
} from "lightweight-charts";
import { useMarketsStore } from "@/store/markets";
import { getProvider } from "@/lib/markets/provider";
import type { Candle, Timeframe, OrderSide } from "@/lib/markets/types";
import { openPosition } from "@/lib/markets/paper-trading";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Crosshair,
  TrendingUp,
  Minus,
  Type,
  MousePointer2,
  Ruler,
  PenTool,
  Eraser,
  ZoomIn,
  Trash2,
  Star,
  Bell,
  Info,
  RefreshCw,
  Maximize2,
  Plus,
  Minus as MinusBtn,
} from "lucide-react";

const TIMEFRAMES: { value: Timeframe; label: string }[] = [
  { value: "1m", label: "1m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1H" },
  { value: "4h", label: "4H" },
  { value: "1d", label: "1D" },
  { value: "1w", label: "1W" },
];

type ChartType = "candles" | "line" | "area";

const DRAWING_TOOLS = [
  { icon: MousePointer2, label: "Cursor" },
  { icon: Crosshair, label: "Crosshair" },
  { icon: TrendingUp, label: "Trend line" },
  { icon: Minus, label: "Horizontal line" },
  { icon: Type, label: "Text" },
  { icon: Ruler, label: "Measure" },
  { icon: PenTool, label: "Draw" },
  { icon: Eraser, label: "Eraser" },
  { icon: ZoomIn, label: "Zoom" },
  { icon: Trash2, label: "Clear" },
];

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<
    ISeriesApi<"Candlestick"> | ISeriesApi<"Line"> | ISeriesApi<"Area"> | null
  >(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const selectedSymbol = useMarketsStore((s) => s.selectedSymbol);
  const timeframe = useMarketsStore((s) => s.timeframe);
  const setTimeframe = useMarketsStore((s) => s.setTimeframe);
  const prices = useMarketsStore((s) => s.prices);
  const instruments = useMarketsStore((s) => s.instruments);
  const updatePrice = useMarketsStore((s) => s.updatePrice);
  const tickers = useMarketsStore((s) => s.tickers);
  const mode = useMarketsStore((s) => s.mode);
  const riskRules = useMarketsStore((s) => s.riskRules);
  const refreshAccount = useMarketsStore((s) => s.refreshAccount);

  const [chartType, setChartType] = useState<ChartType>("candles");
  const [activeTool, setActiveTool] = useState(0);
  const [volume, setVolume] = useState("0.01");

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const currentPrice = selectedSymbol ? prices.get(selectedSymbol) : undefined;
  const ticker = selectedSymbol ? tickers.get(selectedSymbol) : undefined;
  const changePct = ticker?.priceChangePercent ?? 0;
  const changeAbs = ticker?.priceChange ?? 0;
  const bid = ticker?.bidPrice ?? currentPrice;
  const ask = ticker?.askPrice ?? currentPrice;
  const high = ticker?.highPrice;
  const low = ticker?.lowPrice;

  // Create chart
  useEffect(() => {
    if (!containerRef.current || chartRef.current) return;

    try {
      const w = containerRef.current.clientWidth || 500;
      const h = containerRef.current.clientHeight || 200;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: "#13161c" },
          textColor: "#8b949e",
          fontSize: 11,
        },
        grid: {
          vertLines: { color: "#1f2329" },
          horzLines: { color: "#1f2329" },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: "#3b82f6", width: 1, style: 2 },
          horzLine: { color: "#3b82f6", width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: "#2d333b" },
        timeScale: {
          borderColor: "#2d333b",
          timeVisible: true,
          secondsVisible: false,
        },
        width: w,
        height: h,
      });
      chartRef.current = chart;

      const resize = () => {
        if (containerRef.current && chartRef.current) {
          chartRef.current.resize(
            containerRef.current.clientWidth,
            containerRef.current.clientHeight,
          );
        }
      };
      window.addEventListener("resize", resize);

      return () => {
        window.removeEventListener("resize", resize);
        chart.remove();
        chartRef.current = null;
      };
    } catch {
      // chart creation failed
    }
  }, [selectedSymbol]);

  const createSeries = useCallback((type: ChartType) => {
    if (!chartRef.current) return;
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    if (type === "candles") {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: "#00c087",
        downColor: "#ff4757",
        borderUpColor: "#00c087",
        borderDownColor: "#ff4757",
        wickUpColor: "#00c087",
        wickDownColor: "#ff4757",
      });
    } else if (type === "line") {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: "#3b82f6",
        lineWidth: 2,
      });
    } else {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        lineColor: "#3b82f6",
        topColor: "rgba(59,130,246,0.3)",
        bottomColor: "transparent",
        lineWidth: 2,
      });
    }
  }, []);

  // Load candles + subscribe
  useEffect(() => {
    if (!selectedSymbol || !chartRef.current) return;
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    const provider = getProvider("crypto");
    if (!provider) return;

    let cancelled = false;
    createSeries(chartType);

    provider
      .getCandles(selectedSymbol, timeframe, 500)
      .then((candles: Candle[]) => {
        if (cancelled || !seriesRef.current) return;
        if (chartType === "candles") {
          (seriesRef.current as ISeriesApi<"Candlestick">).setData(
            candles.map((c) => ({
              time: c.time as UTCTimestamp,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            })),
          );
        } else if (chartType === "line") {
          (seriesRef.current as ISeriesApi<"Line">).setData(
            candles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.close,
            })) as LineData[],
          );
        } else {
          (seriesRef.current as ISeriesApi<"Area">).setData(
            candles.map((c) => ({
              time: c.time as UTCTimestamp,
              value: c.close,
            })) as AreaData[],
          );
        }
        chartRef.current?.timeScale().fitContent();
      });

    unsubRef.current = provider.subscribeKline(
      selectedSymbol,
      timeframe,
      (candle: Candle) => {
        if (!seriesRef.current) return;
        if (chartType === "candles") {
          (seriesRef.current as ISeriesApi<"Candlestick">).update({
            time: candle.time as UTCTimestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          });
        } else if (chartType === "line") {
          (seriesRef.current as ISeriesApi<"Line">).update({
            time: candle.time as UTCTimestamp,
            value: candle.close,
          });
        } else {
          (seriesRef.current as ISeriesApi<"Area">).update({
            time: candle.time as UTCTimestamp,
            value: candle.close,
          });
        }
      },
    );

    const unsubPrice = provider.subscribePrice(selectedSymbol, (update) => {
      updatePrice(update);
    });

    return () => {
      cancelled = true;
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      unsubPrice();
    };
  }, [selectedSymbol, timeframe, chartType, createSeries, updatePrice]);

  // OHLC overlay on crosshair
  const ohlcRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!chartRef.current) return;
    const handler = (param: MouseEventParams) => {
      if (!ohlcRef.current || !param.time || !seriesRef.current) {
        if (ohlcRef.current) ohlcRef.current.textContent = "";
        return;
      }
      const data = param.seriesData.get(seriesRef.current);
      if (!data) return;
      if ("open" in data) {
        const d = data as CandlestickData;
        ohlcRef.current.innerHTML = `O <span class="tabular-nums">${d.open.toFixed(2)}</span>  H <span class="tabular-nums">${d.high.toFixed(2)}</span>  L <span class="tabular-nums">${d.low.toFixed(2)}</span>  C <span class="tabular-nums">${d.close.toFixed(2)}</span>`;
      }
    };
    chartRef.current.subscribeCrosshairMove(handler);
    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handler);
    };
  }, []);

  // Quick trade from floating ticket
  const handleQuickTrade = (side: OrderSide) => {
    if (!selectedSymbol) return;
    const price = side === "buy" ? ask : bid;
    if (!price) return;
    if (mode === "real") {
      toast({ title: "Broker connection required", variant: "destructive" });
      return;
    }
    const qty = parseFloat(volume) || 0;
    if (qty <= 0) return;
    const result = openPosition(selectedSymbol, side, price, qty, 0, 0, riskRules);
    if (result.success) {
      toast({
        title: `${side.toUpperCase()} filled`,
        description: `${qty} ${instrument?.base} @ ${price.toFixed(2)}`,
      });
      refreshAccount();
    } else {
      toast({ title: "Order rejected", description: result.error, variant: "destructive" });
    }
  };

  if (!selectedSymbol) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#565c66]">
        Select an instrument from the left panel.
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[#13161c]">
      {/* Drawing tools strip */}
      <div className="flex w-7 shrink-0 flex-col items-center gap-0.5 border-r border-[#1f2329] py-1">
        {DRAWING_TOOLS.map((tool, i) => (
          <button
            key={i}
            title={tool.label}
            onClick={() => setActiveTool(i)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors",
              activeTool === i
                ? "bg-[#3b82f6] text-white"
                : "text-[#565c66] hover:bg-[#22262f] hover:text-white",
            )}
          >
            <tool.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Chart area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Chart header bar */}
        <div className="flex h-9 shrink-0 items-center gap-2 border-b border-[#1f2329] px-2">
          {/* Timeframes */}
          <div className="flex items-center gap-0.5">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  timeframe === tf.value
                    ? "bg-[#3b82f6] text-white"
                    : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-[#2d333b]" />

          {/* Symbol + change */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white">{selectedSymbol}</span>
            {changePct !== 0 && (
              <span
                className={cn(
                  "rounded px-1 py-0.5 text-[9px] font-medium",
                  changePct >= 0
                    ? "bg-[#00c087]/15 text-[#00c087]"
                    : "bg-[#ff4757]/15 text-[#ff4757]",
                )}
              >
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            )}
          </div>

          {/* Instrument controls */}
          <div className="flex items-center gap-1 text-[#565c66]">
            <button title="Favorite" className="hover:text-white">
              <Star className="h-3 w-3" />
            </button>
            <button title="Alerts" className="hover:text-white">
              <Bell className="h-3 w-3" />
            </button>
            <button title="Info" className="hover:text-white">
              <Info className="h-3 w-3" />
            </button>
            <button title="Refresh" className="hover:text-white">
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>

          {/* Chart type toggle */}
          <div className="ml-auto flex items-center gap-0.5">
            {(["candles", "line", "area"] as ChartType[]).map((t) => (
              <button
                key={t}
                onClick={() => setChartType(t)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                  chartType === t
                    ? "bg-[#3b82f6] text-white"
                    : "text-[#8b949e] hover:bg-[#22262f] hover:text-white",
                )}
              >
                {t === "candles" ? "▮" : t === "line" ? "─" : "◣"}
              </button>
            ))}
            <button title="Fullscreen" className="ml-1 text-[#565c66] hover:text-white">
              <Maximize2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Floating Sell/Buy ticket */}
        <div className="relative">
          <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
            {/* Sell */}
            <button
              onClick={() => handleQuickTrade("sell")}
              disabled={!bid || mode === "real"}
              className="flex flex-col items-center rounded bg-[#ff4757] px-3 py-1 text-white transition-colors hover:bg-[#e63946] disabled:opacity-50"
            >
              <span className="text-[9px] font-bold uppercase">Sell</span>
              <span className="font-mono text-[11px] font-bold tabular-nums">
                {bid !== undefined
                  ? bid.toFixed(instrument?.pricePrecision ?? 2)
                  : "—"}
              </span>
            </button>

            {/* Volume */}
            <div className="flex items-center gap-0.5 rounded border border-[#2d333b] bg-[#1a1d23] px-1">
              <button
                onClick={() =>
                  setVolume((v) =>
                    Math.max(0.01, parseFloat(v) - 0.01).toFixed(2),
                  )
                }
                className="px-1 text-[#8b949e] hover:text-white"
              >
                <MinusBtn className="h-3 w-3" />
              </button>
              <input
                type="text"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                className="w-10 border-0 bg-transparent text-center font-mono text-[11px] text-white focus:outline-none"
              />
              <button
                onClick={() =>
                  setVolume((v) => (parseFloat(v) + 0.01).toFixed(2))
                }
                className="px-1 text-[#8b949e] hover:text-white"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>

            {/* Buy */}
            <button
              onClick={() => handleQuickTrade("buy")}
              disabled={!ask || mode === "real"}
              className="flex flex-col items-center rounded bg-[#00c087] px-3 py-1 text-white transition-colors hover:bg-[#00b377] disabled:opacity-50"
            >
              <span className="text-[9px] font-bold uppercase">Buy</span>
              <span className="font-mono text-[11px] font-bold tabular-nums">
                {ask !== undefined
                  ? ask.toFixed(instrument?.pricePrecision ?? 2)
                  : "—"}
              </span>
            </button>
          </div>

          {/* OHLC sub-line */}
          <div className="absolute left-2 top-14 z-10 flex items-center gap-2 rounded bg-[#1a1d23]/80 px-2 py-0.5 text-[9px] text-[#8b949e] backdrop-blur-sm">
            <span>
              O <span className="tabular-nums">{currentPrice?.toFixed(2) ?? "—"}</span>
            </span>
            <span>
              H <span className="tabular-nums">{high?.toFixed(2) ?? "—"}</span>
            </span>
            <span>
              L <span className="tabular-nums">{low?.toFixed(2) ?? "—"}</span>
            </span>
            <span>
              C <span className="tabular-nums">{currentPrice?.toFixed(2) ?? "—"}</span>
            </span>
            <span
              className={cn(
                changeAbs >= 0 ? "text-[#00c087]" : "text-[#ff4757]",
              )}
            >
              {changeAbs >= 0 ? "+" : ""}
              {changeAbs.toFixed(2)} ({changePct >= 0 ? "+" : ""}
              {changePct.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Chart canvas */}
        <div ref={containerRef} className="min-h-0 flex-1" />
      </div>
    </div>
  );
}

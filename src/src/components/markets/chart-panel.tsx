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
import type { Candle, Timeframe } from "@/lib/markets/types";

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

  const [chartType, setChartType] = useLocalState<ChartType>("candles");

  const instrument = instruments.find((i) => i.symbol === selectedSymbol);
  const currentPrice = selectedSymbol ? prices.get(selectedSymbol) : undefined;

  // Create the chart when the container becomes available (i.e. when
  // selectedSymbol is set and the container div renders).
  useEffect(() => {
    if (!containerRef.current) return;
    if (chartRef.current) return; // already created

    try {
      const cs = getComputedStyle(document.documentElement);
      const cssVar = (name: string) => cs.getPropertyValue(name).trim() || "#888888";
      const fgMuted = cssVar("--fg-muted");
      const lineMuted = cssVar("--line-muted");
      const line = cssVar("--line");
      const accent = cssVar("--accent");

      const w = containerRef.current.clientWidth || 500;
      const h = containerRef.current.clientHeight || 200;

      const chart = createChart(containerRef.current, {
        layout: {
          background: { color: "transparent" },
          textColor: fgMuted,
          fontSize: 11,
        },
        grid: {
          vertLines: { color: lineMuted },
          horzLines: { color: lineMuted },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: { color: accent, width: 1, style: 2 },
          horzLine: { color: accent, width: 1, style: 2 },
        },
        rightPriceScale: { borderColor: line },
        timeScale: {
          borderColor: line,
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
    } catch (err) {
    }
  }, [selectedSymbol]);

  // Create/update the series when chartType changes.
  const createSeries = useCallback((type: ChartType) => {
    if (!chartRef.current) return;
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }
    // Resolve accent color at runtime.
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue("--accent").trim() || "#d4a72c";
    if (type === "candles") {
      seriesRef.current = chartRef.current.addSeries(CandlestickSeries, {
        upColor: accent,
        downColor: "#ef4444",
        borderUpColor: accent,
        borderDownColor: "#ef4444",
        wickUpColor: accent,
        wickDownColor: "#ef4444",
      });
    } else if (type === "line") {
      seriesRef.current = chartRef.current.addSeries(LineSeries, {
        color: accent,
        lineWidth: 2,
      });
    } else {
      seriesRef.current = chartRef.current.addSeries(AreaSeries, {
        lineColor: accent,
        topColor: accent,
        bottomColor: "transparent",
        lineWidth: 2,
      });
    }
  }, []);

  // Load candles + subscribe to live updates when symbol/timeframe changes.
  useEffect(() => {
    if (!selectedSymbol || !chartRef.current) return;
    // Clean up previous subscription.
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    const provider = getProvider("crypto");
    if (!provider) return;

    let cancelled = false;

    // Create the right series type.
    createSeries(chartType);

    // Fetch historical candles.
    provider.getCandles(selectedSymbol, timeframe, 500).then((candles: Candle[]) => {
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
          candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })) as LineData[],
        );
      } else {
        (seriesRef.current as ISeriesApi<"Area">).setData(
          candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })) as AreaData[],
        );
      }
      chartRef.current?.timeScale().fitContent();
    });

    // Subscribe to live kline updates.
    unsubRef.current = provider.subscribeKline(selectedSymbol, timeframe, (candle: Candle) => {
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
    });

    // Subscribe to live trade prices for the account bar + instrument list.
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

  // Crosshair move → show OHLC overlay.
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
      } else if ("value" in data) {
        ohlcRef.current.innerHTML = `Price <span class="tabular-nums">${(data as { value: number }).value.toFixed(2)}</span>`;
      }
    };
    chartRef.current.subscribeCrosshairMove(handler);
    return () => {
      chartRef.current?.unsubscribeCrosshairMove(handler);
    };
  }, []);

  if (!selectedSymbol) {
    return (
      <div className="themed flex h-full items-center justify-center text-sm text-fg-muted">
        Select an instrument from the left panel.
      </div>
    );
  }

  return (
    <div className="themed flex h-full flex-col bg-surface">
      {/* Chart toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line-muted px-2">
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setTimeframe(tf.value)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                timeframe === tf.value
                  ? "bg-accent text-accent-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {(["candles", "line", "area"] as ChartType[]).map((t) => (
            <button
              key={t}
              onClick={() => setChartType(t)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                chartType === t
                  ? "bg-accent text-accent-fg"
                  : "text-fg-muted hover:bg-hover hover:text-fg"
              }`}
            >
              {t === "candles" ? "▮" : t === "line" ? "─" : "◣"}
            </button>
          ))}
        </div>
      </div>

      {/* Symbol + price header */}
      <div className="flex h-7 shrink-0 items-center gap-3 border-b border-line-muted px-3">
        <span className="text-xs font-semibold text-fg">{selectedSymbol}</span>
        {instrument && (
          <span className="hidden text-[10px] text-fg-faint md:inline">{instrument.name}</span>
        )}
        {currentPrice !== undefined && (
          <span className="font-mono text-xs text-fg">{currentPrice.toFixed(2)}</span>
        )}
        <div ref={ohlcRef} className="ml-auto font-mono text-[10px] text-fg-muted" />
      </div>

      {/* Chart canvas — always rendered (even before selectedSymbol is set,
          the container needs to exist so the ref is attached when the
          chart-creation useEffect runs). We handle the "no symbol" case
          with the early return above; when a symbol IS selected, this
          div receives the chart canvas. */}
      <div ref={containerRef} className="min-h-0 flex-1" />
    </div>
  );
}

// Tiny useState wrapper — kept separate to avoid import-order issues.
function useLocalState<T>(initial: T): [T, (v: T) => void] {
  return useState<T>(initial);
}

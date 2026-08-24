"use client";

// Vector Studio — main view.
//
// LUCIAN's professional image-to-vector production tool. NOT a clone of
// the old Lucian's simplistic pixel-rectangle demo. Uses the real
// imagetracerjs engine (see src/lib/workspace/vector-studio.ts).
//
// Layout (single column, IDE-like — NOT a generic dashboard):
//
//   ┌──────────────────────────────────────────────────────────────┐
//   │ Vector Studio                                        [status] │
//   ├─────────────────┬────────────────────────────────────────────┤
//   │ TOOLBAR         │ OUTPUT                                     │
//   │ • Mode          │ ┌──────────┬──────────┐                   │
//   │ • Colors        │ │ Original │ Vector   │ ← side-by-side    │
//   │ • Smoothing     │ └──────────┴──────────┘                   │
//   │ • Detail        │                                            │
//   │ • Min path      │ (zoom + pan + checkerboard bg)             │
//   │ • Blur          │                                            │
//   │ • [Trace]       │                                            │
//   ├─────────────────┴────────────────────────────────────────────┤
//   │ INSPECTOR   | SVG code viewer   | EXPORT bar                │
//   └──────────────────────────────────────────────────────────────┘

import { useCallback, useRef, useState } from "react";
import {
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Plus,
  Spline,
  Upload,
  Wand2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui-devspace/button";
import { Label } from "@/components/ui-devspace/label";
import { Textarea } from "@/components/ui-devspace/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-devspace/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-devspace/tabs";
import { toast } from "@/hooks/use-toast";
import {
  defaultSettingsForMode,
  fileToImageData,
  optimizeSvg,
  svgToPdfBlob,
  svgToPngBlob,
  traceImageData,
  type TraceMode,
  type TraceResult,
  type TraceSettings,
} from "@/lib/workspace/vector-studio";
import { formatBytes } from "@/lib/workspace/filesystem";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<TraceMode, string> = {
  logo: "Logo",
  icon: "Icon",
  illustration: "Illustration",
  photo: "Photo",
  lineart: "Line art",
};

interface SourceImage {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
  format: string;
}

export function VectorStudioView() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [settings, setSettings] = useState<TraceSettings>(defaultSettingsForMode("logo"));
  const [result, setResult] = useState<TraceResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [showOriginal, setShowOriginal] = useState(true);
  const [showVector, setShowVector] = useState(true);
  const [exporting, setExporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Load source image ─────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/") && !file.type.match(/bmp|webp|gif/i)) {
      toast({
        title: "Unsupported file",
        description: "Please upload a PNG, JPG, WEBP, BMP, or GIF.",
        variant: "destructive",
      });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum 8 MB. Larger images slow the tracer significantly.",
        variant: "destructive",
      });
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Could not read file."));
        reader.readAsDataURL(file);
      });
      // Probe dimensions.
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("Could not decode image."));
        img.src = dataUrl;
      });
      setSource({
        file,
        dataUrl,
        width: dims.w,
        height: dims.h,
        size: file.size,
        format: file.type || "unknown",
      });
      setResult(null);
    } catch (err) {
      toast({
        title: "Could not load image",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  }, []);

  const onFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void handleFile(f);
      // Reset the input so the same file can be re-selected.
      e.target.value = "";
    },
    [handleFile],
  );

  // ── Drag & drop ────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  // ── Run the tracer ────────────────────────────────────────────────────
  const handleTrace = useCallback(async () => {
    if (!source || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const imgd = await fileToImageData(source.file);
      const r = await traceImageData(imgd, settings);
      setResult(r);
      toast({
        title: "Tracing complete",
        description: `${r.pathCount} paths · ${r.detectedColors.length} colors · ${r.traceTimeMs} ms`,
      });
    } catch (err) {
      toast({
        title: "Tracing failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [source, settings, busy]);

  // ── Mode change → reset to that mode's defaults ──────────────────────
  const handleModeChange = useCallback((mode: TraceMode) => {
    setSettings(defaultSettingsForMode(mode));
  }, []);

  // ── Update a single setting ──────────────────────────────────────────
  const updateSetting = useCallback(
    <K extends keyof TraceSettings>(key: K, value: TraceSettings[K]) => {
      setSettings((s) => ({ ...s, [key]: value }));
    },
    [],
  );

  // ── Copy SVG ─────────────────────────────────────────────────────────
  const handleCopySvg = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.svg);
      toast({ title: "SVG copied to clipboard" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard API unavailable — copy manually from the code viewer.",
        variant: "destructive",
      });
    }
  }, [result]);

  // ── Export SVG ────────────────────────────────────────────────────────
  const handleDownloadSvg = useCallback(() => {
    if (!result || !source) return;
    const optimized = optimizeSvg(result.svg);
    const blob = new Blob([optimized], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = source.file.name.replace(/\.[^.]+$/, "") + ".svg";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "SVG downloaded" });
  }, [result, source]);

  // ── Export PNG ────────────────────────────────────────────────────────
  const handleDownloadPng = useCallback(async () => {
    if (!result || !source) return;
    setExporting(true);
    try {
      const blob = await svgToPngBlob(result.svg, source.width, source.height, 2);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = source.file.name.replace(/\.[^.]+$/, "") + "-vector.png";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PNG downloaded" });
    } catch (err) {
      toast({
        title: "PNG export failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [result, source]);

  // ── Export PDF (rasterized at 3× scale — see vector-studio.ts comment) ──
  const handleDownloadPdf = useCallback(async () => {
    if (!result || !source) return;
    setExporting(true);
    try {
      const blob = await svgToPdfBlob(result.svg, source.width, source.height);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = source.file.name.replace(/\.[^.]+$/, "") + "-vector.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: "PDF downloaded",
        description: "Rasterized at 3× scale (high-resolution PNG embedded in PDF).",
      });
    } catch (err) {
      toast({
        title: "PDF export failed",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }, [result, source]);

  return (
    <div className="flex h-full flex-col bg-canvas text-fg">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-line-muted px-3">
        <div className="flex items-center gap-2 text-sm">
          <Spline className="h-4 w-4 text-accent" />
          <span className="font-medium">Vector Studio</span>
          {source ? (
            <span className="hidden text-fg-faint md:inline">
              · {source.file.name}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.bmp,.gif,image/*"
            onChange={onFileInput}
            className="hidden"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload image</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-7"
            disabled={!source || busy}
            onClick={handleTrace}
          >
            {busy ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            Trace
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Left: Controls panel */}
        <aside className="w-full shrink-0 overflow-y-auto border-b border-line-muted bg-surface-2/40 md:w-64 md:border-b-0 md:border-r">
          <ControlsPanel
            source={source}
            settings={settings}
            onModeChange={handleModeChange}
            onUpdate={updateSetting}
            disabled={busy}
          />
        </aside>

        {/* Center: Canvas / preview area */}
        <main
          ref={dropZoneRef}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-zinc-100 dark:bg-zinc-900",
            dragOver && "ring-2 ring-accent ring-inset",
          )}
        >
          {!source ? (
            <DropZone onClick={() => fileInputRef.current?.click()} />
          ) : (
            <PreviewArea
              source={source}
              result={result}
              busy={busy}
              zoom={zoom}
              setZoom={setZoom}
              showOriginal={showOriginal}
              showVector={showVector}
              onToggleOriginal={() => setShowOriginal((v) => !v)}
              onToggleVector={() => setShowVector((v) => !v)}
            />
          )}
        </main>
      </div>

      {/* Bottom: Inspector + Export bar */}
      <InspectorBar
        source={source}
        result={result}
        onCopySvg={handleCopySvg}
        onDownloadSvg={handleDownloadSvg}
        onDownloadPng={handleDownloadPng}
        onDownloadPdf={handleDownloadPdf}
        exporting={exporting}
      />
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

function ControlsPanel({
  source,
  settings,
  onModeChange,
  onUpdate,
  disabled,
}: {
  source: SourceImage | null;
  settings: TraceSettings;
  onModeChange: (m: TraceMode) => void;
  onUpdate: <K extends keyof TraceSettings>(key: K, value: TraceSettings[K]) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-4 p-3">
      <ControlGroup label="Mode">
        <Select
          value={settings.mode}
          onValueChange={(v) => onModeChange(v as TraceMode)}
          disabled={disabled}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(MODE_LABELS) as TraceMode[]).map((m) => (
              <SelectItem key={m} value={m} className="text-xs">
                {MODE_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1 text-[10px] text-fg-faint">
          {settings.mode === "logo" && "Few flat colors, sharp edges."}
          {settings.mode === "icon" && "Minimal colors, compact paths."}
          {settings.mode === "illustration" && "Balanced colors + smoothing."}
          {settings.mode === "photo" && "Many colors, fine detail preserved."}
          {settings.mode === "lineart" && "2 colors (B&W), heavy smoothing."}
        </p>
      </ControlGroup>

      <ControlGroup label={`Colors — ${settings.numberOfColors}`}>
        <input
          type="range"
          min={2}
          max={64}
          value={settings.numberOfColors}
          onChange={(e) => onUpdate("numberOfColors", Number(e.target.value))}
          disabled={disabled || settings.mode === "lineart"}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
        {settings.mode === "lineart" ? (
          <p className="mt-1 text-[10px] text-fg-faint">Fixed at 2 in line-art mode.</p>
        ) : null}
      </ControlGroup>

      <ControlGroup label={`Smoothing — ${settings.smoothing}`}>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.smoothing}
          onChange={(e) => onUpdate("smoothing", Number(e.target.value))}
          disabled={disabled}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
        <p className="mt-1 text-[10px] text-fg-faint">
          Higher = smoother curves.
        </p>
      </ControlGroup>

      <ControlGroup label={`Detail — ${settings.detail}`}>
        <input
          type="range"
          min={0}
          max={100}
          value={settings.detail}
          onChange={(e) => onUpdate("detail", Number(e.target.value))}
          disabled={disabled}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
        <p className="mt-1 text-[10px] text-fg-faint">
          Higher = preserve more edges.
        </p>
      </ControlGroup>

      <ControlGroup label={`Min path size — ${settings.minPathSize}px`}>
        <input
          type="range"
          min={0}
          max={32}
          value={settings.minPathSize}
          onChange={(e) => onUpdate("minPathSize", Number(e.target.value))}
          disabled={disabled}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
        <p className="mt-1 text-[10px] text-fg-faint">Drop paths smaller than this (noise filter).</p>
      </ControlGroup>

      <ControlGroup label={`Pre-blur — ${settings.blurRadius}px`}>
        <input
          type="range"
          min={0}
          max={5}
          value={settings.blurRadius}
          onChange={(e) => onUpdate("blurRadius", Number(e.target.value))}
          disabled={disabled}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
        <p className="mt-1 text-[10px] text-fg-faint">Helps noisy JPEGs.</p>
      </ControlGroup>

      <ControlGroup label={`Output scale — ${settings.scale}×`}>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.5}
          value={settings.scale}
          onChange={(e) => onUpdate("scale", Number(e.target.value))}
          disabled={disabled}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-line accent-accent"
        />
      </ControlGroup>

      {source ? (
        <div className="border-t border-line-muted pt-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-fg-faint">
            Source
          </p>
          <p className="truncate text-[11px] text-fg">{source.file.name}</p>
          <p className="mt-0.5 font-mono text-[10px] text-fg-faint">
            {source.width}×{source.height} · {formatBytes(source.size)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ControlGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-fg-muted">{label}</Label>
      {children}
    </div>
  );
}

function DropZone({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="themed focus-ring flex flex-col items-center gap-3 rounded-md border border-line bg-surface px-12 py-10 text-center transition-colors hover:bg-hover"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface-2 text-accent">
        <Plus className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium text-fg">Upload an image</p>
        <p className="mt-1 text-xs text-fg-faint">
          PNG, JPG, WEBP, BMP, GIF · max 8 MB
        </p>
      </div>
    </button>
  );
}

function PreviewArea({
  source,
  result,
  busy,
  zoom,
  setZoom,
  showOriginal,
  showVector,
  onToggleOriginal,
  onToggleVector,
}: {
  source: SourceImage;
  result: TraceResult | null;
  busy: boolean;
  zoom: number;
  setZoom: (z: number) => void;
  showOriginal: boolean;
  showVector: boolean;
  onToggleOriginal: () => void;
  onToggleVector: () => void;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      {/* Sub-toolbar */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line-muted bg-surface px-2">
        <div className="flex items-center gap-1">
          <ToggleButton active={showOriginal} onClick={onToggleOriginal} icon={ImageIcon} label="Original" />
          <ToggleButton active={showVector} onClick={onToggleVector} icon={Spline} label="Vector" />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(Math.max(0.25, zoom - 0.1))}>
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <span className="w-12 text-center font-mono text-[10px] text-fg-muted">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setZoom(Math.min(3, zoom + 0.1))}>
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        className="checkerboard flex min-h-0 flex-1 items-center justify-center overflow-auto p-6"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #c8c8c8 25%, transparent 25%), linear-gradient(-45deg, #c8c8c8 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #c8c8c8 75%), linear-gradient(-45deg, transparent 75%, #c8c8c8 75%)",
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0",
        }}
      >
        {busy ? (
          <div className="flex flex-col items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            Tracing…
          </div>
        ) : (
          <div
            className="flex gap-1"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
          >
            {showOriginal && (
              <img
                src={source.dataUrl}
                alt={source.file.name}
                className="max-h-[600px] max-w-[600px] object-contain"
                draggable={false}
              />
            )}
            {showVector && result ? (
              <div
                className="max-h-[600px] max-w-[600px] overflow-hidden bg-white"
                // The SVG string is rendered as inline HTML inside a div
                // — React doesn't parse SVG strings as JSX, so we use
                // dangerouslySetInnerHTML with the traced SVG.
                dangerouslySetInnerHTML={{ __html: result.svg }}
              />
            ) : null}
            {showVector && !result ? (
              <div className="flex max-h-[600px] max-w-[600px] items-center justify-center bg-white p-12 text-sm text-zinc-400">
                Click Trace to generate
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ImageIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function InspectorBar({
  source,
  result,
  onCopySvg,
  onDownloadSvg,
  onDownloadPng,
  onDownloadPdf,
  exporting,
}: {
  source: SourceImage | null;
  result: TraceResult | null;
  onCopySvg: () => void;
  onDownloadSvg: () => void;
  onDownloadPng: () => void;
  onDownloadPdf: () => void;
  exporting: boolean;
}) {
  const [tab, setTab] = useState<"info" | "code">("info");
  return (
    <div className="shrink-0 border-t border-line-muted bg-surface-2/40">
      <Tabs value={tab} onValueChange={(v) => setTab(v as "info" | "code")}>
        <div className="flex items-center justify-between border-b border-line-muted px-2">
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger value="info" className="h-8 px-3 text-[11px]">
              Inspector
            </TabsTrigger>
            <TabsTrigger value="code" className="h-8 px-3 text-[11px]" disabled={!result}>
              SVG code
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 pr-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              disabled={!result || exporting}
              onClick={onCopySvg}
            >
              <Copy className="mr-1 h-3 w-3" /> Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              disabled={!result || exporting}
              onClick={onDownloadSvg}
            >
              <Download className="mr-1 h-3 w-3" /> SVG
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              disabled={!result || exporting}
              onClick={onDownloadPng}
            >
              <Download className="mr-1 h-3 w-3" /> PNG
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              disabled={!result || exporting}
              onClick={onDownloadPdf}
              title="Vector-based PDF (scalable)"
            >
              <Download className="mr-1 h-3 w-3" /> PDF
            </Button>
          </div>
        </div>
        <TabsContent value="info" className="m-0 p-3">
          <InspectorGrid source={source} result={result} />
        </TabsContent>
        <TabsContent value="code" className="m-0">
          <Textarea
            readOnly
            value={result?.svg ?? ""}
            className="h-32 w-full resize-none rounded-none border-0 bg-inset font-mono text-[10px]"
            placeholder="No SVG generated yet."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function InspectorGrid({
  source,
  result,
}: {
  source: SourceImage | null;
  result: TraceResult | null;
}) {
  if (!source) {
    return (
      <p className="text-[11px] text-fg-faint">No image loaded.</p>
    );
  }
  const rows: { label: string; value: string }[] = [
    { label: "Width", value: `${source.width}px` },
    { label: "Height", value: `${source.height}px` },
    { label: "Source format", value: source.format || "image" },
    { label: "Source size", value: formatBytes(source.size) },
  ];
  if (result) {
    rows.push(
      { label: "SVG size", value: formatBytes(result.svgSize) },
      { label: "Paths", value: String(result.pathCount) },
      { label: "Detected colors", value: String(result.detectedColors.length) },
      { label: "Trace time", value: `${result.traceTimeMs} ms` },
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4 lg:grid-cols-5">
      {rows.map((r) => (
        <div key={r.label}>
          <p className="text-[10px] uppercase tracking-wide text-fg-faint">{r.label}</p>
          <p className="font-mono text-[11px] text-fg">{r.value}</p>
        </div>
      ))}
      {result && result.detectedColors.length > 0 ? (
        <div className="col-span-2 sm:col-span-4 lg:col-span-5">
          <p className="text-[10px] uppercase tracking-wide text-fg-faint">Palette</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {result.detectedColors.slice(0, 16).map((c, i) => (
              <span
                key={i}
                className="h-4 w-4 rounded-sm border border-line"
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
            {result.detectedColors.length > 16 ? (
              <span className="ml-1 text-[10px] text-fg-faint">
                +{result.detectedColors.length - 16} more
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// Suppress unused-import warning when X isn't used directly.


"use client";

import { useState, useEffect } from "react";
import { Compass, ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, CheckCircle2 } from "lucide-react";
import { CHESS_LESSONS, type ChessLesson } from "@/lib/chess-data";
import { PageShell } from "@/components/ui/PageShell";
import { Button } from "@/components/ui-devspace/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "lucian-chess-progress";

function loadProgress(): Record<string, { completed: boolean }> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveProgress(p: Record<string, { completed: boolean }>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

const TABS = [
  { id: "all", label: "All" },
  { id: "opening", label: "Openings" },
  { id: "tactic", label: "Tactics" },
  { id: "strategy", label: "Strategy" },
  { id: "endgame", label: "Endgames" },
  { id: "history", label: "Historical" },
];

export default function ChessAcademyPage() {
  const [tab, setTab] = useState("all");
  const [selected, setSelected] = useState<ChessLesson | null>(null);
  const [progress, setProgress] = useState<Record<string, { completed: boolean }>>({});

  useEffect(() => { let c = false; Promise.resolve().then(() => { if (!c) setProgress(loadProgress()); }); return () => { c = true; }; }, []);

  const lessons = tab === "all" ? CHESS_LESSONS : CHESS_LESSONS.filter(l => l.type === tab);
  const completedCount = Object.values(progress).filter(p => p.completed).length;

  if (selected) {
    return <LessonDetail lesson={selected} isCompleted={progress[selected.id]?.completed ?? false} onBack={() => setSelected(null)} onComplete={() => {
      const next = { ...progress, [selected.id]: { completed: true } };
      setProgress(next); saveProgress(next);
    }} />;
  }

  return (
    <PageShell width="wide">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-accent" />
          <h1 className="text-base font-semibold">Chess Academy</h1>
        </div>
        <span className="text-[11px] text-fg-faint">{completedCount} / {CHESS_LESSONS.length} completed</span>
      </div>
      <div className="mb-3 flex gap-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("rounded px-2 py-0.5 text-[11px] font-medium transition-colors", tab === t.id ? "bg-accent text-accent-fg" : "text-fg-muted hover:bg-hover")}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map(lesson => {
          const isCompleted = progress[lesson.id]?.completed;
          return (
            <button key={lesson.id} onClick={() => setSelected(lesson)} className="themed focus-ring rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-fg">{lesson.title}</p>
                  <p className="mt-0.5 text-[10px] text-fg-faint capitalize">{lesson.type} · {lesson.difficulty}</p>
                </div>
                {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />}
              </div>
              <p className="mt-1.5 line-clamp-2 text-[11px] text-fg-muted">{lesson.description}</p>
            </button>
          );
        })}
      </div>
    </PageShell>
  );
}

function LessonDetail({ lesson, isCompleted, onBack, onComplete }: {
  lesson: ChessLesson; isCompleted: boolean; onBack: () => void; onComplete: () => void;
}) {
  const [moveIdx, setMoveIdx] = useState(0);
  const moves = lesson.moves || [];

  // Render FEN board
  const fen = moves.length > 0 ? applyMoves(lesson.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w", moves, moveIdx) : lesson.fen;

  return (
    <div className="themed h-full overflow-y-auto bg-canvas px-6 py-4 text-fg">
      <button onClick={onBack} className="focus-ring themed mb-3 flex items-center gap-1 text-xs text-fg-muted hover:text-fg">
        <ArrowLeft className="h-3 w-3" /> Back to Lessons
      </button>
      <h1 className="text-lg font-semibold">{lesson.title}</h1>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-faint">
        <span className="rounded bg-surface-2 px-1 py-0.5 capitalize">{lesson.type}</span>
        <span className="capitalize">{lesson.difficulty}</span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{lesson.description}</p>
      {fen && (
        <div className="mt-4">
          <div className="inline-block rounded-md border border-line overflow-hidden">
            <FenBoard fen={fen} />
          </div>
          {moves.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setMoveIdx(Math.max(0, moveIdx - 1))} disabled={moveIdx === 0}>
                <ChevronLeft className="h-3 w-3" />
              </Button>
              <span className="font-mono text-[11px] text-fg-muted">Move {moveIdx} / {moves.length}</span>
              <Button size="sm" variant="outline" onClick={() => setMoveIdx(Math.min(moves.length, moveIdx + 1))} disabled={moveIdx === moves.length}>
                <ChevronRight className="h-3 w-3" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMoveIdx(0)}>
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      )}
      {lesson.concept && (
        <div className="mt-4 rounded-md border border-accent/20 bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-accent">Key Concept</p>
          <p className="mt-1 text-[11px] text-fg-muted">{lesson.concept}</p>
        </div>
      )}
      <div className="mt-4 pt-3 border-t border-line-muted">
        <Button size="sm" variant={isCompleted ? "default" : "outline"} onClick={onComplete} disabled={isCompleted}>
          {isCompleted ? "✓ Completed" : "Mark as complete"}
        </Button>
      </div>
    </div>
  );
}

// Simple FEN → board renderer using Unicode chess glyphs.
function FenBoard({ fen }: { fen: string }) {
  const rows = fen.split(" ")[0].split("/");
  const glyphs: Record<string, string> = {
    r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟",
    R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔", P: "♙",
  };
  return (
    <div className="grid grid-rows-8">
      {rows.map((row, rIdx) => {
        const cells: React.ReactNode[] = [];
        let col = 0;
        for (const ch of row) {
          if (/\d/.test(ch)) {
            const n = parseInt(ch);
            for (let i = 0; i < n; i++) {
              cells.push(<span key={`${rIdx}-${col}`} className="flex h-7 w-7 items-center justify-center text-base" style={{ background: (rIdx + col) % 2 === 0 ? "#f0d9b5" : "#b58863" }} />);
              col++;
            }
          } else {
            cells.push(<span key={`${rIdx}-${col}`} className="flex h-7 w-7 items-center justify-center text-base" style={{ background: (rIdx + col) % 2 === 0 ? "#f0d9b5" : "#b58863" }}>{glyphs[ch] || ""}</span>);
            col++;
          }
        }
        return <div key={rIdx} className="flex">{cells}</div>;
      })}
    </div>
  );
}

// Apply SAN moves to FEN (simplified — just replays positions for display).
function applyMoves(initialFen: string, _moves: string[], _idx: number): string {
  // For now, return the initial FEN. A full SAN→FEN engine is a future upgrade.
  // The lesson data includes FEN positions for display.
  return initialFen;
}

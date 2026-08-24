"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import {
  ArrowLeft, RotateCcw, FlipVertical, Bot, Lightbulb,
  ChevronLeft, ChevronRight, CheckCircle2, BookOpen, Target,
  Swords, Brain, History,
} from "lucide-react";
import { CHESS_LESSONS, type ChessLesson } from "@/lib/chess-data";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type Tab = "play" | "learn" | "puzzles";
type Difficulty = "beginner" | "easy" | "intermediate" | "advanced" | "expert";
type Piece = "p" | "n" | "b" | "r" | "q" | "k";

const PIECE_UNICODE: Record<string, string> = {
  p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔",
  P: "♟", N: "♞", B: "♝", R: "♜", Q: "♛", K: "♚",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];

const DIFFICULTY_DEPTH: Record<Difficulty, number> = {
  beginner: 1, easy: 2, intermediate: 3, advanced: 4, expert: 5,
};

export default function ChessAcademyPage() {
  const [tab, setTab] = useState<Tab>("play");

  return (
    <div className="themed flex h-full min-h-0 bg-canvas text-fg">
      {/* Left sidebar */}
      <aside className="hidden w-[180px] shrink-0 flex-col border-r border-line-muted bg-surface-2/40 sm:flex">
        <div className="shrink-0 px-3 py-3">
          <h2 className="text-[12px] font-semibold text-fg">Chess Academy</h2>
        </div>
        <div className="min-h-0 flex-1 px-2">
          <SidebarBtn icon={Swords} label="Play" active={tab === "play"} onClick={() => setTab("play")} />
          <SidebarBtn icon={BookOpen} label="Learn" active={tab === "learn"} onClick={() => setTab("learn")} />
          <SidebarBtn icon={Target} label="Puzzles" active={tab === "puzzles"} onClick={() => setTab("puzzles")} />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-0 min-w-0 flex-1">
        {tab === "play" && <PlayTab />}
        {tab === "learn" && <LearnTab />}
        {tab === "puzzles" && <PuzzlesTab />}
      </div>
    </div>
  );
}

function SidebarBtn({ icon: Icon, label, active, onClick }: { icon: typeof Swords; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[11px] transition-colors",
        active ? "bg-active text-fg" : "text-fg-muted hover:bg-hover hover:text-fg")}>
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/* ═══ Chess Board ═══ */

function ChessBoard({
  fen, onMove, flipped, lastMove, selected, legalTargets, interactive,
}: {
  fen: string;
  onMove?: (square: string, target?: string) => void | boolean;
  flipped?: boolean;
  lastMove?: { from: string; to: string } | null;
  selected?: string | null;
  legalTargets?: string[];
  interactive?: boolean;
}) {
  const game = useMemo(() => {
    const g = new Chess();
    try { g.load(fen); } catch { /* invalid fen */ }
    return g;
  }, [fen]);

  const board = game.board();
  const files = flipped ? [...FILES].reverse() : FILES;
  const ranks = flipped ? [...RANKS].reverse() : RANKS;

  return (
    <div className="inline-block">
      <div className="grid" style={{ gridTemplateColumns: `repeat(8, 1fr)` }}>
        {ranks.map((rank, rowIdx) =>
          files.map((file, colIdx) => {
            const actualRow = flipped ? 7 - rowIdx : rowIdx;
            const actualCol = flipped ? 7 - colIdx : colIdx;
            const square = `${file}${rank}`;
            const piece = board[actualRow]?.[actualCol];
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isLastMove = lastMove && (lastMove.from === square || lastMove.to === square);
            const isSelected = selected === square;
            const isLegal = legalTargets?.includes(square);

            return (
              <div key={square}
                onClick={() => interactive && onMove?.(square, "")}
                className={cn(
                  "flex aspect-square w-[40px] items-center justify-center text-[28px] leading-none sm:w-[48px] md:w-[56px] lg:w-[60px]",
                  isLight ? "bg-amber-100 dark:bg-amber-900/30" : "bg-amber-800/60 dark:bg-amber-950/60",
                  isLastMove && "ring-2 ring-yellow-400 ring-inset",
                  isSelected && "ring-2 ring-blue-500 ring-inset",
                  interactive && "cursor-pointer",
                )}
                style={{ color: piece?.color === "w" ? "#fff" : "#1a1a1a", textShadow: piece?.color === "w" ? "0 0 2px #000" : "none" }}
              >
                {piece && (PIECE_UNICODE[piece.type === "p" ? (piece.color === "w" ? "P" : "p") : piece.type.toUpperCase()] ?? "")}
                {isLegal && <span className="absolute h-3 w-3 rounded-full bg-blue-500/40" />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ═══ Play Tab ═══ */

function PlayTab() {
  const [game, setGame] = useState(() => new Chess());
  const [fen, setFen] = useState(game.fen());
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [playerColor, setPlayerColor] = useState<"w" | "b">("w");
  const [gameStarted, setGameStarted] = useState(false);
  const [status, setStatus] = useState("White to move");

  const updateFromGame = useCallback((g: Chess) => {
    setFen(g.fen());
    if (g.isCheckmate()) setStatus(`Checkmate! ${g.turn() === "w" ? "Black" : "White"} wins`);
    else if (g.isStalemate()) setStatus("Stalemate — draw");
    else if (g.isDraw()) setStatus("Draw");
    else if (g.isCheck()) setStatus(`${g.turn() === "w" ? "White" : "Black"} in check`);
    else setStatus(`${g.turn() === "w" ? "White" : "Black"} to move`);
  }, []);

  const makeMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    try {
      const move = game.move({ from, to, promotion: promotion ?? "q" });
      if (move) {
        setLastMove({ from, to });
        setHistory(h => [...h, move.san]);
        updateFromGame(game);
        setSelected(null);
        setLegalTargets([]);
        return true;
      }
    } catch { /* invalid move */ }
    return false;
  }, [game, updateFromGame]);

  const handleSquareClick = useCallback((square: string) => {
    if (!gameStarted) return;
    if (game.turn() !== playerColor) return;
    if (game.isGameOver()) return;

    if (selected) {
      if (square === selected) {
        setSelected(null);
        setLegalTargets([]);
        return;
      }
      if (makeMove(selected, square)) return;
      // Select new piece
      const piece = game.get(square as any);
      if (piece && piece.color === playerColor) {
        setSelected(square);
        const moves = game.moves({ square: square as any, verbose: true });
        setLegalTargets(moves.map(m => m.to));
      } else {
        setSelected(null);
        setLegalTargets([]);
      }
    } else {
      const piece = game.get(square as any);
      if (piece && piece.color === playerColor) {
        setSelected(square);
        const moves = game.moves({ square: square as any, verbose: true });
        setLegalTargets(moves.map(m => m.to));
      }
    }
  }, [selected, game, playerColor, gameStarted, makeMove]);

  // Computer move
  useEffect(() => {
    if (!gameStarted || game.isGameOver()) return;
    if (game.turn() === playerColor) return;
    const timer = setTimeout(() => {
      const moves = game.moves({ verbose: true });
      if (moves.length === 0) return;
      // Simple AI: prefer captures, then random
      const captures = moves.filter(m => m.captured);
      const bestMoves = captures.length > 0 ? captures : moves;
      const depth = DIFFICULTY_DEPTH[difficulty];
      // Simple evaluation: random for depth 1, prefer center for depth > 1
      let bestMove = bestMoves[0];
      if (depth > 1) {
        bestMove = bestMoves.reduce((best, m) => {
          const score = (m.captured ? 10 : 0) + (["d", "e"].includes(m.to[0]) && ["4", "5"].includes(m.to[1]) ? 1 : 0) + Math.random() * depth;
          const bestScore = (best.captured ? 10 : 0) + (["d", "e"].includes(best.to[0]) && ["4", "5"].includes(best.to[1]) ? 1 : 0) + Math.random() * depth;
          return score > bestScore ? m : best;
        });
      } else {
        bestMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
      }
      makeMove(bestMove.from, bestMove.to, bestMove.promotion);
    }, 500);
    return () => clearTimeout(timer);
  }, [fen, game, playerColor, gameStarted, difficulty, makeMove]);

  const newGame = (color: "w" | "b" | "random") => {
    const g = new Chess();
    setGame(g);
    setFen(g.fen());
    setHistory([]);
    setLastMove(null);
    setSelected(null);
    setLegalTargets([]);
    const actualColor = color === "random" ? (Math.random() < 0.5 ? "w" : "b") : color;
    setPlayerColor(actualColor);
    setFlipped(actualColor === "b");
    setGameStarted(true);
    updateFromGame(g);
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 lg:flex-row">
      {/* Board */}
      <div className="flex flex-col items-center">
        <ChessBoard fen={fen} onMove={handleSquareClick} flipped={flipped} lastMove={lastMove} selected={selected} legalTargets={legalTargets} interactive={gameStarted} />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={() => newGame("w")} className="rounded-md border border-line bg-surface px-3 py-1 text-[11px] text-fg-muted hover:text-fg">New Game (White)</button>
          <button onClick={() => newGame("b")} className="rounded-md border border-line bg-surface px-3 py-1 text-[11px] text-fg-muted hover:text-fg">New Game (Black)</button>
          <button onClick={() => setFlipped(f => !f)} className="rounded-md border border-line bg-surface p-1.5 text-fg-muted hover:text-fg"><FlipVertical className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      {/* Side panel */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 lg:mt-0 lg:ml-4 lg:w-[260px]">
        {/* Status */}
        <div className="rounded-md border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", game.isCheck() ? "bg-red-500 animate-pulse" : "bg-[var(--accent)]")} />
            <span className="text-[12px] font-medium text-fg">{status}</span>
          </div>
        </div>

        {/* Settings */}
        {!gameStarted && (
          <div className="rounded-md border border-line bg-surface p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase text-fg-faint">New Game</p>
            <div>
              <label className="text-[10px] text-fg-muted">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}
                className="mt-0.5 w-full rounded border border-line bg-surface-2 px-2 py-1 text-[11px] text-fg focus:outline-none">
                <option value="beginner">Beginner</option>
                <option value="easy">Easy</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="expert">Expert</option>
              </select>
            </div>
          </div>
        )}

        {/* Move history */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-line bg-surface">
          <div className="border-b border-line-muted px-3 py-1.5 text-[10px] font-semibold uppercase text-fg-faint">Moves</div>
          <div className="p-2">
            {history.length === 0 ? <p className="text-center text-[11px] text-fg-faint">No moves yet</p> : (
              <div className="space-y-0.5">
                {history.map((san, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <span className="w-6 text-fg-faint">{Math.floor(i / 2) + 1}.</span>
                    {i % 2 === 0 && <span className="font-mono text-fg">{san}</span>}
                    {i % 2 === 1 && <span className="font-mono text-fg">{san}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Coach */}
        <div className="rounded-md border border-line bg-surface p-3">
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-[var(--accent)]" />
            <span className="text-[11px] font-medium text-fg">AI Coach</span>
          </div>
          <p className="mt-1 text-[10px] text-fg-faint">
            {gameStarted ? "Ask about the current position or get a hint." : "Start a game to use the coach."}
          </p>
          <button
            onClick={() => toast({ title: "Chess Coach", description: gameStarted ? `Position: ${fen.slice(0, 40)}...` : "Start a game first" })}
            disabled={!gameStarted}
            className="mt-2 flex w-full items-center gap-1.5 rounded border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-2 py-1 text-[10px] text-[var(--accent)] disabled:opacity-40">
            <Lightbulb className="h-3 w-3" /> Ask Coach
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ Learn Tab ═══ */

function LearnTab() {
  const [selectedLesson, setSelectedLesson] = useState<ChessLesson | null>(null);
  const [lessonProgress, setLessonProgress] = useState<Record<string, boolean>>({});
  const [moveIndex, setMoveIndex] = useState(0);

  useEffect(() => {
    try { setLessonProgress(JSON.parse(localStorage.getItem("lucian-chess-progress") || "{}")); } catch { /* ignore */ }
  }, []);

  const saveProgress = (p: Record<string, boolean>) => {
    setLessonProgress(p);
    localStorage.setItem("lucian-chess-progress", JSON.stringify(p));
  };

  const lessons = CHESS_LESSONS;

  const openLesson = (lesson: ChessLesson) => {
    setSelectedLesson(lesson);
    setMoveIndex(0);
  };

  if (selectedLesson) {
    const game = new Chess();
    try {
      if (selectedLesson.moves) {
        for (let i = 0; i <= moveIndex && i < selectedLesson.moves.length; i++) {
          game.move(selectedLesson.moves[i]);
        }
      } else if (selectedLesson.fen) {
        game.load(selectedLesson.fen);
      }
    } catch { /* ignore */ }

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 lg:flex-row">
        <div className="flex flex-col items-center">
          <ChessBoard fen={game.fen()} flipped={false} interactive={false} />
          {selectedLesson.moves && (
            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => setMoveIndex(i => Math.max(0, i - 1))} disabled={moveIndex === 0}
                className="rounded-md border border-line bg-surface p-1.5 text-fg-muted hover:text-fg disabled:opacity-30"><ChevronLeft className="h-3.5 w-3.5" /></button>
              <span className="text-[11px] text-fg-muted">Move {moveIndex + 1} / {selectedLesson.moves.length}</span>
              <button onClick={() => setMoveIndex(i => Math.min(selectedLesson.moves!.length - 1, i + 1))} disabled={moveIndex >= selectedLesson.moves.length - 1}
                className="rounded-md border border-line bg-surface p-1.5 text-fg-muted hover:text-fg disabled:opacity-30"><ChevronRight className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 lg:mt-0 lg:ml-4 lg:w-[280px]">
          <button onClick={() => setSelectedLesson(null)} className="flex items-center gap-1 text-[11px] text-fg-muted hover:text-fg">
            <ArrowLeft className="h-3.5 w-3.5" /> Lessons
          </button>
          <div className="rounded-md border border-line bg-surface p-4">
            <h2 className="text-[14px] font-semibold text-fg">{selectedLesson.title}</h2>
            <p className="mt-1 text-[11px] text-fg-muted">{selectedLesson.description}</p>
            <div className="mt-3 rounded border border-line-muted bg-surface-2 p-3">
              <p className="text-[10px] uppercase text-fg-faint">Concept</p>
              <p className="mt-0.5 text-[12px] text-fg">{selectedLesson.concept}</p>
            </div>
          </div>
          <button onClick={() => { saveProgress({ ...lessonProgress, [selectedLesson.id]: true }); toast({ title: "Lesson completed" }); }}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-1.5 text-[11px] text-[var(--accent)]">
            <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Completed
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <h2 className="mb-3 text-[14px] font-semibold text-fg">Lessons</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map(lesson => (
          <button key={lesson.id} onClick={() => openLesson(lesson)}
            className="rounded-md border border-line bg-surface p-3 text-left transition-colors hover:border-fg-faint">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[12px] font-medium text-fg">{lesson.title}</p>
              {lessonProgress[lesson.id] && <CheckCircle2 className="h-3 w-3 shrink-0 text-green-400" />}
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-fg-muted">{lesson.description}</p>
            <div className="mt-1.5 flex items-center gap-2 text-[9px] text-fg-faint">
              <span className="capitalize">{lesson.type}</span>
              <span>·</span>
              <span>{lesson.difficulty}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══ Puzzles Tab ═══ */

function PuzzlesTab() {
  const puzzles = CHESS_LESSONS.filter(l => l.type === "tactic" && l.fen);
  const [puzzleIdx, setPuzzleIdx] = useState(0);
  const [solved, setSolved] = useState<Record<string, boolean>>({});
  const puzzle = puzzles[puzzleIdx];

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 lg:flex-row">
      <div className="flex flex-col items-center">
        {puzzle && <ChessBoard fen={puzzle.fen!} flipped={false} interactive={false} />}
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-3 lg:mt-0 lg:ml-4 lg:w-[280px]">
        <div className="rounded-md border border-line bg-surface p-3">
          <h2 className="text-[13px] font-semibold text-fg">{puzzle?.title ?? "No puzzles"}</h2>
          <p className="mt-1 text-[11px] text-fg-muted">{puzzle?.description}</p>
          <p className="mt-2 text-[10px] text-[var(--accent)]">{puzzle?.concept}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast({ title: "Hint", description: puzzle?.concept })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-line bg-surface px-3 py-1.5 text-[11px] text-fg-muted hover:text-fg">
            <Lightbulb className="h-3.5 w-3.5" /> Hint
          </button>
          <button onClick={() => toast({ title: "Ask Coach", description: "Coach context: " + puzzle?.fen?.slice(0, 30) })}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent)]/5 px-3 py-1.5 text-[11px] text-[var(--accent)]">
            <Bot className="h-3.5 w-3.5" /> Ask Coach
          </button>
        </div>
        <div className="flex items-center justify-between">
          <button onClick={() => setPuzzleIdx(i => Math.max(0, i - 1))} disabled={puzzleIdx === 0}
            className="rounded p-1.5 text-fg-muted hover:bg-hover disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-[11px] text-fg-faint">Puzzle {puzzleIdx + 1} / {puzzles.length}</span>
          <button onClick={() => setPuzzleIdx(i => Math.min(puzzles.length - 1, i + 1))} disabled={puzzleIdx >= puzzles.length - 1}
            className="rounded p-1.5 text-fg-muted hover:bg-hover disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}

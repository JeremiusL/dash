import { useEffect, useState } from "react";
import {
  bishopTargets,
  knightTargets,
  queenTargets,
  rookTargets,
  shuffledSquares,
} from "../../../lib/chessGeometry";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

const TYPES = ["N", "B", "R", "Q"] as const;
type Type = (typeof TYPES)[number];

const NAMES: Record<Type, string> = { N: "Knight", B: "Bishop", R: "Rook", Q: "Queen" };

function targetsFor(type: Type, square: string): string[] {
  if (type === "N") return knightTargets(square);
  if (type === "B") return bishopTargets(square);
  if (type === "R") return rookTargets(square);
  return queenTargets(square);
}

interface TrackedPiece {
  type: Type;
  start: string;
}

interface Move {
  pieceIndex: number;
  from: string;
  to: string;
}

function setupPieces(pieceCount: number): TrackedPiece[] {
  const squares = shuffledSquares(pieceCount);
  return squares.map((sq) => ({ type: TYPES[Math.floor(Math.random() * TYPES.length)], start: sq }));
}

function buildMoves(pieces: TrackedPiece[], moveCount: number): Move[] {
  const state = pieces.map((p) => p.start);
  const moves: Move[] = [];
  for (let i = 0; i < moveCount; i++) {
    const idx = Math.floor(Math.random() * pieces.length);
    const from = state[idx];
    const options = targetsFor(pieces[idx].type, from);
    const to = options[Math.floor(Math.random() * options.length)];
    state[idx] = to;
    moves.push({ pieceIndex: idx, from, to });
  }
  return moves;
}

function finalSquaresFor(pieces: TrackedPiece[], moves: Move[]): string[] {
  const state = pieces.map((p) => p.start);
  for (const m of moves) state[m.pieceIndex] = m.to;
  return state;
}

export function PieceTrackingDrill({ params, onFinish }: DrillProps) {
  const pieceCount = params.pieceCount ?? 1;
  const moveCount = params.moveCount ?? 4;
  const viewTimeSec = params.viewTimeSec ?? 4;

  const [pieces] = useState<TrackedPiece[]>(() => setupPieces(pieceCount));
  const [moves] = useState<Move[]>(() => buildMoves(pieces, moveCount));
  const finals = useState<string[]>(() => finalSquaresFor(pieces, moves))[0];

  const [phase, setPhase] = useState<"view" | "moves" | "answer">(viewTimeSec > 0 ? "view" : "moves");
  const [revealed, setRevealed] = useState(0);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [guess, setGuess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);

  useEffect(() => {
    if (phase !== "view") return;
    const id = setTimeout(() => setPhase("moves"), viewTimeSec * 1000);
    return () => clearTimeout(id);
  }, [phase, viewTimeSec]);

  const position: Record<string, string> = {};
  pieces.forEach((p) => (position[p.start] = p.type));

  if (phase === "view") {
    return (
      <div className="chess-drill">
        <p>Memorize the starting squares. Board hides in {viewTimeSec}s.</p>
        <MiniBoard position={position} />
      </div>
    );
  }

  if (phase === "moves") {
    function next() {
      if (revealed + 1 >= moves.length) {
        setPhase("answer");
      } else {
        setRevealed((r) => r + 1);
      }
    }
    return (
      <div className="chess-drill">
        <p className="muted">Starting squares: {pieces.map((p) => `${NAMES[p.type]} ${p.start}`).join(", ")}</p>
        <ol className="chess-tour-list">
          {moves.slice(0, revealed + 1).map((m, i) => (
            <li key={i}>{NAMES[pieces[m.pieceIndex].type]}: {m.from} → {m.to}</li>
          ))}
        </ol>
        <button className="pixel-btn" type="button" onClick={next}>
          {revealed + 1 >= moves.length ? "Done — answer" : "Next move"}
        </button>
      </div>
    );
  }

  const piece = pieces[answerIndex];
  const finalSquare = finals[answerIndex];

  function submitGuess(sq: string) {
    if (feedback) return;
    setGuess(sq);
    const right = sq === finalSquare;
    setFeedback(right ? "right" : "wrong");
    const nextCorrect = correctCount + (right ? 1 : 0);
    setCorrectCount(nextCorrect);
    setTimeout(() => {
      if (answerIndex + 1 >= pieces.length) {
        onFinish({ accuracyPct: Math.round((nextCorrect / pieces.length) * 100) });
      } else {
        setAnswerIndex((i) => i + 1);
        setGuess(null);
        setFeedback(null);
      }
    }, 900);
  }

  return (
    <div className="chess-drill">
      <p>
        Where did the <strong>{NAMES[piece.type]}</strong> (started {piece.start}) end up? ({answerIndex + 1} / {pieces.length})
      </p>
      <MiniBoard hidden selected={guess ? [guess] : []} highlight={feedback ? [finalSquare] : []} onSquareClick={submitGuess} />
      {feedback && (
        <p className={feedback === "right" ? "chess-feedback-right" : "chess-feedback-wrong"}>
          {feedback === "right" ? "Correct" : `It ended on ${finalSquare}`}
        </p>
      )}
    </div>
  );
}

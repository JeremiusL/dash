import { useState } from "react";
import { Chess, type Square } from "chess.js";
import { ALL_SQUARES } from "../../../lib/chessGeometry";
import type { DrillProps } from "../types";

const TYPE_NAMES: Record<string, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

function pieceLabel(piece: { type: string; color: string } | undefined | null): string {
  if (!piece) return "empty";
  return `${piece.color === "w" ? "White" : "Black"} ${TYPE_NAMES[piece.type]}`;
}

function playRandomGame(plyCount: number): { sanList: string[]; game: Chess } {
  const game = new Chess();
  const sanList: string[] = [];
  for (let i = 0; i < plyCount; i++) {
    const moves = game.moves();
    if (moves.length === 0) break;
    const move = moves[Math.floor(Math.random() * moves.length)];
    game.move(move);
    sanList.push(move);
  }
  return { sanList, game };
}

interface Question {
  square: string;
  correct: string;
  options: string[];
}

function buildQuestions(game: Chess, count: number): Question[] {
  const squares = [...ALL_SQUARES].sort(() => Math.random() - 0.5).slice(0, count);
  const occupied = ALL_SQUARES.map((sq) => pieceLabel(game.get(sq as Square))).filter((l) => l !== "empty");

  return squares.map((square) => {
    const correct = pieceLabel(game.get(square as Square));
    const distractorPool = ["empty", ...new Set(occupied)].filter((l) => l !== correct);
    const distractors = distractorPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    return { square, correct, options };
  });
}

export function NotationReplayDrill({ params, onFinish }: DrillProps) {
  const plyCount = params.plyCount ?? 6;
  const questionsCount = params.questionsCount ?? 3;

  const [{ sanList, game }] = useState(() => playRandomGame(plyCount));
  const [questions] = useState(() => buildQuestions(game, questionsCount));
  const [revealed, setRevealed] = useState(0);
  const [phase, setPhase] = useState<"moves" | "questions">("moves");
  const [qIndex, setQIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState<string | null>(null);

  if (phase === "moves") {
    function next() {
      if (revealed + 1 >= sanList.length) setPhase("questions");
      else setRevealed((r) => r + 1);
    }
    return (
      <div className="chess-drill">
        <p className="muted">No board — follow the moves in your head from the standard starting position.</p>
        <p className="chess-notation-line">
          {sanList.slice(0, revealed + 1).map((san, i) => (
            <span key={i}>
              {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}
              {san}{" "}
            </span>
          ))}
        </p>
        <button className="pixel-btn" type="button" onClick={next}>
          {revealed + 1 >= sanList.length ? "Done — answer questions" : "Next move"}
        </button>
      </div>
    );
  }

  const q = questions[qIndex];

  function answer(option: string) {
    if (answered) return;
    setAnswered(option);
    const right = option === q.correct;
    const nextCorrect = correctCount + (right ? 1 : 0);
    setCorrectCount(nextCorrect);
    setTimeout(() => {
      if (qIndex + 1 >= questions.length) {
        onFinish({ accuracyPct: Math.round((nextCorrect / questions.length) * 100) });
      } else {
        setQIndex((i) => i + 1);
        setAnswered(null);
      }
    }, 800);
  }

  return (
    <div className="chess-drill">
      <p>
        What's on <strong>{q.square}</strong> now? ({qIndex + 1} / {questions.length})
      </p>
      <div className="chess-mc-options">
        {q.options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`pixel-btn ${answered === opt ? (opt === q.correct ? "chess-feedback-right" : "chess-feedback-wrong") : ""}`}
            onClick={() => answer(opt)}
            disabled={Boolean(answered)}
          >
            {opt}
          </button>
        ))}
      </div>
      {answered && answered !== q.correct && <p className="chess-feedback-wrong">Correct answer: {q.correct}</p>}
    </div>
  );
}

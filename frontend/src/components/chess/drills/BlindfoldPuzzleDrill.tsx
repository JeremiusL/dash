import { useState } from "react";
import { MATE_IN_1_PUZZLES, MATE_IN_2_PUZZLES, type MatePuzzle } from "../../../data/chessCurriculum";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

function pickPuzzles(count: number, maxMateIn: number): MatePuzzle[] {
  const pool = maxMateIn >= 2 ? [...MATE_IN_1_PUZZLES, ...MATE_IN_2_PUZZLES] : MATE_IN_1_PUZZLES;
  const picks: MatePuzzle[] = [];
  for (let i = 0; i < count; i++) {
    picks.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  return picks;
}

export function BlindfoldPuzzleDrill({ params, onFinish }: DrillProps) {
  const count = params.count ?? 4;
  const maxMateIn = params.maxMateIn ?? 1;

  const [puzzles] = useState(() => pickPuzzles(count, maxMateIn));
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);

  const puzzle = puzzles[index];

  function pick(square: string) {
    if (feedback) return;
    if (!from) {
      setFrom(square);
      return;
    }
    if (!to) {
      setTo(square);
      const guess = `${from}${square}`;
      const right = guess === puzzle.solution;
      setFeedback(right ? "right" : "wrong");
      const nextCorrect = correctCount + (right ? 1 : 0);
      setCorrectCount(nextCorrect);
      setTimeout(() => {
        if (index + 1 >= puzzles.length) {
          onFinish({ accuracyPct: Math.round((nextCorrect / puzzles.length) * 100) });
        } else {
          setIndex((i) => i + 1);
          setFrom(null);
          setTo(null);
          setFeedback(null);
        }
      }, 1400);
    }
  }

  return (
    <div className="chess-drill">
      <div className="chess-drill-progress">
        {index + 1} / {puzzles.length} — mate in {puzzle.mateIn}
      </div>
      <p>{puzzle.description}</p>
      <p className="muted">
        No diagram — build the position in your head, then click the piece's square and the square it moves to.
      </p>
      <MiniBoard hidden selected={[from, to].filter((s): s is string => Boolean(s))} onSquareClick={pick} />
      {feedback && (
        <p className={feedback === "right" ? "chess-feedback-right" : "chess-feedback-wrong"}>
          {feedback === "right" ? "Correct — " : "Solution: "}
          {puzzle.solutionLabel}
        </p>
      )}
    </div>
  );
}

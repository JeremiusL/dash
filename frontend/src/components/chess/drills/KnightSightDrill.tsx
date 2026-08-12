import { useState } from "react";
import { knightTargets, randomSquare } from "../../../lib/chessGeometry";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

function pickTour(start: string, jumps: number): string[] {
  const path = [start];
  let current = start;
  for (let i = 0; i < jumps; i++) {
    const options = knightTargets(current);
    current = options[Math.floor(Math.random() * options.length)];
    path.push(current);
  }
  return path;
}

export function KnightSightDrill({ params, onFinish }: DrillProps) {
  const reps = params.reps ?? 15;
  const tourMode = Boolean(params.boardHidden);
  const jumps = params.jumps ?? 4;

  const [round, setRound] = useState(0);
  const [square, setSquare] = useState(() => randomSquare());
  const [totalAccuracy, setTotalAccuracy] = useState(0);

  // sight mode state
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  // tour mode state
  const [tour, setTour] = useState<string[]>(() => (tourMode ? pickTour(square, jumps) : []));
  const [revealed, setRevealed] = useState(1); // how many jumps of the tour have been shown as text
  const [answered, setAnswered] = useState(false);
  const [guess, setGuess] = useState<string | null>(null);

  function advance(repScore: number) {
    const nextTotal = totalAccuracy + repScore;
    setTotalAccuracy(nextTotal);
    setTimeout(() => {
      if (round + 1 >= reps) {
        onFinish({ accuracyPct: Math.round((nextTotal / reps) * 100) });
        return;
      }
      const nextSquare = randomSquare();
      setRound((r) => r + 1);
      setSquare(nextSquare);
      setSelected([]);
      setSubmitted(false);
      setTour(tourMode ? pickTour(nextSquare, jumps) : []);
      setRevealed(1);
      setAnswered(false);
      setGuess(null);
    }, 900);
  }

  if (tourMode) {
    const finalSquare = tour[tour.length - 1];

    function reveal() {
      setRevealed((r) => Math.min(r + 1, tour.length - 1));
    }

    function submitGuess(sq: string) {
      if (answered) return;
      setAnswered(true);
      setGuess(sq);
      advance(sq === finalSquare ? 1 : 0);
    }

    return (
      <div className="chess-drill">
        <div className="chess-drill-progress">{round + 1} / {reps}</div>
        <p>Knight starts on <strong>{square}</strong>. Track each jump, then click where it ends up.</p>
        <ol className="chess-tour-list">
          {tour.slice(1, revealed + 1).map((sq, i) => (
            <li key={i}>Jump {i + 1}: → {sq}</li>
          ))}
        </ol>
        {revealed < tour.length - 1 ? (
          <button className="pixel-btn" type="button" onClick={reveal}>Next jump</button>
        ) : (
          <>
            <p className="muted">Click the knight's final square.</p>
            <MiniBoard
              hidden
              selected={guess ? [guess] : []}
              highlight={answered ? [finalSquare] : []}
              onSquareClick={submitGuess}
            />
          </>
        )}
        {answered && (
          <p className={guess === finalSquare ? "chess-feedback-right" : "chess-feedback-wrong"}>
            {guess === finalSquare ? "Correct" : `It ended on ${finalSquare}`}
          </p>
        )}
      </div>
    );
  }

  const targets = knightTargets(square);

  function toggle(sq: string) {
    if (submitted || sq === square) return;
    setSelected((prev) => (prev.includes(sq) ? prev.filter((s) => s !== sq) : [...prev, sq]));
  }

  function submit() {
    if (submitted) return;
    const truePositives = selected.filter((s) => targets.includes(s)).length;
    const falsePositives = selected.length - truePositives;
    const repScore = Math.max(0, (truePositives - falsePositives) / Math.max(targets.length, 1));
    setSubmitted(true);
    advance(repScore);
  }

  return (
    <div className="chess-drill">
      <div className="chess-drill-progress">{round + 1} / {reps}</div>
      <p>Click every square the knight on <strong>{square}</strong> attacks.</p>
      <MiniBoard
        position={{ [square]: "N" }}
        selected={selected}
        highlight={submitted ? targets : []}
        onSquareClick={toggle}
      />
      <button className="pixel-btn" type="button" onClick={submit} disabled={submitted}>
        Submit
      </button>
    </div>
  );
}

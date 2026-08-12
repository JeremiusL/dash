import { useEffect, useMemo, useState } from "react";
import { randomSquare, squareColor } from "../../../lib/chessGeometry";
import type { DrillProps } from "../types";

export function SquareColorDrill({ params, onFinish }: DrillProps) {
  const reps = params.reps ?? 30;
  const timeLimitMs = params.timeLimitMs ?? 4000;

  const [round, setRound] = useState(0);
  const [square, setSquare] = useState(() => randomSquare());
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState<"right" | "wrong" | null>(null);
  const [deadline, setDeadline] = useState(() => Date.now() + timeLimitMs);
  const [msLeft, setMsLeft] = useState(timeLimitMs);

  const answer = useMemo(() => squareColor(square), [square]);

  useEffect(() => {
    const id = setInterval(() => setMsLeft(Math.max(0, deadline - Date.now())), 100);
    return () => clearInterval(id);
  }, [deadline]);

  useEffect(() => {
    if (msLeft <= 0 && feedback === null) {
      handleAnswer(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft]);

  function nextRound(nextCorrect: number) {
    if (round + 1 >= reps) {
      onFinish({ accuracyPct: Math.round((nextCorrect / reps) * 100) });
      return;
    }
    setRound((r) => r + 1);
    setSquare(randomSquare());
    setFeedback(null);
    setDeadline(Date.now() + timeLimitMs);
    setMsLeft(timeLimitMs);
  }

  function handleAnswer(choice: "light" | "dark" | null) {
    if (feedback !== null) return;
    const isRight = choice === answer;
    setFeedback(isRight ? "right" : "wrong");
    const nextCorrect = correct + (isRight ? 1 : 0);
    setCorrect(nextCorrect);
    setTimeout(() => nextRound(nextCorrect), 350);
  }

  return (
    <div className="chess-drill">
      <div className="chess-drill-progress">{round + 1} / {reps}</div>
      <div className="chess-square-prompt">{square}</div>
      <div className="chess-timer-bar">
        <div className="chess-timer-bar-fill" style={{ width: `${(msLeft / timeLimitMs) * 100}%` }} />
      </div>
      <div className="row">
        <button className="pixel-btn" type="button" onClick={() => handleAnswer("light")}>Light</button>
        <button className="pixel-btn" type="button" onClick={() => handleAnswer("dark")}>Dark</button>
      </div>
      {feedback && (
        <p className={feedback === "right" ? "chess-feedback-right" : "chess-feedback-wrong"}>
          {feedback === "right" ? "Correct" : `Answer: ${answer}`}
        </p>
      )}
      <p className="muted">Score so far: {correct} / {round + (feedback ? 1 : 0)}</p>
    </div>
  );
}

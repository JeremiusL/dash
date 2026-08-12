import { useEffect, useState } from "react";
import { shuffledSquares } from "../../../lib/chessGeometry";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

const CODES = ["Q", "R", "B", "N", "P", "q", "r", "b", "n", "p"];

function setupPosition(pieceCount: number): Record<string, string> {
  const squares = shuffledSquares(pieceCount);
  const position: Record<string, string> = {};
  squares.forEach((sq) => {
    position[sq] = CODES[Math.floor(Math.random() * CODES.length)];
  });
  return position;
}

export function PositionRecallDrill({ params, onFinish }: DrillProps) {
  const pieceCount = params.pieceCount ?? 5;
  const viewTimeSec = params.viewTimeSec ?? 12;

  const [original] = useState(() => setupPosition(pieceCount));
  const [phase, setPhase] = useState<"view" | "answer" | "result">("view");
  const [placed, setPlaced] = useState<Record<string, string>>({});
  const [selectedCode, setSelectedCode] = useState<string>("Q");

  useEffect(() => {
    if (phase !== "view") return;
    const id = setTimeout(() => setPhase("answer"), viewTimeSec * 1000);
    return () => clearTimeout(id);
  }, [phase, viewTimeSec]);

  if (phase === "view") {
    return (
      <div className="chess-drill">
        <p>Memorize this position. It hides in {viewTimeSec}s.</p>
        <MiniBoard position={original} />
      </div>
    );
  }

  function place(square: string) {
    setPlaced((prev) => {
      const next = { ...prev };
      if (next[square] === selectedCode) delete next[square];
      else next[square] = selectedCode;
      return next;
    });
  }

  function submit() {
    const originalSquares = Object.keys(original);
    const correct = originalSquares.filter((sq) => placed[sq] === original[sq]).length;
    setPhase("result");
    onFinish({ accuracyPct: Math.round((correct / originalSquares.length) * 100) });
  }

  if (phase === "answer") {
    return (
      <div className="chess-drill">
        <p>Place each piece where you remember it. Pick a piece, then click its square.</p>
        <div className="row chess-piece-palette">
          {CODES.map((code) => (
            <button
              key={code}
              type="button"
              className={`pixel-btn ${selectedCode === code ? "pixel-btn--accent" : ""}`}
              onClick={() => setSelectedCode(code)}
            >
              {code}
            </button>
          ))}
        </div>
        <MiniBoard hidden={false} position={placed} onSquareClick={place} />
        <button className="pixel-btn" type="button" onClick={submit}>
          Submit
        </button>
      </div>
    );
  }

  return <p className="muted">Scored.</p>;
}

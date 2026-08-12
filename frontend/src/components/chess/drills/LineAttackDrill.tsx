import { useMemo, useState } from "react";
import { bishopTargets, queenTargets, randomSquare, rookTargets } from "../../../lib/chessGeometry";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

type PieceKind = "rook" | "bishop" | "queen";

const CODE: Record<PieceKind, string> = { rook: "R", bishop: "B", queen: "Q" };

function targetsFor(kind: PieceKind, square: string): string[] {
  if (kind === "rook") return rookTargets(square);
  if (kind === "bishop") return bishopTargets(square);
  return queenTargets(square);
}

function randomKind(includeQueen: boolean): PieceKind {
  const pool: PieceKind[] = includeQueen ? ["rook", "bishop", "queen"] : ["rook", "bishop"];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function LineAttackDrill({ params, onFinish }: DrillProps) {
  const reps = params.reps ?? 24;
  const includeQueen = Boolean(params.includeQueen);
  const boardHidden = Boolean(params.boardHidden);

  const [round, setRound] = useState(0);
  const [kind, setKind] = useState<PieceKind>(() => randomKind(includeQueen));
  const [square, setSquare] = useState(() => randomSquare());
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [totalAccuracy, setTotalAccuracy] = useState(0);

  const targets = useMemo(() => targetsFor(kind, square), [kind, square]);

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
    const nextTotal = totalAccuracy + repScore;
    setTotalAccuracy(nextTotal);
    setTimeout(() => {
      if (round + 1 >= reps) {
        onFinish({ accuracyPct: Math.round((nextTotal / reps) * 100) });
        return;
      }
      setRound((r) => r + 1);
      setKind(randomKind(includeQueen));
      setSquare(randomSquare());
      setSelected([]);
      setSubmitted(false);
    }, 900);
  }

  return (
    <div className="chess-drill">
      <div className="chess-drill-progress">{round + 1} / {reps}</div>
      <p>
        Click every square the <strong>{kind}</strong> on <strong>{square}</strong> attacks.
      </p>
      <MiniBoard
        position={{ [square]: CODE[kind] }}
        hidden={boardHidden}
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

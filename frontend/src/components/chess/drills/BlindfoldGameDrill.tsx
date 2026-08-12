import { useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import { MiniBoard } from "../MiniBoard";
import type { DrillProps } from "../types";

const REDUCED_FEN = "3qk3/pp6/8/8/8/8/PP6/3QK3 w - - 0 1";

function pickBotMove(game: Chess, preferCaptures: boolean): string {
  const moves = game.moves({ verbose: true });
  const captures = moves.filter((m) => m.captured);
  const pool = preferCaptures && captures.length > 0 ? captures : moves;
  return pool[Math.floor(Math.random() * pool.length)].san;
}

export function BlindfoldGameDrill({ params, onFinish }: DrillProps) {
  const reducedMaterial = Boolean(params.reducedMaterial);
  const maxMoves = params.maxMoves ?? 0;
  const botStrength = params.botStrength ?? 0;

  const gameRef = useRef(new Chess(reducedMaterial ? REDUCED_FEN : undefined));
  const [, setVersion] = useState(0);
  const rerender = () => setVersion((v) => v + 1);

  const [log, setLog] = useState<string[]>([]);
  const [userMoves, setUserMoves] = useState(0);
  const [illegalAttempts, setIllegalAttempts] = useState(0);
  const [from, setFrom] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);

  function finish() {
    if (finished) return;
    setFinished(true);
    const total = userMoves + illegalAttempts;
    const accuracyPct = total > 0 ? Math.round((userMoves / total) * 100) : null;
    onFinish({ accuracyPct });
  }

  function afterMove(userSan: string) {
    setLog((l) => [...l, userSan]);
    const game = gameRef.current;

    if (game.isGameOver()) {
      setMessage(game.isCheckmate() ? "Checkmate!" : "Game over.");
      rerender();
      return;
    }
    if (maxMoves > 0 && userMoves + 1 >= maxMoves) {
      setMessage("Move limit reached.");
      rerender();
      return;
    }

    const botSan = pickBotMove(game, botStrength >= 1);
    game.move(botSan);
    setLog((l) => [...l, botSan]);

    if (game.isGameOver()) {
      setMessage(game.isCheckmate() ? "Checkmate — the bot mated you." : "Game over.");
    }
    rerender();
  }

  function pick(square: string) {
    if (finished || message) return;
    const game = gameRef.current;
    if (!from) {
      setFrom(square);
      return;
    }
    try {
      const move = game.move({ from: from as Square, to: square as Square, promotion: "q" });
      setFrom(null);
      setUserMoves((n) => n + 1);
      afterMove(move.san);
    } catch {
      setIllegalAttempts((n) => n + 1);
      setFrom(null);
      setMessage("Illegal move — try again.");
      setTimeout(() => setMessage(null), 1200);
    }
  }

  const cappedLabel = maxMoves > 0 ? ` (up to ${maxMoves} moves)` : "";

  return (
    <div className="chess-drill">
      <p className="muted">
        No board shown{cappedLabel}. Click the square of the piece you want to move, then its destination.
      </p>
      <p className="chess-notation-line">
        {log.map((san, i) => (
          <span key={i}>
            {i % 2 === 0 ? `${i / 2 + 1}. ` : ""}
            {san}{" "}
          </span>
        ))}
      </p>
      <MiniBoard hidden selected={from ? [from] : []} onSquareClick={pick} />
      {message && <p className={message.startsWith("Illegal") ? "chess-feedback-wrong" : "chess-feedback-right"}>{message}</p>}
      <button className="pixel-btn" type="button" onClick={finish}>
        Finish game
      </button>
    </div>
  );
}

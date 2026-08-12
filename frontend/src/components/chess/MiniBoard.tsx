import { FILES, RANKS, squareColor } from "../../lib/chessGeometry";

const GLYPHS: Record<string, string> = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

export interface MiniBoardProps {
  position?: Record<string, string>; // square -> piece code (K,Q,R,B,N,P / k,q,r,b,n,p)
  hidden?: boolean; // renders a blank grid (no pieces, "?" placeholder look)
  highlight?: string[];
  selected?: string[];
  markers?: Record<string, string>; // square -> small badge text (e.g. move order)
  onSquareClick?: (square: string) => void;
  flipped?: boolean;
}

export function MiniBoard({ position = {}, hidden = false, highlight = [], selected = [], markers = {}, onSquareClick, flipped = false }: MiniBoardProps) {
  const ranks = flipped ? [...RANKS] : [...RANKS].reverse();
  const files = flipped ? [...FILES].reverse() : [...FILES];

  return (
    <div className="chess-board" role="grid" aria-label="chess board">
      {ranks.map((rank) =>
        files.map((file) => {
          const square = `${file}${rank}`;
          const color = squareColor(square);
          const piece = hidden ? undefined : position[square];
          const classes = [
            "chess-square",
            `chess-square--${color}`,
            highlight.includes(square) ? "chess-square--highlight" : "",
            selected.includes(square) ? "chess-square--selected" : "",
            onSquareClick ? "chess-square--clickable" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={square}
              type="button"
              className={classes}
              onClick={onSquareClick ? () => onSquareClick(square) : undefined}
              disabled={!onSquareClick}
              aria-label={square}
            >
              {piece ? <span className="chess-piece">{GLYPHS[piece]}</span> : null}
              {markers[square] ? <span className="chess-marker">{markers[square]}</span> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

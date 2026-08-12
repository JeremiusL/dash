export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const RANKS = ["1", "2", "3", "4", "5", "6", "7", "8"] as const;

export const ALL_SQUARES: string[] = RANKS.flatMap((r) => FILES.map((f) => `${f}${r}`));

export function fileIndex(square: string): number {
  return FILES.indexOf(square[0] as (typeof FILES)[number]);
}

export function rankIndex(square: string): number {
  return RANKS.indexOf(square[1] as (typeof RANKS)[number]);
}

export function squareOf(fi: number, ri: number): string | null {
  if (fi < 0 || fi > 7 || ri < 0 || ri > 7) return null;
  return `${FILES[fi]}${RANKS[ri]}`;
}

export function squareColor(square: string): "light" | "dark" {
  return (fileIndex(square) + rankIndex(square)) % 2 === 0 ? "dark" : "light";
}

export function randomSquare(): string {
  return ALL_SQUARES[Math.floor(Math.random() * ALL_SQUARES.length)];
}

export function knightTargets(square: string): string[] {
  const fi = fileIndex(square);
  const ri = rankIndex(square);
  const deltas = [
    [1, 2], [2, 1], [2, -1], [1, -2],
    [-1, -2], [-2, -1], [-2, 1], [-1, 2],
  ];
  return deltas
    .map(([df, dr]) => squareOf(fi + df, ri + dr))
    .filter((s): s is string => s !== null);
}

const ROOK_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function raySquares(square: string, dirs: number[][]): string[] {
  const fi = fileIndex(square);
  const ri = rankIndex(square);
  const out: string[] = [];
  for (const [df, dr] of dirs) {
    let f = fi + df;
    let r = ri + dr;
    while (f >= 0 && f <= 7 && r >= 0 && r <= 7) {
      out.push(squareOf(f, r) as string);
      f += df;
      r += dr;
    }
  }
  return out;
}

export function rookTargets(square: string): string[] {
  return raySquares(square, ROOK_DIRS);
}

export function bishopTargets(square: string): string[] {
  return raySquares(square, BISHOP_DIRS);
}

export function queenTargets(square: string): string[] {
  return [...rookTargets(square), ...bishopTargets(square)];
}

export function shuffledSquares(count: number, exclude: string[] = []): string[] {
  const pool = ALL_SQUARES.filter((s) => !exclude.includes(s));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

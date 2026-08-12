// 30-day chess visualization curriculum.
//
// Progression (grounded in standard blindfold-training methodology — square/coordinate
// drills, then single- and multi-piece tracking with progressive board deprivation, then
// text-only notation/tactics, then full blindfold games):
//   Days 1-7   Board geometry: square colors, lines of attack, knight sight.
//   Days 8-14  Piece tracking: single/multi-piece move sequences, position flash-recall.
//   Days 15-21 Notation & tactics with no board shown at all.
//   Days 22-30 Blindfold play: mini games building up to a full blindfold game.

export type ExerciseType =
  | "square-color"
  | "line-attack"
  | "knight-sight"
  | "piece-tracking"
  | "position-recall"
  | "notation-replay"
  | "blindfold-puzzle"
  | "blindfold-game";

export interface DayPlan {
  day: number;
  title: string;
  skillFocus: string;
  exerciseType: ExerciseType;
  params: Record<string, number>;
  instructions: string;
}

export interface MatePuzzle {
  fen: string;
  description: string;
  mateIn: 1 | 2;
  solution: string; // key move, e.g. "a1a8" (from-square + to-square)
  solutionLabel: string; // human-readable, e.g. "Ra8#"
}

export const MATE_IN_1_PUZZLES: MatePuzzle[] = [
  {
    fen: "6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1",
    description:
      "White king g1, rook a1, pawns f2/g2/h2. Black king g8, pawns f7/g7/h7. White to move.",
    mateIn: 1,
    solution: "a1a8",
    solutionLabel: "Ra8#",
  },
  {
    fen: "7k/Q7/5K2/8/8/8/8/8 w - - 0 1",
    description: "White king f6, queen a7. Black king h8 alone. White to move.",
    mateIn: 1,
    solution: "a7g7",
    solutionLabel: "Qg7#",
  },
  {
    fen: "7k/8/6K1/8/8/8/8/R7 w - - 0 1",
    description: "White king g6, rook a1. Black king h8 alone. White to move.",
    mateIn: 1,
    solution: "a1a8",
    solutionLabel: "Ra8#",
  },
  {
    fen: "7k/R7/8/8/8/8/8/1R6 w - - 0 1",
    description: "White rooks a7 and b1. Black king h8 alone. White to move.",
    mateIn: 1,
    solution: "b1b8",
    solutionLabel: "Rb8#",
  },
];

export const MATE_IN_2_PUZZLES: MatePuzzle[] = [
  {
    fen: "7k/8/8/8/8/8/8/RR4K1 w - - 0 1",
    description:
      "White king g1, rooks a1 and b1. Black king h8 alone. White to move and force mate in 2 (find the key move).",
    mateIn: 2,
    solution: "b1b7",
    solutionLabel: "Rb7 (cuts the 7th rank, forcing ...Kg8; then Ra8#)",
  },
  {
    fen: "k7/8/8/8/8/8/8/1K4RR w - - 0 1",
    description:
      "White king b1, rooks g1 and h1. Black king a8 alone. White to move and force mate in 2 (find the key move).",
    mateIn: 2,
    solution: "g1g7",
    solutionLabel: "Rg7 (cuts the 7th rank, forcing ...Kb8; then Rh8#)",
  },
];

const DAY_PLANS: DayPlan[] = [
  // Week 1 — board geometry
  {
    day: 1,
    title: "Square colors, cold",
    skillFocus: "Instant light/dark square recognition",
    exerciseType: "square-color",
    params: { reps: 40, timeLimitMs: 4000 },
    instructions:
      "A square name (e.g. e4) flashes up. Say or click light/dark before the timer runs out. Speed matters more than streaks today — this is the single most-repeated drill of the whole program.",
  },
  {
    day: 2,
    title: "Ranks, files, diagonals",
    skillFocus: "Naming the line a square sits on",
    exerciseType: "square-color",
    params: { reps: 40, timeLimitMs: 3500 },
    instructions:
      "Same drill, faster clock. Along with the color, silently note the rank, file, and which diagonal(s) the square sits on — you'll need that instantly from day 4 onward.",
  },
  {
    day: 3,
    title: "Knight sight",
    skillFocus: "Seeing every square a knight attacks",
    exerciseType: "knight-sight",
    params: { reps: 20, boardHidden: 0 },
    instructions:
      "A knight appears on a square. Click every square it attacks before confirming. Board stays visible today — just build the pattern.",
  },
  {
    day: 4,
    title: "Bishop, rook & queen lines",
    skillFocus: "Lines of attack for sliding pieces",
    exerciseType: "line-attack",
    params: { reps: 24, includeQueen: 1, boardHidden: 0 },
    instructions:
      "A piece and a square are given. Click every square that piece attacks along its rank, file, and/or diagonals. Queen reps combine both.",
  },
  {
    day: 5,
    title: "Knight's tour",
    skillFocus: "Tracking a knight across several jumps",
    exerciseType: "knight-sight",
    params: { reps: 12, boardHidden: 1, jumps: 4 },
    instructions:
      "The knight's start square is shown, then the board disappears. A sequence of jumps is read out one at a time. After the last jump, click where the knight ended up on a blank grid.",
  },
  {
    day: 6,
    title: "Mixed attack recall",
    skillFocus: "Any piece, any square, no board",
    exerciseType: "line-attack",
    params: { reps: 24, includeQueen: 1, boardHidden: 1 },
    instructions: "Same as day 4, but the board is hidden the moment the piece and square are announced.",
  },
  {
    day: 7,
    title: "Week 1 review",
    skillFocus: "Combined geometry drill",
    exerciseType: "square-color",
    params: { reps: 50, timeLimitMs: 3000 },
    instructions:
      "Fast mixed review: square colors under a tighter clock. If this feels easy, the board geometry is internalized — that's the whole goal of week 1.",
  },

  // Week 2 — piece tracking
  {
    day: 8,
    title: "Single piece, short sequence",
    skillFocus: "Tracking one piece through 3-4 moves",
    exerciseType: "piece-tracking",
    params: { pieceCount: 1, moveCount: 4, viewTimeSec: 5 },
    instructions:
      "One piece appears on the board for a few seconds, then the board fades. A short list of moves is read out one at a time. Click the piece's final square on the blank grid.",
  },
  {
    day: 9,
    title: "Single piece, longer sequence",
    skillFocus: "Tracking one piece through 5-6 moves",
    exerciseType: "piece-tracking",
    params: { pieceCount: 1, moveCount: 6, viewTimeSec: 3 },
    instructions: "Same idea, shorter look at the board and one or two extra moves to track.",
  },
  {
    day: 10,
    title: "Two pieces, independent",
    skillFocus: "Holding two pieces in mind at once",
    exerciseType: "piece-tracking",
    params: { pieceCount: 2, moveCount: 4, viewTimeSec: 4 },
    instructions:
      "Two pieces move independently, moves interleaved. Track both; you'll be asked for both final squares.",
  },
  {
    day: 11,
    title: "Two pieces, with a capture",
    skillFocus: "Updating the position when a piece disappears",
    exerciseType: "piece-tracking",
    params: { pieceCount: 2, moveCount: 5, viewTimeSec: 3 },
    instructions: "One of the moves is a capture — make sure you drop the captured piece from your mental board.",
  },
  {
    day: 12,
    title: "Position flash-recall (light)",
    skillFocus: "Whole-board snapshot memory",
    exerciseType: "position-recall",
    params: { pieceCount: 5, viewTimeSec: 15 },
    instructions:
      "A 5-piece position flashes for 15 seconds, then disappears. Reconstruct it from memory by placing each piece on a blank board.",
  },
  {
    day: 13,
    title: "Position flash-recall (dense)",
    skillFocus: "Whole-board snapshot memory, less time",
    exerciseType: "position-recall",
    params: { pieceCount: 7, viewTimeSec: 10 },
    instructions: "Same task, more pieces, shorter look.",
  },
  {
    day: 14,
    title: "Week 2 checkpoint",
    skillFocus: "Combined tracking review",
    exerciseType: "piece-tracking",
    params: { pieceCount: 2, moveCount: 6, viewTimeSec: 3 },
    instructions:
      "Two pieces, six moves, brief initial look. Notice how much less you need to see the starting position now than on day 8.",
  },

  // Week 3 — notation & tactics, no board
  {
    day: 15,
    title: "Follow the notation (opening)",
    skillFocus: "Building a position from text alone",
    exerciseType: "notation-replay",
    params: { plyCount: 6, questionsCount: 3 },
    instructions:
      "A short opening is read out move by move, no board at any point. After the final move, answer a few 'what's on square X' questions from memory.",
  },
  {
    day: 16,
    title: "Follow the notation (with a trade)",
    skillFocus: "Tracking a capture through pure notation",
    exerciseType: "notation-replay",
    params: { plyCount: 8, questionsCount: 4 },
    instructions: "Same task, one move longer, and one of the moves is a capture — track material, not just squares.",
  },
  {
    day: 17,
    title: "Blindfold mate-in-1",
    skillFocus: "Visualizing a finish from a text description",
    exerciseType: "blindfold-puzzle",
    params: { count: 4, maxMateIn: 1 },
    instructions:
      "Each position is given as a plain-English description, not a diagram. Build it in your head, then find the mating move.",
  },
  {
    day: 18,
    title: "Blindfold mate-in-2",
    skillFocus: "Calculating two moves ahead, no board",
    exerciseType: "blindfold-puzzle",
    params: { count: 2, maxMateIn: 2 },
    instructions:
      "Same as day 17, but find the key move that forces mate two moves later — you need to see the forced reply before the mate.",
  },
  {
    day: 19,
    title: "Full-line reconstruction",
    skillFocus: "Holding a whole position after 10 ply",
    exerciseType: "notation-replay",
    params: { plyCount: 10, questionsCount: 5 },
    instructions:
      "A 10-ply line is read out with no board. Afterward, answer several 'what's on square X' questions to check how much of the position you retained.",
  },
  {
    day: 20,
    title: "Find the move (theory positions)",
    skillFocus: "Applying tactics knowledge blindfold",
    exerciseType: "blindfold-puzzle",
    params: { count: 3, maxMateIn: 1 },
    instructions: "Positions are described in text only. Find the best/mating move without ever seeing a diagram.",
  },
  {
    day: 21,
    title: "Week 3 review",
    skillFocus: "Combined notation + tactics, timed",
    exerciseType: "blindfold-puzzle",
    params: { count: 4, maxMateIn: 1 },
    instructions: "Mixed review of the week's puzzles under a light time pressure. No board, as always this week.",
  },

  // Week 4 — blindfold play
  {
    day: 22,
    title: "Blindfold mini-game (reduced material)",
    skillFocus: "First real blindfold play",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 1, maxMoves: 10, botStrength: 1 },
    instructions:
      "King, queen and two pawns each side, vs. an easy built-in bot. Enter moves in notation only — the board is never shown. Up to 10 moves.",
  },
  {
    day: 23,
    title: "Blindfold mini-game (longer)",
    skillFocus: "Sustaining the blindfold mental board longer",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 1, maxMoves: 15, botStrength: 1 },
    instructions: "Same setup, up to 15 moves this time.",
  },
  {
    day: 24,
    title: "Blindfold puzzle rush",
    skillFocus: "Speed under pressure, no board",
    exerciseType: "blindfold-puzzle",
    params: { count: 6, maxMateIn: 2 },
    instructions: "Mixed mate-in-1s and mate-in-2s, back to back, text-only, against the clock.",
  },
  {
    day: 25,
    title: "Blindfold endgame sequence",
    skillFocus: "Short forced sequences blindfold",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 1, maxMoves: 15, botStrength: 1 },
    instructions: "Reduced material again, but aim to convert an advantage within 15 moves, fully blindfold.",
  },
  {
    day: 26,
    title: "First full blindfold game",
    skillFocus: "Full material, no move cap",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 0, maxMoves: 0, botStrength: 0 },
    instructions:
      "Full starting position, easy bot, no board at any point, no move limit. This is the real thing — take your time.",
  },
  {
    day: 27,
    title: "Second full blindfold game",
    skillFocus: "Consistency",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 0, maxMoves: 0, botStrength: 0 },
    instructions: "Same as day 26. Compare how confident you feel against yesterday.",
  },
  {
    day: 28,
    title: "Third full blindfold game",
    skillFocus: "Speed of move-finding",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 0, maxMoves: 0, botStrength: 1 },
    instructions: "Same again, bot plays a little more sharply. Focus on not second-guessing your mental board.",
  },
  {
    day: 29,
    title: "Fourth full blindfold game",
    skillFocus: "Reflection",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 0, maxMoves: 0, botStrength: 1 },
    instructions: "One more full game. Afterward, note which piece type still gives you the most trouble.",
  },
  {
    day: 30,
    title: "Capstone: full blindfold game",
    skillFocus: "Everything, together",
    exerciseType: "blindfold-game",
    params: { reducedMaterial: 0, maxMoves: 0, botStrength: 1 },
    instructions:
      "A full blindfold game to close out the 30 days. Afterward you'll see your accuracy trend across the whole month and the option to extend into month 2.",
  },
];

/** Difficulty knobs scale up on cycle 2+ so the same 8 drill types support indefinite extension. */
export function scaleForCycle(plan: DayPlan, cycle: number): DayPlan {
  if (cycle <= 1) return plan;
  const bump = cycle - 1;
  const params = { ...plan.params };

  if ("timeLimitMs" in params) params.timeLimitMs = Math.max(1200, params.timeLimitMs - bump * 400);
  if ("viewTimeSec" in params) params.viewTimeSec = Math.max(0, params.viewTimeSec - bump * 2);
  if ("pieceCount" in params) params.pieceCount = params.pieceCount + bump;
  if ("moveCount" in params) params.moveCount = params.moveCount + bump;
  if ("plyCount" in params) params.plyCount = params.plyCount + bump * 2;
  if ("questionsCount" in params) params.questionsCount = params.questionsCount + bump;
  if ("count" in params) params.count = params.count + bump;
  if ("maxMateIn" in params) params.maxMateIn = Math.min(2, params.maxMateIn);
  if ("reducedMaterial" in params) params.reducedMaterial = 0;
  if ("botStrength" in params) params.botStrength = 1;
  if ("maxMoves" in params && params.maxMoves > 0) params.maxMoves = params.maxMoves + bump * 5;

  return { ...plan, params };
}

/** day is 1-based within the current cycle (i.e. already reduced mod cycle length by the caller). */
export function getDayPlan(dayWithinCycle: number, cycle: number): DayPlan {
  const base = DAY_PLANS[Math.min(Math.max(dayWithinCycle, 1), 30) - 1];
  return scaleForCycle(base, cycle);
}

export const CURRICULUM_LENGTH = DAY_PLANS.length;

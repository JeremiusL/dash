import { Router } from "express";
import { readJson, writeJson } from "../store.js";

interface Habit {
  id: string;
  name: string;
  createdAt: string;
  completions: string[]; // YYYY-MM-DD
}

interface ChessDayRecord {
  completedAt: string;
  exerciseType: string;
  accuracyPct: number | null;
  timeSpentSec: number;
}

interface ChessProgress {
  linkedHabitId: string | null;
  startDate: string | null;
  cycle: number;
  days: Record<number, ChessDayRecord>;
}

const CHESS_FILE = "chess.json";
const HABITS_FILE = "habits.json";
const CYCLE_LENGTH = 30;

const EMPTY_PROGRESS: ChessProgress = { linkedHabitId: null, startDate: null, cycle: 1, days: {} };

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00Z`).getTime();
  const d2 = new Date(`${b}T00:00:00Z`).getTime();
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function loadProgress(): Promise<ChessProgress> {
  const progress = await readJson<ChessProgress>(CHESS_FILE, EMPTY_PROGRESS);

  if (!progress.linkedHabitId) {
    const habits = await readJson<Habit[]>(HABITS_FILE, []);
    const matches = habits.filter((h) => h.name.trim().toLowerCase() === "chess");
    if (matches.length === 1) {
      progress.linkedHabitId = matches[0].id;
      progress.startDate = progress.startDate ?? todayStr();
      await writeJson(CHESS_FILE, progress);
    }
  } else if (!progress.startDate) {
    progress.startDate = todayStr();
    await writeJson(CHESS_FILE, progress);
  }

  return progress;
}

function rawDayNumber(progress: ChessProgress): number {
  if (!progress.startDate) return 1;
  return Math.max(daysBetween(progress.startDate, todayStr()) + 1, 1);
}

function todayDayNumber(progress: ChessProgress): number {
  const cap = progress.cycle * CYCLE_LENGTH;
  return Math.min(rawDayNumber(progress), cap);
}

function streakFor(progress: ChessProgress): number {
  const today = todayDayNumber(progress);
  let cursor = today;
  let streak = 0;
  while (cursor >= 1 && progress.days[cursor]) {
    streak += 1;
    cursor -= 1;
  }
  return streak;
}

function withComputed(progress: ChessProgress) {
  const tdn = todayDayNumber(progress);
  return {
    ...progress,
    todayDayNumber: tdn,
    todayCompleted: Boolean(progress.days[tdn]),
    cycleLength: CYCLE_LENGTH,
    streak: streakFor(progress),
    cycleFinished: rawDayNumber(progress) > progress.cycle * CYCLE_LENGTH,
  };
}

export const chessRouter = Router();

chessRouter.get("/state", async (_req, res) => {
  const progress = await loadProgress();
  res.json(withComputed(progress));
});

chessRouter.post("/link-habit", async (req, res) => {
  const { habitId } = req.body as { habitId?: string };
  if (!habitId) {
    res.status(400).json({ error: "habitId is required" });
    return;
  }
  const habits = await readJson<Habit[]>(HABITS_FILE, []);
  if (!habits.some((h) => h.id === habitId)) {
    res.status(404).json({ error: "habit not found" });
    return;
  }
  const progress = await readJson<ChessProgress>(CHESS_FILE, EMPTY_PROGRESS);
  progress.linkedHabitId = habitId;
  progress.startDate = progress.startDate ?? todayStr();
  await writeJson(CHESS_FILE, progress);
  res.json(withComputed(progress));
});

chessRouter.post("/complete", async (req, res) => {
  const { day, exerciseType, accuracyPct, timeSpentSec } = req.body as {
    day?: number;
    exerciseType?: string;
    accuracyPct?: number | null;
    timeSpentSec?: number;
  };

  const progress = await loadProgress();
  const due = todayDayNumber(progress);

  if (typeof day !== "number" || day !== due) {
    res.status(400).json({ error: `day must equal today's due day (${due})` });
    return;
  }
  if (!exerciseType || typeof timeSpentSec !== "number") {
    res.status(400).json({ error: "exerciseType and timeSpentSec are required" });
    return;
  }

  progress.days[day] = {
    completedAt: new Date().toISOString(),
    exerciseType,
    accuracyPct: typeof accuracyPct === "number" ? accuracyPct : null,
    timeSpentSec,
  };
  await writeJson(CHESS_FILE, progress);

  if (progress.linkedHabitId) {
    const habits = await readJson<Habit[]>(HABITS_FILE, []);
    const habit = habits.find((h) => h.id === progress.linkedHabitId);
    if (habit) {
      const today = todayStr();
      if (!habit.completions.includes(today)) {
        habit.completions = [...habit.completions, today].sort();
        await writeJson(HABITS_FILE, habits);
      }
    }
  }

  res.json(withComputed(progress));
});

chessRouter.post("/extend", async (_req, res) => {
  const progress = await loadProgress();
  if (rawDayNumber(progress) <= progress.cycle * CYCLE_LENGTH) {
    res.status(400).json({ error: "current cycle is not finished yet" });
    return;
  }
  progress.cycle += 1;
  await writeJson(CHESS_FILE, progress);
  res.json(withComputed(progress));
});

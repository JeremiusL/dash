import { Router } from "express";
import { readJson, writeJson, newId } from "../store.js";

interface Habit {
  id: string;
  name: string;
  createdAt: string;
  completions: string[]; // YYYY-MM-DD
}

const FILE = "habits.json";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function streakFor(completions: string[]): number {
  const set = new Set(completions);
  const today = todayStr();
  let cursor = set.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function withStreak(h: Habit) {
  return { ...h, streak: streakFor(h.completions), completedToday: h.completions.includes(todayStr()) };
}

export const habitsRouter = Router();

habitsRouter.get("/", async (_req, res) => {
  const habits = await readJson<Habit[]>(FILE, []);
  res.json(habits.map(withStreak));
});

habitsRouter.post("/", async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name || !name.trim()) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const habits = await readJson<Habit[]>(FILE, []);
  const habit: Habit = { id: newId(), name: name.trim(), createdAt: new Date().toISOString(), completions: [] };
  habits.push(habit);
  await writeJson(FILE, habits);
  res.status(201).json(withStreak(habit));
});

habitsRouter.delete("/:id", async (req, res) => {
  const habits = await readJson<Habit[]>(FILE, []);
  const next = habits.filter((h) => h.id !== req.params.id);
  if (next.length === habits.length) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await writeJson(FILE, next);
  res.status(204).end();
});

habitsRouter.post("/:id/checkin", async (req, res) => {
  const habits = await readJson<Habit[]>(FILE, []);
  const habit = habits.find((h) => h.id === req.params.id);
  if (!habit) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const today = todayStr();
  const alreadyDone = habit.completions.includes(today);
  habit.completions = alreadyDone
    ? habit.completions.filter((d) => d !== today)
    : [...habit.completions, today].sort();
  await writeJson(FILE, habits);
  res.json(withStreak(habit));
});

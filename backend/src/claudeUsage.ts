import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { readJson, writeJson } from "./store.js";

const PROJECTS_DIR = path.join(os.homedir(), ".claude", "projects");
const CACHE_FILE = "usage-cache.json";
const HISTORY_DAYS = 7;

interface DayTotals {
  tokens: number;
  messages: number;
}

interface FileCache {
  offset: number;
  daily: Record<string, DayTotals>;
}

type UsageCache = Record<string, FileCache>;

export interface DayUsage {
  date: string;
  tokens: number;
  messages: number;
}

export interface UsageSummary {
  available: boolean;
  days: DayUsage[];
  todayTokens: number;
  todayMessages: number;
  weekTokens: number;
  updatedAt: string;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

async function listSessionFiles(): Promise<string[]> {
  let projectDirs: string[];
  try {
    projectDirs = await fs.readdir(PROJECTS_DIR);
  } catch {
    return [];
  }
  const files: string[] = [];
  for (const dir of projectDirs) {
    const full = path.join(PROJECTS_DIR, dir);
    let entries: string[];
    try {
      entries = await fs.readdir(full);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.endsWith(".jsonl")) files.push(path.join(full, entry));
    }
  }
  return files;
}

function readFromOffset(filePath: string, start: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start });
    stream.on("data", (c) => chunks.push(c as Buffer));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}

async function scanFile(filePath: string, prev: FileCache | undefined): Promise<FileCache> {
  const stat = await fs.stat(filePath);
  const startOffset = prev && prev.offset <= stat.size ? prev.offset : 0;
  const daily: Record<string, DayTotals> = startOffset > 0 && prev ? { ...prev.daily } : {};

  if (startOffset >= stat.size) {
    return { offset: startOffset, daily };
  }

  const chunk = await readFromOffset(filePath, startOffset);
  const lastNewline = chunk.lastIndexOf("\n");
  if (lastNewline === -1) {
    return { offset: startOffset, daily };
  }

  const usable = chunk.slice(0, lastNewline);
  const newOffset = startOffset + lastNewline + 1;

  for (const line of usable.split("\n")) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const usage = obj?.message?.usage;
      if (obj?.type !== "assistant" || !usage || !obj.timestamp) continue;
      const tokens =
        (usage.input_tokens ?? 0) +
        (usage.output_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0);
      const date = String(obj.timestamp).slice(0, 10);
      const bucket = daily[date] ?? { tokens: 0, messages: 0 };
      bucket.tokens += tokens;
      bucket.messages += 1;
      daily[date] = bucket;
    } catch {
      // partial/malformed line, skip
    }
  }

  return { offset: newOffset, daily };
}

export async function getUsageSummary(): Promise<UsageSummary> {
  const files = await listSessionFiles();
  const today = todayStr();
  const earliestNeeded = addDays(today, -(HISTORY_DAYS - 1));

  if (files.length === 0) {
    return { available: false, days: [], todayTokens: 0, todayMessages: 0, weekTokens: 0, updatedAt: new Date().toISOString() };
  }

  const cache = await readJson<UsageCache>(CACHE_FILE, {});
  const nextCache: UsageCache = {};
  const combined: Record<string, DayTotals> = {};

  for (const filePath of files) {
    const updated = await scanFile(filePath, cache[filePath]);
    nextCache[filePath] = updated;
    for (const [date, totals] of Object.entries(updated.daily)) {
      if (date < earliestNeeded) continue;
      const bucket = combined[date] ?? { tokens: 0, messages: 0 };
      bucket.tokens += totals.tokens;
      bucket.messages += totals.messages;
      combined[date] = bucket;
    }
  }

  await writeJson(CACHE_FILE, nextCache);

  const days: DayUsage[] = [];
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const totals = combined[date] ?? { tokens: 0, messages: 0 };
    days.push({ date, ...totals });
  }

  const todayTotals = combined[today] ?? { tokens: 0, messages: 0 };
  const weekTokens = days.reduce((sum, d) => sum + d.tokens, 0);

  return {
    available: true,
    days,
    todayTokens: todayTotals.tokens,
    todayMessages: todayTotals.messages,
    weekTokens,
    updatedAt: new Date().toISOString(),
  };
}

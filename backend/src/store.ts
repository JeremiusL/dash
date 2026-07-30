import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(__dirname, "..", "data");

async function ensureFile(file: string, fallback: unknown) {
  const full = path.join(DATA_DIR, file);
  try {
    await fs.access(full);
  } catch {
    await fs.writeFile(full, JSON.stringify(fallback, null, 2));
  }
  return full;
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  const full = await ensureFile(file, fallback);
  const raw = await fs.readFile(full, "utf-8");
  return raw.trim() ? (JSON.parse(raw) as T) : fallback;
}

export async function writeJson<T>(file: string, data: T): Promise<void> {
  const full = path.join(DATA_DIR, file);
  const tmp = `${full}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2));
  await fs.rename(tmp, full);
}

export function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

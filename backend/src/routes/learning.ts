import { Router } from "express";
import { readJson, writeJson, newId } from "../store.js";

interface LinkItem {
  id: string;
  title: string;
  url: string;
  topic: string;
  createdAt: string;
}

interface NoteItem {
  id: string;
  title: string;
  body: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
}

type ReadingStatus = "todo" | "in-progress" | "done";

interface ReadingItem {
  id: string;
  title: string;
  url?: string;
  status: ReadingStatus;
  createdAt: string;
}

export const learningRouter = Router();

// ---- Links ----
learningRouter.get("/links", async (_req, res) => {
  res.json(await readJson<LinkItem[]>("links.json", []));
});

learningRouter.post("/links", async (req, res) => {
  const { title, url, topic } = req.body as { title?: string; url?: string; topic?: string };
  if (!title?.trim() || !url?.trim()) {
    res.status(400).json({ error: "title and url are required" });
    return;
  }
  const links = await readJson<LinkItem[]>("links.json", []);
  const item: LinkItem = {
    id: newId(),
    title: title.trim(),
    url: url.trim(),
    topic: topic?.trim() || "general",
    createdAt: new Date().toISOString(),
  };
  links.push(item);
  await writeJson("links.json", links);
  res.status(201).json(item);
});

learningRouter.delete("/links/:id", async (req, res) => {
  const links = await readJson<LinkItem[]>("links.json", []);
  const next = links.filter((l) => l.id !== req.params.id);
  if (next.length === links.length) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await writeJson("links.json", next);
  res.status(204).end();
});

// ---- Notes ----
learningRouter.get("/notes", async (_req, res) => {
  res.json(await readJson<NoteItem[]>("notes.json", []));
});

learningRouter.post("/notes", async (req, res) => {
  const { title, body, topic } = req.body as { title?: string; body?: string; topic?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const notes = await readJson<NoteItem[]>("notes.json", []);
  const now = new Date().toISOString();
  const item: NoteItem = {
    id: newId(),
    title: title.trim(),
    body: body ?? "",
    topic: topic?.trim() || "general",
    createdAt: now,
    updatedAt: now,
  };
  notes.push(item);
  await writeJson("notes.json", notes);
  res.status(201).json(item);
});

learningRouter.put("/notes/:id", async (req, res) => {
  const { title, body, topic } = req.body as { title?: string; body?: string; topic?: string };
  const notes = await readJson<NoteItem[]>("notes.json", []);
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (title !== undefined) note.title = title;
  if (body !== undefined) note.body = body;
  if (topic !== undefined) note.topic = topic;
  note.updatedAt = new Date().toISOString();
  await writeJson("notes.json", notes);
  res.json(note);
});

learningRouter.delete("/notes/:id", async (req, res) => {
  const notes = await readJson<NoteItem[]>("notes.json", []);
  const next = notes.filter((n) => n.id !== req.params.id);
  if (next.length === notes.length) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await writeJson("notes.json", next);
  res.status(204).end();
});

// ---- Reading list ----
learningRouter.get("/reading-list", async (_req, res) => {
  res.json(await readJson<ReadingItem[]>("reading-list.json", []));
});

learningRouter.post("/reading-list", async (req, res) => {
  const { title, url } = req.body as { title?: string; url?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  const items = await readJson<ReadingItem[]>("reading-list.json", []);
  const item: ReadingItem = {
    id: newId(),
    title: title.trim(),
    url: url?.trim() || undefined,
    status: "todo",
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  await writeJson("reading-list.json", items);
  res.status(201).json(item);
});

learningRouter.put("/reading-list/:id", async (req, res) => {
  const { status } = req.body as { status?: ReadingStatus };
  const items = await readJson<ReadingItem[]>("reading-list.json", []);
  const item = items.find((i) => i.id === req.params.id);
  if (!item) {
    res.status(404).json({ error: "not found" });
    return;
  }
  if (status && ["todo", "in-progress", "done"].includes(status)) {
    item.status = status;
  }
  await writeJson("reading-list.json", items);
  res.json(item);
});

learningRouter.delete("/reading-list/:id", async (req, res) => {
  const items = await readJson<ReadingItem[]>("reading-list.json", []);
  const next = items.filter((i) => i.id !== req.params.id);
  if (next.length === items.length) {
    res.status(404).json({ error: "not found" });
    return;
  }
  await writeJson("reading-list.json", next);
  res.status(204).end();
});

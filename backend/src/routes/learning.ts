import { Router } from "express";
import multer from "multer";
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, writeJson, newId, DATA_DIR } from "../store.js";

const PDF_DIR = path.join(DATA_DIR, "pdfs");
await fs.mkdir(PDF_DIR, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      cb(new Error("Only PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

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
  pdf?: {
    fileName: string;
    storedName: string;
    size: number;
  };
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

learningRouter.post("/notes/pdf", upload.single("pdf"), async (req, res) => {
  const { title, topic } = req.body as { title?: string; topic?: string };
  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "pdf file is required" });
    return;
  }
  const notes = await readJson<NoteItem[]>("notes.json", []);
  const now = new Date().toISOString();
  const id = newId();
  const storedName = `${id}.pdf`;
  await fs.writeFile(path.join(PDF_DIR, storedName), req.file.buffer);
  const item: NoteItem = {
    id,
    title: title.trim(),
    body: "",
    topic: topic?.trim() || "general",
    createdAt: now,
    updatedAt: now,
    pdf: {
      fileName: req.file.originalname,
      storedName,
      size: req.file.size,
    },
  };
  notes.push(item);
  await writeJson("notes.json", notes);
  res.status(201).json(item);
});

learningRouter.get("/notes/:id/pdf", async (req, res) => {
  const notes = await readJson<NoteItem[]>("notes.json", []);
  const note = notes.find((n) => n.id === req.params.id);
  if (!note?.pdf) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const filePath = path.join(PDF_DIR, note.pdf.storedName);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${note.pdf.fileName.replace(/"/g, "")}"`);
  res.sendFile(filePath);
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
  const note = notes.find((n) => n.id === req.params.id);
  if (!note) {
    res.status(404).json({ error: "not found" });
    return;
  }
  const next = notes.filter((n) => n.id !== req.params.id);
  await writeJson("notes.json", next);
  if (note.pdf) {
    await fs.rm(path.join(PDF_DIR, note.pdf.storedName), { force: true });
  }
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

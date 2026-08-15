import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { LinkItem, NoteItem, ReadingItem, ReadingStatus } from "../api";

type Tab = "links" | "notes" | "reading";

export function Learning() {
  const [tab, setTab] = useState<Tab>("links");

  return (
    <>
      <Link to="/" className="back-link">
        &lt;&lt; back
      </Link>
      <h1 className="app-title" style={{ color: "var(--accent-learning)" }}>
        Learning Center
      </h1>

      <div className="tabs">
        <button className={`tab ${tab === "links" ? "active" : ""}`} onClick={() => setTab("links")}>
          Links
        </button>
        <button className={`tab ${tab === "notes" ? "active" : ""}`} onClick={() => setTab("notes")}>
          Notes
        </button>
        <button className={`tab ${tab === "reading" ? "active" : ""}`} onClick={() => setTab("reading")}>
          Reading List
        </button>
      </div>

      {tab === "links" && <LinksTab />}
      {tab === "notes" && <NotesTab />}
      {tab === "reading" && <ReadingTab />}
    </>
  );
}

function LinksTab() {
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [topic, setTopic] = useState("");

  function refresh() {
    return api.learning.links.list().then(setLinks);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    await api.learning.links.create({ title: title.trim(), url: url.trim(), topic: topic.trim() });
    setTitle("");
    setUrl("");
    setTopic("");
    await refresh();
  }

  async function remove(id: string) {
    await api.learning.links.remove(id);
    await refresh();
  }

  return (
    <div className="section">
      <form className="row section" onSubmit={add}>
        <input className="pixel-input" placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="pixel-input" placeholder="https://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className="pixel-input" placeholder="topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <button className="pixel-btn" type="submit">
          Add
        </button>
      </form>

      {links.length === 0 ? (
        <p className="muted">No links yet.</p>
      ) : (
        <ul className="list">
          {links.map((l) => (
            <li key={l.id} className="list-item">
              <div>
                <a href={l.url} target="_blank" rel="noreferrer">
                  {l.title}
                </a>
                <div className="muted">{l.topic}</div>
              </div>
              <button className="pixel-btn pixel-btn--danger" onClick={() => remove(l.id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesTab() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editBody, setEditBody] = useState("");

  function clearFile() {
    setFile(null);
    setFileInputKey((k) => k + 1);
  }

  function refresh() {
    return api.learning.notes.list().then(setNotes);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setError("");
    try {
      if (file) {
        setUploading(true);
        await api.learning.notes.uploadPdf({ title: title.trim(), topic: topic.trim(), file });
      } else {
        await api.learning.notes.create({ title: title.trim(), body, topic: topic.trim() });
      }
      setTitle("");
      setBody("");
      setTopic("");
      clearFile();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    await api.learning.notes.remove(id);
    await refresh();
  }

  function startEdit(n: NoteItem) {
    setEditingId(n.id);
    setEditTitle(n.title);
    setEditTopic(n.topic);
    setEditBody(n.body);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    await api.learning.notes.update(id, { title: editTitle.trim(), topic: editTopic.trim(), body: editBody });
    setEditingId(null);
    await refresh();
  }

  return (
    <div className="section">
      <form className="section" onSubmit={add}>
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="pixel-input" placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="pixel-input" placeholder="topic (optional)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        </div>
        <textarea
          className="pixel-textarea"
          placeholder="note body"
          rows={4}
          style={{ width: "100%", marginBottom: 10 }}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!!file}
        />
        <div className="row" style={{ marginBottom: 10, alignItems: "center" }}>
          <input
            key={fileInputKey}
            className="pixel-file"
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <button type="button" className="pixel-btn pixel-btn--danger" onClick={clearFile}>
              Clear
            </button>
          )}
        </div>
        {file && <p className="muted">Attaching PDF: {file.name} — note body is disabled while a PDF is attached.</p>}
        {error && <p className="muted">{error}</p>}
        <button className="pixel-btn" type="submit" disabled={uploading}>
          {uploading ? "Uploading..." : file ? "Add note with PDF" : "Add note"}
        </button>
      </form>

      {notes.length === 0 ? (
        <p className="muted">No notes yet.</p>
      ) : (
        <ul className="list">
          {notes.map((n) =>
            editingId === n.id ? (
              <li key={n.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <div className="row" style={{ width: "100%", marginBottom: 10 }}>
                  <input
                    className="pixel-input"
                    placeholder="title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                  <input
                    className="pixel-input"
                    placeholder="topic (optional)"
                    value={editTopic}
                    onChange={(e) => setEditTopic(e.target.value)}
                  />
                </div>
                <textarea
                  className="pixel-textarea"
                  placeholder="note body"
                  rows={4}
                  style={{ width: "100%", marginBottom: 10 }}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
                <div className="row">
                  <button className="pixel-btn" onClick={() => saveEdit(n.id)}>
                    Save
                  </button>
                  <button className="pixel-btn" onClick={cancelEdit}>
                    Cancel
                  </button>
                </div>
              </li>
            ) : (
              <li key={n.id} className="list-item" style={{ flexDirection: "column", alignItems: "flex-start" }}>
                <div className="row" style={{ width: "100%", justifyContent: "space-between" }}>
                  <strong>{n.title}</strong>
                  <div className="row">
                    <button className="pixel-btn" onClick={() => startEdit(n)}>
                      Edit
                    </button>
                    <button className="pixel-btn pixel-btn--danger" onClick={() => remove(n.id)}>
                      Delete
                    </button>
                  </div>
                </div>
                {n.body && <p style={{ margin: "8px 0 0" }}>{n.body}</p>}
                {n.pdf && (
                  <p style={{ margin: "8px 0 0" }}>
                    <a href={api.learning.notes.pdfUrl(n.id)} target="_blank" rel="noreferrer">
                      📄 {n.pdf.fileName}
                    </a>
                  </p>
                )}
                <div className="muted">{n.topic}</div>
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

function ReadingTab() {
  const [items, setItems] = useState<ReadingItem[]>([]);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  function refresh() {
    return api.learning.readingList.list().then(setItems);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await api.learning.readingList.create({ title: title.trim(), url: url.trim() || undefined });
    setTitle("");
    setUrl("");
    await refresh();
  }

  async function cycleStatus(item: ReadingItem) {
    const order: ReadingStatus[] = ["todo", "in-progress", "done"];
    const next = order[(order.indexOf(item.status) + 1) % order.length];
    await api.learning.readingList.setStatus(item.id, next);
    await refresh();
  }

  async function remove(id: string) {
    await api.learning.readingList.remove(id);
    await refresh();
  }

  return (
    <div className="section">
      <form className="row section" onSubmit={add}>
        <input className="pixel-input" placeholder="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="pixel-input" placeholder="url (optional)" value={url} onChange={(e) => setUrl(e.target.value)} />
        <button className="pixel-btn" type="submit">
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <p className="muted">Nothing queued yet.</p>
      ) : (
        <ul className="list">
          {items.map((item) => (
            <li key={item.id} className="list-item">
              <div>
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer">
                    {item.title}
                  </a>
                ) : (
                  <span>{item.title}</span>
                )}
              </div>
              <div className="row">
                <button className="pixel-btn" onClick={() => cycleStatus(item)}>
                  {item.status}
                </button>
                <button className="pixel-btn pixel-btn--danger" onClick={() => remove(item.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

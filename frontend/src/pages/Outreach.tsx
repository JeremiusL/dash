import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { OutreachDraft } from "../api";

export function Outreach() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);

  function refresh() {
    setError(null);
    return api.outreach
      .list("pending_review")
      .then((summary) => {
        setConfigured(summary.configured);
        setDrafts(summary.drafts);
        setEdits((prev) => {
          const next = { ...prev };
          for (const d of summary.drafts) {
            if (!next[d.rowKey]) next[d.rowKey] = { subject: d.emailSubject, body: d.emailBody };
          }
          return next;
        });
        if (summary.error) setError(summary.error);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "failed to load outreach drafts"));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  function setEdit(id: string, field: "subject" | "body", value: string) {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function persistEdit(id: string) {
    const edit = edits[id];
    if (!edit) return;
    await api.outreach.update(id, { emailSubject: edit.subject, emailBody: edit.body });
  }

  async function saveEdit(id: string) {
    setSaving(id);
    setActionError(null);
    try {
      await persistEdit(id);
      // Without this, `drafts` (used for the dirty check) still holds the
      // pre-edit text, so the Save button looks "dirty" forever after a
      // successful save until some other refresh happens to fire.
      await refresh();
    } catch (err) {
      setActionError({ id, message: err instanceof Error ? err.message : "failed to save edits" });
    } finally {
      setSaving(null);
    }
  }

  async function approveAndSend(id: string) {
    setSending(id);
    setActionError(null);
    try {
      // If the edit fails to save, this throws and we stop here — approve
      // must never fire against stale server-side text the user just edited.
      await persistEdit(id);
      await api.outreach.approve(id);
      await refresh();
    } catch (err) {
      setActionError({ id, message: err instanceof Error ? err.message : "failed to send" });
    } finally {
      setSending(null);
    }
  }

  async function reject(id: string) {
    setRejecting(id);
    setActionError(null);
    try {
      await api.outreach.reject(id);
      await refresh();
    } catch (err) {
      setActionError({ id, message: err instanceof Error ? err.message : "failed to reject" });
    } finally {
      setRejecting(null);
    }
  }

  return (
    <>
      <Link to="/" className="back-link">
        &lt;&lt; back
      </Link>
      <h1 className="app-title" style={{ color: "var(--accent-outreach)" }}>
        Outreach
      </h1>

      {loading ? (
        <p className="muted">loading...</p>
      ) : configured === false ? (
        <div className="pixel-panel section">
          <p>Outreach storage isn't configured yet.</p>
          <p className="muted">Add AZURE_STORAGE_CONNECTION_STRING to backend/.env (see README), then restart the backend.</p>
        </div>
      ) : (
        <>
          {error && <p className="muted">error: {error}</p>}

          <div className="row section">
            <button className="pixel-btn" onClick={() => refresh()}>
              Refresh
            </button>
          </div>

          {drafts.length === 0 ? (
            <p className="muted">No drafts waiting for review. Run the lead-gen agent from Azure Jobs to generate some.</p>
          ) : (
            <ul className="list">
              {drafts.map((d) => {
                const edit = edits[d.rowKey] ?? { subject: d.emailSubject, body: d.emailBody };
                const dirty = edit.subject !== d.emailSubject || edit.body !== d.emailBody;
                return (
                  <li key={d.rowKey} className="list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                    <div>
                      <div>
                        {d.companyName} &middot; <span className="muted">{d.companyDomain}</span>
                      </div>
                      <div className="muted">
                        {d.contactName ? `${d.contactName}${d.contactTitle ? `, ${d.contactTitle}` : ""} — ` : ""}
                        {d.contactEmail}
                      </div>
                      <div className="muted">why: {d.researchSummary}</div>
                    </div>

                    <input
                      className="pixel-input"
                      value={edit.subject}
                      onChange={(e) => setEdit(d.rowKey, "subject", e.target.value)}
                      placeholder="subject"
                    />
                    <textarea
                      className="pixel-input"
                      rows={8}
                      value={edit.body}
                      onChange={(e) => setEdit(d.rowKey, "body", e.target.value)}
                      style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
                    />

                    {actionError?.id === d.rowKey && <div className="muted">error: {actionError.message}</div>}

                    <div className="row">
                      <button
                        className="pixel-btn"
                        disabled={!dirty || saving === d.rowKey}
                        onClick={() => saveEdit(d.rowKey)}
                      >
                        {saving === d.rowKey ? "Saving..." : "Save edits"}
                      </button>
                      <button
                        className="pixel-btn pixel-btn--accent"
                        disabled={sending === d.rowKey}
                        onClick={() => approveAndSend(d.rowKey)}
                      >
                        {sending === d.rowKey ? "Sending..." : "Approve & send"}
                      </button>
                      <button
                        className="pixel-btn"
                        disabled={rejecting === d.rowKey}
                        onClick={() => reject(d.rowKey)}
                      >
                        {rejecting === d.rowKey ? "Rejecting..." : "Reject"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </>
  );
}

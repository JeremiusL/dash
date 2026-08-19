import { useEffect, useState } from "react";
import { api } from "../api";
import type { OutreachTemplate } from "../api";

const TOKEN_LEGEND = [
  ["{{manager_name}}", "contact's name (greeting drops to \"Hi,\" if none on file)"],
  ["{{company_name}}", "prospect company's name"],
  ["{{example_detail}}", "short detail pulled from the scraped site text"],
  ["{{demo_link}}", "demo video URL (only template 2 uses this)"],
] as const;

function newTemplateId(existing: OutreachTemplate[]): string {
  let n = existing.length + 1;
  const ids = new Set(existing.map((t) => t.id));
  while (ids.has(`t${n}`)) n++;
  return `t${n}`;
}

export function OutreachConfig() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sicCodes, setSicCodes] = useState<string[]>([]);
  const [savedSicCodes, setSavedSicCodes] = useState<string[]>([]);
  const [newCode, setNewCode] = useState("");
  const [sicError, setSicError] = useState<string | null>(null);
  const [savingSic, setSavingSic] = useState(false);

  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [savedTemplates, setSavedTemplates] = useState<OutreachTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [savingTemplates, setSavingTemplates] = useState(false);

  function load() {
    setError(null);
    return api.outreachConfig
      .get()
      .then((summary) => {
        setConfigured(summary.configured);
        setSicCodes(summary.sicCodes);
        setSavedSicCodes(summary.sicCodes);
        setTemplates(summary.templates);
        setSavedTemplates(summary.templates);
        if (summary.error) setError(summary.error);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "failed to load outreach config"));
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  function addCode() {
    const code = newCode.trim();
    setSicError(null);
    if (!/^\d{5}$/.test(code)) {
      setSicError("SIC codes are 5 digits, e.g. 46900");
      return;
    }
    if (sicCodes.includes(code)) {
      setNewCode("");
      return;
    }
    setSicCodes([...sicCodes, code]);
    setNewCode("");
  }

  function removeCode(code: string) {
    setSicCodes(sicCodes.filter((c) => c !== code));
  }

  const sicDirty = JSON.stringify([...sicCodes].sort()) !== JSON.stringify([...savedSicCodes].sort());

  async function saveSicCodes() {
    setSavingSic(true);
    setSicError(null);
    try {
      const result = await api.outreachConfig.updateSicCodes(sicCodes);
      if (!result.success) throw new Error(result.error ?? "failed to save");
      setSavedSicCodes(sicCodes);
    } catch (err) {
      setSicError(err instanceof Error ? err.message : "failed to save SIC codes");
    } finally {
      setSavingSic(false);
    }
  }

  function updateTemplate(id: string, patch: Partial<OutreachTemplate>) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function addTemplate() {
    const id = newTemplateId(templates);
    setTemplates((prev) => [
      ...prev,
      { id, label: `Template ${id}`, subject: "", body: "", weight: 0, active: false },
    ]);
  }

  function removeTemplate(id: string) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  const templatesDirty = JSON.stringify(templates) !== JSON.stringify(savedTemplates);
  const activeWeightTotal = templates.filter((t) => t.active && t.weight > 0).reduce((sum, t) => sum + t.weight, 0);

  async function saveTemplates() {
    setSavingTemplates(true);
    setTemplatesError(null);
    try {
      if (templates.length === 0) throw new Error("at least one template is required");
      const result = await api.outreachConfig.updateTemplates(templates);
      if (!result.success) throw new Error(result.error ?? "failed to save");
      setSavedTemplates(templates);
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : "failed to save templates");
    } finally {
      setSavingTemplates(false);
    }
  }

  if (loading) return <p className="muted">loading config...</p>;
  if (configured === false) {
    return (
      <div className="pixel-panel section">
        <p>Outreach config isn't configured yet.</p>
        <p className="muted">Add AZURE_STORAGE_CONNECTION_STRING to backend/.env (see README), then restart the backend.</p>
      </div>
    );
  }

  return (
    <>
      {error && <p className="muted section">error: {error}</p>}

      <div className="pixel-panel section">
        <h2 style={{ marginTop: 0 }}>Targeting - SIC codes</h2>
        <p className="muted">
          Companies House SIC codes the local pipeline searches (stage 1). Takes effect on the next local run.
        </p>
        <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
          {sicCodes.map((code) => (
            <span key={code} className="pixel-input" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px" }}>
              {code}
              <button
                className="pixel-btn"
                style={{ padding: "0 6px" }}
                onClick={() => removeCode(code)}
                aria-label={`remove ${code}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
        <div className="row section">
          <input
            className="pixel-input"
            placeholder="e.g. 46900"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addCode();
            }}
            style={{ width: 120 }}
          />
          <button className="pixel-btn" onClick={addCode}>
            Add code
          </button>
          <button className="pixel-btn pixel-btn--accent" disabled={!sicDirty || savingSic} onClick={saveSicCodes}>
            {savingSic ? "Saving..." : "Save SIC codes"}
          </button>
        </div>
        {sicError && <p className="muted">error: {sicError}</p>}
      </div>

      <div className="pixel-panel section">
        <h2 style={{ marginTop: 0 }}>Templates</h2>
        <p className="muted">
          Stage 6 fills one of these per contact (weighted random by "weight" among active templates) - it does not
          write its own copy. Available tokens:
        </p>
        <ul className="list" style={{ marginBottom: 12 }}>
          {TOKEN_LEGEND.map(([token, desc]) => (
            <li key={token} className="muted">
              <code>{token}</code> - {desc}
            </li>
          ))}
        </ul>
        <p className="muted">
          Active weight total: {activeWeightTotal || 0}
          {activeWeightTotal > 0 &&
            " (" +
              templates
                .filter((t) => t.active && t.weight > 0)
                .map((t) => `${t.id}: ${Math.round((t.weight / activeWeightTotal) * 100)}%`)
                .join(", ") +
              ")"}
        </p>

        <ul className="list">
          {templates.map((t) => (
            <li key={t.id} className="list-item" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <input
                  className="pixel-input"
                  value={t.label}
                  onChange={(e) => updateTemplate(t.id, { label: e.target.value })}
                  style={{ flex: 1 }}
                />
                <label className="row" style={{ gap: 4 }}>
                  <input type="checkbox" checked={t.active} onChange={(e) => updateTemplate(t.id, { active: e.target.checked })} />
                  active
                </label>
                <input
                  className="pixel-input"
                  type="number"
                  min={0}
                  value={t.weight}
                  onChange={(e) => updateTemplate(t.id, { weight: Number(e.target.value) })}
                  style={{ width: 70 }}
                  aria-label="weight"
                />
                <button className="pixel-btn" onClick={() => removeTemplate(t.id)} disabled={templates.length <= 1}>
                  Remove
                </button>
              </div>
              <input
                className="pixel-input"
                placeholder="subject"
                value={t.subject}
                onChange={(e) => updateTemplate(t.id, { subject: e.target.value })}
              />
              <textarea
                className="pixel-input"
                rows={8}
                value={t.body}
                onChange={(e) => updateTemplate(t.id, { body: e.target.value })}
                style={{ width: "100%", resize: "vertical", fontFamily: "inherit" }}
              />
              {t.body.includes("{{demo_link}}") && (
                <input
                  className="pixel-input"
                  placeholder="demo video URL"
                  value={t.demoLink ?? ""}
                  onChange={(e) => updateTemplate(t.id, { demoLink: e.target.value })}
                />
              )}
            </li>
          ))}
        </ul>

        <div className="row section">
          <button className="pixel-btn" onClick={addTemplate}>
            Add template
          </button>
          <button className="pixel-btn pixel-btn--accent" disabled={!templatesDirty || savingTemplates} onClick={saveTemplates}>
            {savingTemplates ? "Saving..." : "Save templates"}
          </button>
        </div>
        {templatesError && <p className="muted">error: {templatesError}</p>}
      </div>
    </>
  );
}

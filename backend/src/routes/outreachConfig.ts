import { Router } from "express";
import { RestError } from "@azure/data-tables";
import { getConfigTable, isConfigured as isTableConfigured } from "../azureTables.js";

export const outreachConfigRouter = Router();

const PARTITION_KEY = "config";

export interface TemplateConfig {
  id: string;
  label: string;
  subject: string;
  body: string;
  weight: number;
  active: boolean;
  demoLink?: string;
}

// Default UK wholesale trade SIC codes (SIC 2007 division 46, classes
// 462-469 - businesses that actually hold and resell stock), excluding the
// 461xx "agents" subclasses (commission agents/brokers who don't run an
// internal order system, so don't fit the templates' framing). Mirrors
// outreach-agent/config/icp.yaml's fallback list - this is the seed used
// the first time this table is read, and the fallback outreach-agent uses
// locally if this table isn't reachable.
const DEFAULT_SIC_CODES = [
  "46210", "46220", "46230", "46240", "46310", "46320", "46330", "46341", "46342", "46350",
  "46360", "46370", "46380", "46390", "46410", "46420", "46431", "46439", "46440", "46450",
  "46460", "46470", "46480", "46491", "46499", "46510", "46520", "46610", "46620", "46630",
  "46640", "46650", "46660", "46690", "46711", "46719", "46720", "46730", "46740", "46750",
  "46760", "46770", "46900",
];

// Mirrors outreach-agent/stages/s6_draft.py's DEFAULT_TEMPLATES exactly -
// keep the two in sync if you change wording here. These are the four
// templates from context/fluia-outreach-brief.md, tokenized so their
// bracketed blanks can be filled per contact. Editing here is the "STRICTLY
// TO BE USED" copy - the local pipeline stops writing its own copy and only
// fills these tokens: {{manager_name}}, {{company_name}}, {{example_detail}}
// (a scraped-site detail, pulled by the local model), {{demo_link}}.
const DEFAULT_TEMPLATES: TemplateConfig[] = [
  {
    id: "t1",
    label: "Template 1 - direct demo ask",
    subject: "A quick idea for {{company_name}}",
    body:
      "Dear Mr./Ms. {{manager_name}},\n\n" +
      "We noticed that wholesalers of {{company_name}}'s size still take orders by phone and email " +
      "and then re-key each one into an internal system ({{example_detail}}).\n\n" +
      "We also noticed that this typically leads to mistakes carried forward to other systems that " +
      "typically don't speak to each other.\n\n" +
      "We created an AI agent that solves this problem. Would you like to see a demo video?\n\n" +
      "Best regards,\nJeremy and Theo\n\nfluia.co\nhttps://fluia.co/contact\ncontact@fluia.co",
    weight: 40,
    active: true,
  },
  {
    id: "t2",
    label: "Template 2 - demo video + market research ask",
    subject: "A 60 second demo, and a quick favour to ask",
    body:
      "Dear Mr./Ms. {{manager_name}},\n\n" +
      "We noticed that wholesalers of {{company_name}} size still take orders by phone/email and then " +
      "re-key each one into an internal system ({{example_detail}}).\n\n" +
      "Here's a 60 second demo of an agent we created to solve this problem: {{demo_link}}\n\n" +
      "As part of our market research efforts, we're looking for experts of the industry to speak with " +
      "on the subject of AI adoption.\n\n" +
      "Would you be willing to participate?\n\n" +
      "Best regards,\nJeremy and Theo\n\nBook a call: https://fluia.co/contact\n" +
      "Email: contact@fluia.co\nWebsite: fluia.co",
    // Inactive by default - no real demo video link exists yet. Fill in
    // demoLink and flip active on once there is one.
    weight: 0,
    active: false,
    demoLink: "",
  },
  {
    id: "t3",
    label: "Template 3 - direct demo ask, agent-drafted disclosure",
    subject: "Found your details, drafted this with an agent",
    body:
      "Dear Mr./Ms. {{manager_name}},\n\n" +
      "We noticed that wholesalers of {{company_name}}'s size still take orders by phone and email " +
      "and then re-key each one into an internal system ({{example_detail}}).\n\n" +
      "We created an AI agent that solves this problem. Would you like to see a demo?\n\n" +
      "P.S. Our outreach agent found your company details and contact information and drafted this " +
      "email on its own. If you'd like to see a demo of that agent too, let us know!\n\n" +
      "Best regards,\nJeremy and Theo\n\nfluia.co\nhttps://fluia.co/contact\ncontact@fluia.co",
    weight: 30,
    active: true,
  },
  {
    id: "t4",
    label: "Template 4 - market research / opinion ask",
    subject: "Quick question for someone in wholesale",
    body:
      "Dear Mr./Ms. {{manager_name}},\n\n" +
      "We are fluia.co, a company of two university graduates trying to help SMEs adopt AI.\n\n" +
      "As part of our market research in the wholesale industry, we're looking for expert opinions " +
      "and advice from professionals such as yourself.\n\n" +
      "Would you be interested in giving us your opinion?\n\n" +
      "Best regards,\nJeremy and Theo\n\nfluia.co\nhttps://fluia.co/contact\ncontact@fluia.co",
    weight: 30,
    active: true,
  },
];

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

function isAlreadyExists(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 409;
}

async function ensureConfigTable(): Promise<void> {
  try {
    await getConfigTable().createTable();
  } catch (err) {
    if (!isAlreadyExists(err)) throw err;
  }
}

async function readSicCodes(): Promise<string[]> {
  const table = getConfigTable();
  try {
    const entity = await table.getEntity<{ sicCodes: string }>(PARTITION_KEY, "icp");
    const codes = JSON.parse(entity.sicCodes) as string[];
    return Array.isArray(codes) && codes.length > 0 ? codes : DEFAULT_SIC_CODES;
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await ensureConfigTable();
    await table.upsertEntity(
      { partitionKey: PARTITION_KEY, rowKey: "icp", sicCodes: JSON.stringify(DEFAULT_SIC_CODES), updatedAt: new Date().toISOString() },
      "Replace"
    );
    return DEFAULT_SIC_CODES;
  }
}

async function readTemplates(): Promise<TemplateConfig[]> {
  const table = getConfigTable();
  try {
    const entity = await table.getEntity<{ templates: string }>(PARTITION_KEY, "templates");
    const templates = JSON.parse(entity.templates) as TemplateConfig[];
    return Array.isArray(templates) && templates.length > 0 ? templates : DEFAULT_TEMPLATES;
  } catch (err) {
    if (!isNotFound(err)) throw err;
    await ensureConfigTable();
    await table.upsertEntity(
      { partitionKey: PARTITION_KEY, rowKey: "templates", templates: JSON.stringify(DEFAULT_TEMPLATES), updatedAt: new Date().toISOString() },
      "Replace"
    );
    return DEFAULT_TEMPLATES;
  }
}

outreachConfigRouter.get("/", async (_req, res) => {
  if (!isTableConfigured()) {
    res.json({ configured: false, sicCodes: DEFAULT_SIC_CODES, templates: DEFAULT_TEMPLATES });
    return;
  }
  try {
    const [sicCodes, templates] = await Promise.all([readSicCodes(), readTemplates()]);
    res.json({ configured: true, sicCodes, templates });
  } catch (err) {
    console.error("Failed to load outreach config:", err);
    res.status(502).json({ configured: true, error: "table_fetch_failed", sicCodes: [], templates: [] });
  }
});

// SIC codes: 5-digit numeric strings, as Companies House Advanced Search
// expects them (see outreach-agent's lib/companies_house.py).
const SIC_CODE_PATTERN = /^\d{5}$/;

outreachConfigRouter.put("/sic-codes", async (req, res) => {
  if (!isTableConfigured()) {
    res.status(503).json({ success: false, error: "storage_not_configured" });
    return;
  }
  const { sicCodes } = req.body as { sicCodes?: unknown };
  if (!Array.isArray(sicCodes) || sicCodes.length === 0) {
    res.status(400).json({ success: false, error: "sicCodes must be a non-empty array" });
    return;
  }
  const cleaned = [...new Set(sicCodes.map((c) => String(c).trim()))];
  const invalid = cleaned.filter((c) => !SIC_CODE_PATTERN.test(c));
  if (invalid.length > 0) {
    res.status(400).json({ success: false, error: `sicCodes must each be 5 digits: ${invalid.join(", ")}` });
    return;
  }

  try {
    await ensureConfigTable();
    await getConfigTable().upsertEntity(
      { partitionKey: PARTITION_KEY, rowKey: "icp", sicCodes: JSON.stringify(cleaned), updatedAt: new Date().toISOString() },
      "Replace"
    );
    res.json({ success: true, sicCodes: cleaned });
  } catch (err) {
    console.error("Failed to update outreach SIC codes:", err);
    res.status(502).json({ success: false, error: "table_update_failed" });
  }
});

function isValidTemplate(t: unknown): t is TemplateConfig {
  if (typeof t !== "object" || t === null) return false;
  const template = t as Record<string, unknown>;
  return (
    typeof template.id === "string" &&
    template.id.length > 0 &&
    typeof template.label === "string" &&
    typeof template.subject === "string" &&
    template.subject.length > 0 &&
    typeof template.body === "string" &&
    template.body.length > 0 &&
    typeof template.weight === "number" &&
    Number.isFinite(template.weight) &&
    template.weight >= 0 &&
    typeof template.active === "boolean" &&
    (template.demoLink === undefined || typeof template.demoLink === "string")
  );
}

outreachConfigRouter.put("/templates", async (req, res) => {
  if (!isTableConfigured()) {
    res.status(503).json({ success: false, error: "storage_not_configured" });
    return;
  }
  const { templates } = req.body as { templates?: unknown };
  if (!Array.isArray(templates) || templates.length === 0) {
    res.status(400).json({ success: false, error: "templates must be a non-empty array" });
    return;
  }
  if (!templates.every(isValidTemplate)) {
    res.status(400).json({
      success: false,
      error: "each template needs a non-empty id/subject/body, a numeric weight >= 0, and an active boolean",
    });
    return;
  }
  const ids = templates.map((t) => t.id);
  if (new Set(ids).size !== ids.length) {
    res.status(400).json({ success: false, error: "template ids must be unique" });
    return;
  }

  try {
    await ensureConfigTable();
    await getConfigTable().upsertEntity(
      { partitionKey: PARTITION_KEY, rowKey: "templates", templates: JSON.stringify(templates), updatedAt: new Date().toISOString() },
      "Replace"
    );
    res.json({ success: true, templates });
  } catch (err) {
    console.error("Failed to update outreach templates:", err);
    res.status(502).json({ success: false, error: "table_update_failed" });
  }
});

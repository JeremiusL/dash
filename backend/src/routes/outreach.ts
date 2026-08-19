import { execFile } from "node:child_process";
import { Router } from "express";
import { RestError } from "@azure/data-tables";
import { getOutreachTable, isConfigured as isTableConfigured } from "../azureTables.js";
import { isConfigured as isMailConfigured, createDraft } from "../mailer.js";

export const outreachRouter = Router();

const PARTITION_KEY = "draft";

// "sent" stays a valid status for schema compatibility with the shared table
// contract (see outreach-agent's lib/dash_sync.py) even though nothing here
// writes it anymore - approve only ever produces "drafted" now.
type DraftStatus = "pending_review" | "drafting" | "drafted" | "sent" | "rejected";
const VALID_STATUSES: DraftStatus[] = ["pending_review", "drafting", "drafted", "sent", "rejected"];

interface DraftEntity {
  partitionKey: string;
  rowKey: string;
  companyName: string;
  companyDomain: string;
  companyCountry: string;
  employeeCount?: number;
  contactName?: string;
  contactTitle?: string;
  contactEmail: string;
  researchSummary: string;
  emailSubject: string;
  emailBody: string;
  templateId?: string;
  templateLabel?: string;
  status: DraftStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  draftedAt?: string;
  source: string;
  etag?: string;
}

function isNotFound(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 404;
}

function isPreconditionFailed(err: unknown): boolean {
  return err instanceof RestError && err.statusCode === 412;
}

function isSyncConfigured(): boolean {
  return Boolean(process.env.OUTREACH_AGENT_DIR);
}

outreachRouter.get("/", async (req, res) => {
  if (!isTableConfigured()) {
    res.json({ configured: false, drafts: [], syncConfigured: isSyncConfigured() });
    return;
  }

  // status comes from the query string, so it must be checked against a fixed
  // allowlist before going into the OData filter string below — building the
  // filter from an unvalidated value would let a caller inject arbitrary
  // OData and read rows outside the intended status.
  const rawStatus = typeof req.query.status === "string" ? req.query.status : "pending_review";
  if (!VALID_STATUSES.includes(rawStatus as DraftStatus)) {
    res.status(400).json({ configured: true, error: `status must be one of: ${VALID_STATUSES.join(", ")}`, drafts: [] });
    return;
  }
  const status: DraftStatus = rawStatus as DraftStatus;

  try {
    const table = getOutreachTable();
    const drafts: DraftEntity[] = [];
    for await (const entity of table.listEntities<DraftEntity>({
      queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}' and status eq '${status}'` },
    })) {
      drafts.push(entity);
    }
    drafts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ configured: true, drafts, syncConfigured: isSyncConfigured() });
  } catch (err) {
    console.error("Failed to list outreach drafts:", err);
    res.status(502).json({ configured: true, error: "table_fetch_failed", drafts: [] });
  }
});

outreachRouter.patch("/:id", async (req, res) => {
  if (!isTableConfigured()) {
    res.status(503).json({ success: false, error: "storage_not_configured" });
    return;
  }

  const { emailSubject, emailBody } = req.body as { emailSubject?: string; emailBody?: string };
  if (emailSubject === undefined && emailBody === undefined) {
    res.status(400).json({ success: false, error: "emailSubject or emailBody is required" });
    return;
  }

  try {
    const table = getOutreachTable();
    const existing = await table.getEntity<DraftEntity>(PARTITION_KEY, req.params.id);
    if (existing.status === "sent" || existing.status === "drafted") {
      res.status(409).json({ success: false, error: `cannot edit a draft that's already "${existing.status}" - editing here wouldn't change the Gmail draft` });
      return;
    }

    await table.updateEntity(
      {
        partitionKey: PARTITION_KEY,
        rowKey: req.params.id,
        ...(emailSubject !== undefined ? { emailSubject } : {}),
        ...(emailBody !== undefined ? { emailBody } : {}),
        updatedAt: new Date().toISOString(),
      },
      "Merge"
    );
    res.json({ success: true });
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ success: false, error: "draft_not_found" });
      return;
    }
    console.error(`Failed to update outreach draft "${req.params.id}":`, err);
    res.status(502).json({ success: false, error: "table_update_failed" });
  }
});

outreachRouter.post("/:id/approve", async (req, res) => {
  if (!isTableConfigured()) {
    res.status(503).json({ success: false, error: "storage_not_configured" });
    return;
  }
  if (!isMailConfigured()) {
    res.status(503).json({ success: false, error: "mail_not_configured" });
    return;
  }

  const table = getOutreachTable();

  try {
    const entity = await table.getEntity<DraftEntity>(PARTITION_KEY, req.params.id);
    if (entity.status !== "pending_review") {
      res.status(409).json({ success: false, error: `draft is already "${entity.status}"` });
      return;
    }

    // Claim the draft with an etag-conditional update before touching Gmail.
    // Without this, two near-simultaneous approve clicks (or a client retry)
    // could both pass the status check above and each append a duplicate
    // draft — the etag match makes only one of them win the claim.
    try {
      await table.updateEntity(
        { partitionKey: PARTITION_KEY, rowKey: req.params.id, status: "drafting", updatedAt: new Date().toISOString() },
        "Merge",
        { etag: entity.etag }
      );
    } catch (claimErr) {
      if (isPreconditionFailed(claimErr)) {
        res.status(409).json({ success: false, error: "draft was just modified elsewhere — refresh and try again" });
        return;
      }
      throw claimErr;
    }

    try {
      await createDraft({ to: entity.contactEmail, subject: entity.emailSubject, text: entity.emailBody });
    } catch (draftErr) {
      // Creating the Gmail draft failed — release the claim so the draft is
      // retryable instead of stuck in "drafting".
      await table.updateEntity(
        { partitionKey: PARTITION_KEY, rowKey: req.params.id, status: "pending_review", updatedAt: new Date().toISOString() },
        "Merge"
      );
      throw draftErr;
    }

    const now = new Date().toISOString();
    await table.updateEntity(
      { partitionKey: PARTITION_KEY, rowKey: req.params.id, status: "drafted", draftedAt: now, updatedAt: now },
      "Merge"
    );
    res.json({ success: true });
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ success: false, error: "draft_not_found" });
      return;
    }
    console.error(`Failed to create Gmail draft for outreach draft "${req.params.id}":`, err);
    res.status(502).json({ success: false, error: "draft_failed" });
  }
});

outreachRouter.post("/:id/reject", async (req, res) => {
  if (!isTableConfigured()) {
    res.status(503).json({ success: false, error: "storage_not_configured" });
    return;
  }

  try {
    const table = getOutreachTable();
    const existing = await table.getEntity<DraftEntity>(PARTITION_KEY, req.params.id);
    if (existing.status !== "pending_review") {
      res.status(409).json({ success: false, error: `draft is already "${existing.status}"` });
      return;
    }

    const now = new Date().toISOString();
    await table.updateEntity(
      { partitionKey: PARTITION_KEY, rowKey: req.params.id, status: "rejected", updatedAt: now },
      "Merge"
    );
    res.json({ success: true });
  } catch (err) {
    if (isNotFound(err)) {
      res.status(404).json({ success: false, error: "draft_not_found" });
      return;
    }
    console.error(`Failed to reject outreach draft "${req.params.id}":`, err);
    res.status(502).json({ success: false, error: "table_update_failed" });
  }
});

// Guards against overlapping runs from a double-click — the script isn't
// designed to be run concurrently against the same local sqlite db.
let syncInFlight = false;

outreachRouter.post("/sync", async (_req, res) => {
  const agentDir = process.env.OUTREACH_AGENT_DIR;
  if (!agentDir) {
    res.status(503).json({ success: false, error: "sync_agent_not_configured" });
    return;
  }
  if (syncInFlight) {
    res.status(409).json({ success: false, error: "sync_already_running" });
    return;
  }

  syncInFlight = true;
  execFile(
    "python",
    ["tools/sync_to_dash.py"],
    { cwd: agentDir, timeout: 2 * 60 * 1000 },
    (err, stdout, stderr) => {
      syncInFlight = false;
      if (err) {
        console.error("Failed to run local outreach-agent sync:", err, stderr);
        res.status(502).json({ success: false, error: "sync_failed", output: stdout + stderr });
        return;
      }
      res.json({ success: true, output: stdout });
    }
  );
});

import { Router } from "express";
import { getClient, isConfigured, resourceGroup } from "../azure.js";
import { getCostSummary, getCreditSummary } from "../azureCost.js";

export const jobsRouter = Router();

interface ExecutionDTO {
  name: string;
  status: string;
  startTime: string | null;
  endTime: string | null;
}

interface JobDTO {
  name: string;
  status: string;
  lastRunTime: string | null;
  executions: ExecutionDTO[];
}

jobsRouter.get("/", async (_req, res) => {
  if (!isConfigured()) {
    res.json({ configured: false, jobs: [] });
    return;
  }

  try {
    const client = getClient();
    const rg = resourceGroup();

    const jobs: JobDTO[] = [];
    for await (const job of client.jobs.listByResourceGroup(rg)) {
      if (!job.name) continue;

      const executions: ExecutionDTO[] = [];
      for await (const exec of client.jobsExecutions.list(rg, job.name)) {
        executions.push({
          name: exec.name ?? "",
          status: exec.status ?? "Unknown",
          startTime: exec.startTime ? exec.startTime.toISOString() : null,
          endTime: exec.endTime ? exec.endTime.toISOString() : null,
        });
      }
      executions.sort((a, b) => new Date(b.startTime ?? 0).getTime() - new Date(a.startTime ?? 0).getTime());
      const latest = executions[0];

      jobs.push({
        name: job.name,
        status: latest?.status ?? "Unknown",
        lastRunTime: latest?.startTime ?? null,
        executions: executions.slice(0, 10),
      });
    }

    res.json({ configured: true, jobs });
  } catch (err) {
    console.error("Failed to fetch Azure Container Apps jobs:", err);
    res.status(502).json({ configured: true, error: "azure_fetch_failed", jobs: [] });
  }
});

jobsRouter.get("/costs", async (_req, res) => {
  if (!isConfigured()) {
    res.json({ configured: false });
    return;
  }

  const response: Record<string, unknown> = { configured: true };

  try {
    Object.assign(response, await getCostSummary(process.env.AZURE_SUBSCRIPTION_ID!, resourceGroup()));
  } catch (err) {
    console.error("Failed to fetch Azure resource-group cost data:", err);
    response.error = "azure_cost_fetch_failed";
  }

  try {
    response.credit = await getCreditSummary(process.env.AZURE_SUBSCRIPTION_ID!);
  } catch (err) {
    console.error("Failed to fetch Azure credit balance:", err);
    response.creditError = "azure_credit_fetch_failed";
  }

  res.json(response);
});

jobsRouter.post("/:name/start", async (req, res) => {
  if (!isConfigured()) {
    res.status(503).json({ error: "azure_not_configured" });
    return;
  }

  try {
    const client = getClient();
    const rg = resourceGroup();
    const execution = await client.jobs.beginStartAndWait(rg, req.params.name);
    res.json({ started: true, executionName: execution.name ?? null });
  } catch (err) {
    console.error(`Failed to start Azure Container Apps job "${req.params.name}":`, err);
    res.status(502).json({ started: false, error: "azure_start_failed" });
  }
});

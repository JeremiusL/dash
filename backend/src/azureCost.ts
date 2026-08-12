import { getCredential } from "./azure.js";

interface CostQueryResponse {
  properties: {
    columns: { name: string }[];
    rows: (string | number)[][];
  };
}

let cachedToken: { token: string; expiresOnTimestamp: number } | null = null;

async function getManagementToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresOnTimestamp - 60_000 > Date.now()) {
    return cachedToken.token;
  }
  const result = await getCredential().getToken("https://management.azure.com/.default");
  if (!result) throw new Error("failed to acquire azure management token");
  cachedToken = { token: result.token, expiresOnTimestamp: result.expiresOnTimestamp };
  return result.token;
}

async function postCostQuery(scope: string, body: unknown): Promise<CostQueryResponse> {
  const url = `https://management.azure.com/${scope}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;
  const token = await getManagementToken();
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`cost management query failed: ${res.status} ${errBody.slice(0, 300)}`);
  }
  return res.json() as Promise<CostQueryResponse>;
}

function sumRows(data: CostQueryResponse): { total: number; currency: string; byResource: ResourceCost[] } {
  const columns = data.properties.columns.map((c) => c.name);
  const costIdx = columns.indexOf("Cost");
  const resourceIdx = columns.indexOf("ResourceId");
  const currencyIdx = columns.indexOf("Currency");

  let currency = "USD";
  let total = 0;
  const byResource: ResourceCost[] = [];

  for (const row of data.properties.rows) {
    const cost = Number(row[costIdx]) || 0;
    if (currencyIdx >= 0) currency = String(row[currencyIdx]);
    total += cost;
    if (resourceIdx >= 0) {
      const resourceId = String(row[resourceIdx] ?? "");
      byResource.push({ name: resourceId.split("/").pop() ?? resourceId, cost });
    }
  }
  byResource.sort((a, b) => b.cost - a.cost);
  return { total, currency, byResource };
}

export interface ResourceCost {
  name: string;
  cost: number;
}

// Resource-group-scoped, current-month spend — used for the per-job cost
// breakdown next to each Container Apps Job.
export interface CostSummary {
  currency: string;
  monthToDateCost: number;
  byResource: ResourceCost[];
}

export async function getCostSummary(subscriptionId: string, rg: string): Promise<CostSummary> {
  const data = await postCostQuery(`subscriptions/${subscriptionId}/resourceGroups/${rg}`, {
    type: "ActualCost",
    timeframe: "MonthToDate",
    dataset: {
      granularity: "None",
      aggregation: { totalCost: { name: "Cost", function: "Sum" } },
      grouping: [{ type: "Dimension", name: "ResourceId" }],
    },
  });
  const { total, currency, byResource } = sumRows(data);
  return { currency, monthToDateCost: total, byResource };
}

function dayBoundsUTC(d: Date, endOfDay: boolean): string {
  const h = endOfDay ? 23 : 0;
  const m = endOfDay ? 59 : 0;
  const s = endOfDay ? 59 : 0;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, m, s)).toISOString();
}

// Subscription-wide spend since a fixed start date — used to track a
// credit-based subscription (e.g. Azure for Students' one-time credit,
// which spans every resource group, not just the dashboard's).
export interface CreditSummary {
  currency: string;
  total: number;
  spent: number;
  remaining: number;
  percentUsed: number;
  startDate: string;
  expiresAt: string;
  daysRemaining: number;
}

export async function getCreditSummary(subscriptionId: string): Promise<CreditSummary | null> {
  const startDateEnv = process.env.AZURE_CREDIT_START_DATE;
  if (!startDateEnv) return null;

  const startDate = new Date(startDateEnv);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error(`invalid AZURE_CREDIT_START_DATE: ${startDateEnv}`);
  }

  const total = Number(process.env.AZURE_CREDIT_AMOUNT ?? "100");
  const months = Number(process.env.AZURE_CREDIT_MONTHS ?? "12");
  const expiresAt = new Date(startDate);
  expiresAt.setUTCMonth(expiresAt.getUTCMonth() + months);

  const today = new Date();
  const data = await postCostQuery(`subscriptions/${subscriptionId}`, {
    type: "ActualCost",
    timeframe: "Custom",
    timePeriod: { from: dayBoundsUTC(startDate, false), to: dayBoundsUTC(today, true) },
    dataset: {
      granularity: "None",
      aggregation: { totalCost: { name: "Cost", function: "Sum" } },
    },
  });
  const { total: spent, currency } = sumRows(data);

  const remaining = total - spent;
  const percentUsed = total > 0 ? (spent / total) * 100 : 0;
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - today.getTime()) / 86_400_000));

  return {
    currency,
    total,
    spent,
    remaining,
    percentUsed,
    startDate: startDate.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
  };
}

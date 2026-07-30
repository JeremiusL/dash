import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROFILE_DIR = path.join(__dirname, "..", "data", "claude-browser-profile");

let loginInFlight: Promise<void> | null = null;

interface OrgUsage {
  member_dashboard_available: boolean;
  limits: Array<{
    group: string;
    kind: string;
    percent: number;
    resets_at: string;
    is_active: boolean;
  }>;
  spend?: {
    enabled: boolean;
    percent: number;
    used: { amount_minor: number; currency: string; exponent: number };
    limit: { amount_minor: number; currency: string; exponent: number } | null;
  };
}

export interface AccountUsageSummary {
  loggedIn: true;
  planName: string | null;
  session: { percent: number; resetsAt: string } | null;
  weekly: { percent: number; resetsAt: string } | null;
  credits: { enabled: boolean; percent: number; used: number; limit: number; currency: string } | null;
}

async function launchContext(headless: boolean, viewport: { width: number; height: number }) {
  const baseOptions = {
    headless,
    viewport,
    args: ["--disable-blink-features=AutomationControlled"] as string[],
    ignoreDefaultArgs: ["--enable-automation"] as string[],
  };
  try {
    // Prefer the real, installed Chrome — Playwright's bundled Chromium build gets
    // fingerprinted and stuck in a loop by Cloudflare's bot challenge.
    return await chromium.launchPersistentContext(PROFILE_DIR, { ...baseOptions, channel: "chrome" });
  } catch {
    return await chromium.launchPersistentContext(PROFILE_DIR, baseOptions);
  }
}

async function withPersistentContext<T>(headless: boolean, fn: (context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>) => Promise<T>): Promise<T> {
  const context = await launchContext(headless, { width: 1200, height: 900 });
  try {
    return await fn(context);
  } finally {
    await context.close();
  }
}

async function isLoggedIn(context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>): Promise<boolean> {
  const res = await context.request.get("https://claude.ai/api/organizations");
  return res.ok();
}

export async function getLoginStatus(): Promise<{ loggedIn: boolean }> {
  try {
    return { loggedIn: await withPersistentContext(true, isLoggedIn) };
  } catch {
    return { loggedIn: false };
  }
}

/** Opens a real, visible browser window for the user to log into claude.ai. Resolves once login succeeds or the window is closed. */
export async function startLogin(): Promise<void> {
  if (loginInFlight) return loginInFlight;

  loginInFlight = (async () => {
    const context = await launchContext(false, { width: 1100, height: 850 });
    try {
      const page = context.pages()[0] ?? (await context.newPage());
      await page.goto("https://claude.ai/login");

      const deadline = Date.now() + 5 * 60_000;
      while (Date.now() < deadline) {
        if (await isLoggedIn(context)) return;
        if (context.pages().length === 0) return;
        await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      await context.close();
    }
  })();

  try {
    await loginInFlight;
  } finally {
    loginInFlight = null;
  }
}

export async function getAccountUsage(): Promise<AccountUsageSummary | { loggedIn: false }> {
  return withPersistentContext(true, async (context) => {
    const orgsRes = await context.request.get("https://claude.ai/api/organizations");
    if (!orgsRes.ok()) return { loggedIn: false };
    const orgs = (await orgsRes.json()) as Array<{ uuid: string; name: string }>;

    for (const org of orgs) {
      const usageRes = await context.request.get(`https://claude.ai/api/organizations/${org.uuid}/usage`);
      if (!usageRes.ok()) continue;
      const usage = (await usageRes.json()) as OrgUsage;
      if (!usage.limits || usage.limits.length === 0) continue;

      const session = usage.limits.find((l) => l.kind === "session");
      const weekly = usage.limits.find((l) => l.kind === "weekly_all");

      return {
        loggedIn: true,
        planName: org.name,
        session: session ? { percent: session.percent, resetsAt: session.resets_at } : null,
        weekly: weekly ? { percent: weekly.percent, resetsAt: weekly.resets_at } : null,
        credits:
          usage.spend && usage.spend.enabled && usage.spend.limit
            ? {
                enabled: true,
                percent: usage.spend.percent,
                used: usage.spend.used.amount_minor / 10 ** usage.spend.used.exponent,
                limit: usage.spend.limit.amount_minor / 10 ** usage.spend.limit.exponent,
                currency: usage.spend.used.currency,
              }
            : null,
      };
    }

    return { loggedIn: false };
  });
}

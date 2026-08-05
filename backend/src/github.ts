import sodium from "libsodium-wrappers";

const API_BASE = "https://api.github.com";

export function isConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface WorkflowRun {
  id: number;
  status: string | null;
  conclusion: string | null;
  created_at: string;
  html_url: string;
}

export async function dispatchWorkflow(
  owner: string,
  repo: string,
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`,
    { method: "POST", headers: headers(), body: JSON.stringify({ ref, inputs }) }
  );
  if (!res.ok) {
    throw new Error(`GitHub workflow dispatch failed (${res.status}): ${await res.text()}`);
  }
}

// GitHub's dispatch endpoint doesn't return a run id, so we look for the newest
// matching run created after we dispatched, then poll it until it finishes.
export async function waitForWorkflowRun(
  owner: string,
  repo: string,
  workflowFile: string,
  dispatchedAfter: number,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<WorkflowRun> {
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const pollIntervalMs = options.pollIntervalMs ?? 5000;
  const deadline = Date.now() + timeoutMs;

  let runId: number | null = null;

  while (Date.now() < deadline) {
    if (runId === null) {
      const res = await fetch(
        `${API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowFile}/runs?event=workflow_dispatch&per_page=5`,
        { headers: headers() }
      );
      if (!res.ok) throw new Error(`Failed to list workflow runs (${res.status}): ${await res.text()}`);
      const data = (await res.json()) as { workflow_runs: WorkflowRun[] };
      const match = data.workflow_runs.find((r) => new Date(r.created_at).getTime() >= dispatchedAfter);
      if (match) runId = match.id;
    } else {
      const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}`, { headers: headers() });
      if (!res.ok) throw new Error(`Failed to fetch workflow run (${res.status}): ${await res.text()}`);
      const run = (await res.json()) as WorkflowRun;
      if (run.status === "completed") return run;
    }
    await sleep(pollIntervalMs);
  }

  throw new Error("Timed out waiting for the GitHub Actions run to finish");
}

export async function getAuthenticatedLogin(): Promise<string> {
  const res = await fetch(`${API_BASE}/user`, { headers: headers() });
  if (!res.ok) throw new Error(`Failed to fetch authenticated GitHub user (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { login: string };
  return data.login;
}

export async function createRepo(name: string): Promise<{ owner: string; repo: string; defaultBranch: string }> {
  const res = await fetch(`${API_BASE}/user/repos`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ name, private: true, auto_init: false }),
  });
  if (!res.ok) throw new Error(`Failed to create GitHub repo "${name}" (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { owner: { login: string }; name: string; default_branch: string };
  return { owner: data.owner.login, repo: data.name, defaultBranch: data.default_branch };
}

// Creates the repo if it doesn't exist yet; otherwise reuses it. Lets callers
// treat a shared "bucket" repo (e.g. one repo holding several agents in
// subdirectories) as idempotent infrastructure rather than one-shot setup.
export async function ensureRepo(name: string): Promise<{ owner: string; repo: string; created: boolean }> {
  const owner = await getAuthenticatedLogin();
  const getRes = await fetch(`${API_BASE}/repos/${owner}/${name}`, { headers: headers() });
  if (getRes.ok) {
    return { owner, repo: name, created: false };
  }
  if (getRes.status !== 404) {
    throw new Error(`Failed to check for GitHub repo "${name}" (${getRes.status}): ${await getRes.text()}`);
  }
  const created = await createRepo(name);
  return { owner: created.owner, repo: created.repo, created: true };
}

// Creates or updates a file at `path`, fetching its current sha first if it
// already exists (the Contents API requires the sha to update, not create).
export async function upsertFile(
  owner: string,
  repo: string,
  path: string,
  content: Buffer,
  message: string
): Promise<void> {
  let sha: string | undefined;
  const getRes = await fetch(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers: headers() });
  if (getRes.ok) {
    const existing = (await getRes.json()) as { sha: string };
    sha = existing.sha;
  }

  const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ message, content: content.toString("base64"), ...(sha ? { sha } : {}) }),
  });
  if (!res.ok) throw new Error(`Failed to push "${path}" to ${owner}/${repo} (${res.status}): ${await res.text()}`);
}

// GitHub Actions secrets must be encrypted client-side with the repo's public key
// (libsodium sealed box) before being sent to the API — plaintext isn't accepted.
export async function setRepoSecret(owner: string, repo: string, secretName: string, value: string): Promise<void> {
  const keyRes = await fetch(`${API_BASE}/repos/${owner}/${repo}/actions/secrets/public-key`, { headers: headers() });
  if (!keyRes.ok) throw new Error(`Failed to fetch public key for ${owner}/${repo} (${keyRes.status}): ${await keyRes.text()}`);
  const { key, key_id } = (await keyRes.json()) as { key: string; key_id: string };

  await sodium.ready;
  const encryptedBytes = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
  const encryptedValue = sodium.to_base64(encryptedBytes, sodium.base64_variants.ORIGINAL);

  const res = await fetch(`${API_BASE}/repos/${owner}/${repo}/actions/secrets/${secretName}`, {
    method: "PUT",
    headers: headers(),
    body: JSON.stringify({ encrypted_value: encryptedValue, key_id }),
  });
  if (!res.ok) throw new Error(`Failed to set secret "${secretName}" on ${owner}/${repo} (${res.status}): ${await res.text()}`);
}

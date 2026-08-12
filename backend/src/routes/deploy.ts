import { Router } from "express";
import multer from "multer";
import type { EnvironmentVar, Job } from "@azure/arm-appcontainers";
import { getClient, isConfigured as isAzureConfigured, resourceGroup } from "../azure.js";
import {
  dispatchWorkflow,
  ensureRepo,
  isConfigured as isGithubConfigured,
  setRepoSecret,
  upsertFile,
  waitForWorkflowRun,
} from "../github.js";

export const deployRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 } });

// Two shared repos agents get filed into (as subdirectories), selectable from the UI.
const AGENT_BUCKETS: Record<string, string> = {
  test: "agent-test",
  personal: "personal-agents",
};

// Backend .env vars agents are allowed to request as secrets, so a deployed
// container can e.g. send email without the browser ever seeing the password.
const ALLOWED_JOB_SECRET_ENV = [
  "GMAIL_USER",
  "GMAIL_APP_PASSWORD",
  "AZURE_STORAGE_CONNECTION_STRING",
  "ANTHROPIC_API_KEY",
  "APOLLO_API_KEY",
];

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function defaultDockerfile(): string {
  return [
    "FROM python:3.12-slim",
    "WORKDIR /app",
    "COPY requirements.tx[t] .",
    "RUN [ -f requirements.txt ] && pip install --no-cache-dir -r requirements.txt || true",
    "COPY . .",
    'CMD ["python", "main.py"]',
    "",
  ].join("\n");
}

// Shared across every agent in a bucket repo: the docker build context and
// image name are driven by which subdirectory (agent_path) we dispatch for.
function buildWorkflowYaml(): string {
  return [
    "name: build-and-push",
    "on:",
    "  workflow_dispatch:",
    "    inputs:",
    "      agent_path:",
    '        description: "Subdirectory containing the agent\'s Dockerfile"',
    "        required: true",
    "      image_tag:",
    '        description: "Tag to build and push"',
    "        required: false",
    "        default: v1",
    "",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: docker/login-action@v3",
    "        with:",
    "          registry: jeremylo.azurecr.io",
    "          username: ${{ secrets.ACR_USERNAME }}",
    "          password: ${{ secrets.ACR_PASSWORD }}",
    "      - uses: docker/build-push-action@v6",
    "        with:",
    "          context: ${{ github.event.inputs.agent_path }}",
    "          push: true",
    "          tags: jeremylo.azurecr.io/${{ github.event.inputs.agent_path }}:${{ github.event.inputs.image_tag || 'v1' }}",
    "",
  ].join("\n");
}

deployRouter.get("/buckets", (_req, res) => {
  res.json({ buckets: Object.entries(AGENT_BUCKETS).map(([key, repo]) => ({ key, repo })) });
});

deployRouter.post("/repo", upload.array("files", 20), async (req, res) => {
  if (!isGithubConfigured()) {
    res.status(503).json({ success: false, error: "github_not_configured" });
    return;
  }
  if (!process.env.ACR_USERNAME || !process.env.ACR_PASSWORD) {
    res.status(503).json({ success: false, error: "acr_not_configured" });
    return;
  }

  const agentName = typeof req.body?.agentName === "string" ? req.body.agentName : "";
  const bucketKey = typeof req.body?.bucket === "string" ? req.body.bucket : "";
  const repoName = AGENT_BUCKETS[bucketKey];
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const slug = slugify(agentName);

  if (!repoName) {
    res.status(400).json({ success: false, error: `bucket must be one of: ${Object.keys(AGENT_BUCKETS).join(", ")}` });
    return;
  }
  if (!slug) {
    res.status(400).json({ success: false, error: "agentName is required" });
    return;
  }
  if (files.length === 0) {
    res.status(400).json({ success: false, error: "at least one file is required" });
    return;
  }

  const hasDockerfile = files.some((f) => f.originalname === "Dockerfile");
  const hasMainPy = files.some((f) => f.originalname === "main.py");
  if (!hasDockerfile && !hasMainPy) {
    res
      .status(400)
      .json({ success: false, error: "uploaded files must include a Dockerfile, or a main.py we can wrap in one" });
    return;
  }

  try {
    const { owner, repo, created } = await ensureRepo(repoName);

    if (created) {
      await upsertFile(owner, repo, ".github/workflows/build.yml", Buffer.from(buildWorkflowYaml()), "Add build-and-push workflow");
      await setRepoSecret(owner, repo, "ACR_USERNAME", process.env.ACR_USERNAME);
      await setRepoSecret(owner, repo, "ACR_PASSWORD", process.env.ACR_PASSWORD);
    }

    for (const file of files) {
      await upsertFile(owner, repo, `${slug}/${file.originalname}`, file.buffer, `Add ${slug}/${file.originalname}`);
    }
    if (!hasDockerfile) {
      await upsertFile(owner, repo, `${slug}/Dockerfile`, Buffer.from(defaultDockerfile()), `Add default Dockerfile for ${slug}`);
    }

    res.json({
      success: true,
      repo: `${owner}/${repo}`,
      workflowFile: "build.yml",
      agentPath: slug,
      imageName: slug,
      suggestedJobName: slug,
    });
  } catch (err) {
    console.error(`Failed to add agent "${slug}" to repo "${repoName}":`, err);
    res.status(502).json({ success: false, error: err instanceof Error ? err.message : "repo_create_failed" });
  }
});

deployRouter.post("/build", async (req, res) => {
  if (!isGithubConfigured()) {
    res.status(503).json({ success: false, error: "github_not_configured" });
    return;
  }

  const { repo, workflowFile, imageTag, ref, agentPath } = req.body as {
    repo?: string;
    workflowFile?: string;
    imageTag?: string;
    ref?: string;
    agentPath?: string;
  };
  if (!repo || !repo.includes("/") || !workflowFile || !imageTag) {
    res.status(400).json({ success: false, error: "repo (owner/name), workflowFile, and imageTag are required" });
    return;
  }
  const [owner, name] = repo.split("/");

  try {
    const dispatchedAfter = Date.now() - 5000; // small buffer for clock skew vs. GitHub's servers
    const inputs: Record<string, string> = { image_tag: imageTag };
    if (agentPath) inputs.agent_path = agentPath;
    await dispatchWorkflow(owner, name, workflowFile, ref ?? "main", inputs);
    const run = await waitForWorkflowRun(owner, name, workflowFile, dispatchedAfter);
    res.json({ success: run.conclusion === "success", conclusion: run.conclusion, runUrl: run.html_url });
  } catch (err) {
    console.error("Failed to build via GitHub Actions:", err);
    res.status(502).json({ success: false, error: err instanceof Error ? err.message : "build_failed" });
  }
});

deployRouter.post("/job", async (req, res) => {
  if (!isAzureConfigured()) {
    res.status(503).json({ success: false, error: "azure_not_configured" });
    return;
  }

  const { jobName, image, cronExpression, env, secretEnvFromBackend } = req.body as {
    jobName?: string;
    image?: string;
    cronExpression?: string;
    env?: { name: string; value: string }[];
    secretEnvFromBackend?: string[];
  };
  if (!jobName || !image || !cronExpression) {
    res.status(400).json({ success: false, error: "jobName, image, and cronExpression are required" });
    return;
  }
  if (!process.env.ACR_USERNAME || !process.env.ACR_PASSWORD || !process.env.ACR_SERVER) {
    res.status(503).json({ success: false, error: "acr_not_configured" });
    return;
  }
  const unknownSecretEnv = (secretEnvFromBackend ?? []).filter((name) => !ALLOWED_JOB_SECRET_ENV.includes(name));
  if (unknownSecretEnv.length > 0) {
    res.status(400).json({ success: false, error: `secretEnvFromBackend not allowed: ${unknownSecretEnv.join(", ")}` });
    return;
  }

  try {
    const client = getClient();
    const rg = resourceGroup();

    let environment: { id?: string; location?: string } | null = null;
    for await (const env of client.managedEnvironments.listByResourceGroup(rg)) {
      environment = env;
      break;
    }
    if (!environment?.id || !environment.location) {
      res.status(502).json({ success: false, error: "no_managed_environment_found" });
      return;
    }

    const secrets = [{ name: "acr-password", value: process.env.ACR_PASSWORD }];
    const containerEnv: EnvironmentVar[] = (env ?? []).map((e) => ({ name: e.name, value: e.value }));

    for (const varName of secretEnvFromBackend ?? []) {
      const value = process.env[varName];
      if (!value) {
        res.status(503).json({ success: false, error: `${varName} is not configured on the backend` });
        return;
      }
      const secretRef = varName.toLowerCase().replace(/_/g, "-");
      secrets.push({ name: secretRef, value });
      containerEnv.push({ name: varName, secretRef });
    }

    const job: Job = {
      location: environment.location,
      environmentId: environment.id,
      workloadProfileName: "Consumption",
      configuration: {
        triggerType: "Schedule",
        replicaTimeout: 300,
        replicaRetryLimit: 0,
        scheduleTriggerConfig: {
          cronExpression,
          parallelism: 1,
          replicaCompletionCount: 1,
        },
        registries: [
          {
            server: process.env.ACR_SERVER,
            username: process.env.ACR_USERNAME,
            passwordSecretRef: "acr-password",
          },
        ],
        secrets,
      },
      template: {
        containers: [
          {
            name: jobName,
            image,
            resources: { cpu: 0.5, memory: "1Gi" },
            env: containerEnv,
          },
        ],
      },
    };

    const result = await client.jobs.beginCreateOrUpdateAndWait(rg, jobName, job);
    res.json({ success: true, jobName: result.name ?? jobName });
  } catch (err) {
    console.error(`Failed to create/update Azure Container Apps job "${jobName}":`, err);
    res.status(502).json({ success: false, error: err instanceof Error ? err.message : "job_create_failed" });
  }
});

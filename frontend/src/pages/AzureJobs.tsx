import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { AzureJob } from "../api";

function badgeVariant(status: string): string {
  const s = status.toLowerCase();
  if (s === "succeeded") return "success";
  if (s === "failed") return "failed";
  if (s === "running" || s === "processing") return "running";
  return "unknown";
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-badge--${badgeVariant(status)}`}>{status}</span>;
}

export function AzureJobs() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [jobs, setJobs] = useState<AzureJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [startError, setStartError] = useState<{ job: string; message: string } | null>(null);

  const [repo, setRepo] = useState("JeremiusL/Test_Agent");
  const [workflowFile, setWorkflowFile] = useState("build.yml");
  const [imageName, setImageName] = useState("agent-hello");
  const [agentPath, setAgentPath] = useState("");
  const [imageTag, setImageTag] = useState("");
  const [jobName, setJobName] = useState("");
  const [cronExpression, setCronExpression] = useState("0 7 * * *");
  const [deployStage, setDeployStage] = useState<"idle" | "building" | "creating" | "done">("idle");
  const [deployMessage, setDeployMessage] = useState<string | null>(null);
  const [deployErr, setDeployErr] = useState<string | null>(null);

  const [buckets, setBuckets] = useState<{ key: string; repo: string }[]>([]);
  const [bucket, setBucket] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentFiles, setAgentFiles] = useState<File[]>([]);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [createRepoMsg, setCreateRepoMsg] = useState<string | null>(null);
  const [createRepoErr, setCreateRepoErr] = useState<string | null>(null);

  function refresh() {
    setError(null);
    return api.jobs
      .list()
      .then((summary) => {
        setConfigured(summary.configured);
        setJobs(summary.jobs);
        if (summary.error) setError(summary.error);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "failed to load jobs"));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    api.deploy
      .buckets()
      .then((res) => {
        setBuckets(res.buckets);
        if (res.buckets.length > 0) setBucket(res.buckets[0].key);
      })
      .catch(() => {});
  }, []);

  async function runNow(name: string) {
    setStarting(name);
    setStartError(null);
    try {
      await api.jobs.start(name);
      await refresh();
    } catch (err) {
      setStartError({ job: name, message: err instanceof Error ? err.message : "failed to start job" });
    } finally {
      setStarting(null);
    }
  }

  async function deployAgent(e: FormEvent) {
    e.preventDefault();
    setDeployErr(null);
    setDeployMessage(null);

    const tag = imageTag.trim() || `t${Date.now()}`;
    const name = jobName.trim();
    if (!repo.trim() || !workflowFile.trim() || !name || !cronExpression.trim()) {
      setDeployErr("repo, workflow file, job name, and cron schedule are all required");
      return;
    }

    try {
      setDeployStage("building");
      setDeployMessage("Triggering build and waiting for it to finish (this can take a few minutes)...");
      const build = await api.deploy.build({
        repo: repo.trim(),
        workflowFile: workflowFile.trim(),
        imageTag: tag,
        agentPath: agentPath.trim() || undefined,
      });
      if (!build.success) {
        setDeployErr(`Build did not succeed (conclusion: ${build.conclusion ?? "unknown"})`);
        setDeployStage("idle");
        return;
      }

      setDeployStage("creating");
      setDeployMessage("Build succeeded, creating/updating the Container Apps Job...");
      const image = `jeremylo.azurecr.io/${imageName.trim() || "agent-hello"}:${tag}`;
      const created = await api.deploy.createJob({ jobName: name, image, cronExpression: cronExpression.trim() });
      if (!created.success) {
        setDeployErr(created.error ?? "Failed to create job");
        setDeployStage("idle");
        return;
      }

      setDeployStage("done");
      setDeployMessage(`Deployed job "${created.jobName}" using ${image}.`);
      await refresh();
    } catch (err) {
      setDeployErr(err instanceof Error ? err.message : "deploy failed");
      setDeployStage("idle");
    }
  }

  async function createAgentRepo(e: FormEvent) {
    e.preventDefault();
    setCreateRepoErr(null);
    setCreateRepoMsg(null);

    if (!bucket || !agentName.trim() || agentFiles.length === 0) {
      setCreateRepoErr("destination repo, agent name, and at least one file are required");
      return;
    }

    setCreatingRepo(true);
    try {
      const result = await api.deploy.createRepo(bucket, agentName.trim(), agentFiles);
      if (!result.success || !result.repo || !result.workflowFile || !result.imageName || !result.agentPath) {
        setCreateRepoErr(result.error ?? "failed to create repo");
        return;
      }
      setRepo(result.repo);
      setWorkflowFile(result.workflowFile);
      setImageName(result.imageName);
      setAgentPath(result.agentPath);
      setJobName(result.suggestedJobName ?? "");
      setImageTag("");
      setCreateRepoMsg(`Added "${result.agentPath}" to ${result.repo}. Review the deploy form below, then hit Deploy.`);
    } catch (err) {
      setCreateRepoErr(err instanceof Error ? err.message : "failed to create repo");
    } finally {
      setCreatingRepo(false);
    }
  }

  return (
    <>
      <Link to="/" className="back-link">
        &lt;&lt; back
      </Link>
      <h1 className="app-title" style={{ color: "var(--accent-jobs)" }}>
        Azure Jobs
      </h1>

      {loading ? (
        <p className="muted">loading...</p>
      ) : configured === false ? (
        <div className="pixel-panel section">
          <p>Azure isn't configured yet.</p>
          <p className="muted">
            Add AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID / AZURE_SUBSCRIPTION_ID /
            AZURE_RESOURCE_GROUP to backend/.env (see README), then restart the backend.
          </p>
        </div>
      ) : (
        <>
          {error && <p className="muted">error: {error}</p>}

          <div className="pixel-panel section">
            <h2>Create agent from files</h2>
            <p className="muted">
              Upload a Dockerfile (or just a main.py, and we'll wrap it in a default one) plus any other source
              files. This creates a private GitHub repo with a build-and-push workflow already wired up.
            </p>
            <form onSubmit={createAgentRepo} className="section">
              <div className="row" style={{ marginBottom: 10 }}>
                <select className="pixel-input" value={bucket} onChange={(e) => setBucket(e.target.value)}>
                  {buckets.map((b) => (
                    <option key={b.key} value={b.key}>
                      {b.key} ({b.repo})
                    </option>
                  ))}
                </select>
                <input
                  className="pixel-input"
                  placeholder="agent name (e.g. weather-check)"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
                <input
                  className="pixel-file"
                  type="file"
                  multiple
                  onChange={(e) => setAgentFiles(Array.from(e.target.files ?? []))}
                />
              </div>
              <button className="pixel-btn" type="submit" disabled={creatingRepo}>
                {creatingRepo ? "Creating repo..." : "Create repo"}
              </button>
              {createRepoMsg && <p className="muted">{createRepoMsg}</p>}
              {createRepoErr && <p className="muted">error: {createRepoErr}</p>}
            </form>
          </div>

          <div className="pixel-panel section">
            <h2>Deploy new agent</h2>
            <form onSubmit={deployAgent} className="section">
              <div className="row" style={{ marginBottom: 10 }}>
                <input
                  className="pixel-input"
                  placeholder="owner/repo"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                />
                <input
                  className="pixel-input"
                  placeholder="workflow file (build.yml)"
                  value={workflowFile}
                  onChange={(e) => setWorkflowFile(e.target.value)}
                />
                <input
                  className="pixel-input"
                  placeholder="image name (agent-hello)"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                />
                <input
                  className="pixel-input"
                  placeholder="agent path (subdir, if repo holds multiple agents)"
                  value={agentPath}
                  onChange={(e) => setAgentPath(e.target.value)}
                />
              </div>
              <div className="row" style={{ marginBottom: 10 }}>
                <input
                  className="pixel-input"
                  placeholder="image tag (auto-generated if blank)"
                  value={imageTag}
                  onChange={(e) => setImageTag(e.target.value)}
                />
                <input
                  className="pixel-input"
                  placeholder="job name (hello-job-2)"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                />
                <input
                  className="pixel-input"
                  placeholder="cron (0 7 * * *)"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                />
              </div>
              <button className="pixel-btn" type="submit" disabled={deployStage === "building" || deployStage === "creating"}>
                {deployStage === "building" ? "Building..." : deployStage === "creating" ? "Creating job..." : "Deploy"}
              </button>
              {deployMessage && <p className="muted">{deployMessage}</p>}
              {deployErr && <p className="muted">error: {deployErr}</p>}
            </form>
          </div>

          <div className="row section">
            <button className="pixel-btn" onClick={() => refresh()}>
              Refresh
            </button>
          </div>

          {jobs.length === 0 ? (
            <p className="muted">No Container Apps Jobs found in this resource group.</p>
          ) : (
            <ul className="list">
              {jobs.map((job) => (
                <li key={job.name} className="list-item">
                  <div>
                    <div>{job.name}</div>
                    <div className="muted">
                      {job.lastRunTime ? new Date(job.lastRunTime).toLocaleString() : "never run"}
                    </div>
                    {startError?.job === job.name && <div className="muted">error: {startError.message}</div>}
                  </div>
                  <div className="row">
                    <StatusBadge status={job.status} />
                    <button
                      className="pixel-btn"
                      disabled={starting === job.name}
                      onClick={() => runNow(job.name)}
                    >
                      {starting === job.name ? "Starting..." : "Run now"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

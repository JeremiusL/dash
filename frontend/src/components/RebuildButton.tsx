import { useRef, useState } from "react";
import { api } from "../api";

type RebuildState = "idle" | "building" | "restarting" | "error";

const POLL_MS = 2000;
const TIMEOUT_MS = 5 * 60 * 1000;

async function isHealthy(): Promise<boolean> {
  try {
    const res = await fetch("/api/health", { credentials: "include" });
    return res.ok;
  } catch {
    return false;
  }
}

export function RebuildButton() {
  const [state, setState] = useState<RebuildState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const sawDownRef = useRef(false);

  function pollUntilBack(deadline: number) {
    window.setTimeout(async () => {
      const up = await isHealthy();
      if (up && sawDownRef.current) {
        window.location.reload();
        return;
      }
      if (!up) {
        sawDownRef.current = true;
        setState("restarting");
      }
      if (Date.now() > deadline) {
        setState("error");
        setMessage("taking longer than expected — check backend/data/rebuild.log");
        return;
      }
      pollUntilBack(deadline);
    }, POLL_MS);
  }

  async function rebuild() {
    setState("building");
    setMessage(null);
    sawDownRef.current = false;
    try {
      const result = await api.dashboard.rebuild();
      if (!result.success) {
        setState("error");
        setMessage(result.error ?? "failed to start rebuild");
        return;
      }
      pollUntilBack(Date.now() + TIMEOUT_MS);
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "failed to start rebuild");
    }
  }

  const busy = state === "building" || state === "restarting";
  const label = state === "building" ? "pulling + building…" : state === "restarting" ? "restarting…" : state === "error" ? "retry rebuild" : "rebuild dashboard";

  return (
    <div className="rebuild-widget">
      <button
        className={`rebuild-btn ${busy ? "is-busy" : ""} ${state === "error" ? "is-error" : ""}`}
        onClick={rebuild}
        disabled={busy}
        title="git pull, rebuild, and restart the dashboard"
      >
        {label}
      </button>
      {message && <div className="rebuild-message">{message}</div>}
    </div>
  );
}

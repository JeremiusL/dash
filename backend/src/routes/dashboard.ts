import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { Router } from "express";

export const dashboardRouter = Router();

const REPO_ROOT = path.join(process.cwd(), "..");
const REBUILD_SCRIPT = path.join(REPO_ROOT, "scripts", "rebuild-dashboard.ps1");
const LOG_PATH = path.join(process.cwd(), "data", "rebuild.log");

// The rebuild script ends by killing and restarting this very process, so
// there's no completion callback to wait on — a stuck flag here just dies
// with the old process and starts fresh as false on the next one.
let rebuildInFlight = false;

dashboardRouter.post("/rebuild", (_req, res) => {
  if (rebuildInFlight) {
    res.status(409).json({ success: false, error: "rebuild_already_running" });
    return;
  }
  rebuildInFlight = true;

  fs.appendFileSync(LOG_PATH, `\n--- rebuild started ${new Date().toISOString()} ---\n`);

  // stdio is "ignore" rather than a redirected fd: on Windows, a detached
  // child given a raw fs.openSync() fd silently drops everything the child
  // writes (the process still runs fine — the output just never lands).
  // The script writes its own log lines directly instead.
  //
  // No `detached: true` — on this machine that flag made the child a
  // total no-op: it exited 0 almost instantly without running any of the
  // script (confirmed by reproduction). Child processes here already
  // outlive their parent being killed (verified — the script's own last
  // step kills this very process), so detaching isn't needed for that.
  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", REBUILD_SCRIPT, "-LogPath", LOG_PATH], {
    cwd: REPO_ROOT,
    stdio: "ignore",
  });

  // spawn() failures (e.g. powershell.exe not found) surface as an async
  // "error" event — without a listener here they were silently swallowed,
  // leaving the log stuck at "started" with no clue why, and the in-flight
  // flag stuck true forever.
  child.on("error", (err) => {
    fs.appendFileSync(LOG_PATH, `\n--- rebuild failed to start: ${err.message} ---\n`);
    rebuildInFlight = false;
  });

  child.unref();

  res.json({ success: true, started: true });
});

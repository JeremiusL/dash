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

  const log = fs.openSync(LOG_PATH, "a");
  fs.writeSync(log, `\n--- rebuild started ${new Date().toISOString()} ---\n`);

  const child = spawn("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", REBUILD_SCRIPT], {
    cwd: REPO_ROOT,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();

  res.json({ success: true, started: true });
});

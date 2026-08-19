import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { habitsRouter } from "./routes/habits.js";
import { learningRouter } from "./routes/learning.js";
import { calendarRouter } from "./routes/calendar.js";
import { usageRouter } from "./routes/usage.js";
import { accountRouter } from "./routes/account.js";
import { authRouter } from "./routes/auth.js";
import { jobsRouter } from "./routes/jobs.js";
import { deployRouter } from "./routes/deploy.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { outreachRouter } from "./routes/outreach.js";
import { chessRouter } from "./routes/chess.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: process.env.FRONTEND_URL ?? "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieParser(process.env.SESSION_SECRET));

app.use("/api/auth", authRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/habits", requireAuth, habitsRouter);
app.use("/api/learning", requireAuth, learningRouter);
app.use("/api/calendar", requireAuth, calendarRouter);
app.use("/api/usage", requireAuth, usageRouter);
app.use("/api/account", requireAuth, accountRouter);
app.use("/api/jobs", requireAuth, jobsRouter);
app.use("/api/deploy", requireAuth, deployRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/outreach", requireAuth, outreachRouter);
app.use("/api/chess", requireAuth, chessRouter);

// In production, this same server also serves the built frontend (frontend/dist),
// so the whole dashboard is reachable from one origin/port over Tailscale.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.join(__dirname, "..", "..", "frontend", "dist");

app.use(express.static(frontendDist));

app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"), (err) => {
    if (err) res.status(404).end();
  });
});

const server = app.listen(PORT, () => {
  console.log(`dash backend listening on http://localhost:${PORT}`);
});

// The /api/deploy/build route waits on a GitHub Actions run, which can take a
// few minutes — make sure Node's default request timeout doesn't cut it off.
server.requestTimeout = 10 * 60 * 1000;
server.headersTimeout = 10 * 60 * 1000 + 1000;

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use — is another instance of the backend already running?`);
    process.exit(1);
  }
  throw err;
});

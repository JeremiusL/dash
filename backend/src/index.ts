import "dotenv/config";
import express from "express";
import cors from "cors";
import { habitsRouter } from "./routes/habits.js";
import { learningRouter } from "./routes/learning.js";
import { calendarRouter } from "./routes/calendar.js";
import { usageRouter } from "./routes/usage.js";
import { accountRouter } from "./routes/account.js";

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.use("/api/habits", habitsRouter);
app.use("/api/learning", learningRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/usage", usageRouter);
app.use("/api/account", accountRouter);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`dash backend listening on http://localhost:${PORT}`);
});

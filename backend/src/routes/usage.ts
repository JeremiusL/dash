import { Router } from "express";
import { getUsageSummary } from "../claudeUsage.js";

export const usageRouter = Router();

usageRouter.get("/", async (_req, res) => {
  try {
    const summary = await getUsageSummary();
    res.json(summary);
  } catch (err) {
    console.error("Failed to compute Claude usage summary:", err);
    res.status(500).json({ available: false, error: "usage_scan_failed" });
  }
});

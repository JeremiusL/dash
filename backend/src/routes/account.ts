import { Router } from "express";
import { getAccountUsage, getLoginStatus, startLogin } from "../claudeAccount.js";

export const accountRouter = Router();

accountRouter.get("/status", async (_req, res) => {
  res.json(await getLoginStatus());
});

accountRouter.post("/login", async (_req, res) => {
  try {
    await startLogin();
    res.json(await getLoginStatus());
  } catch (err) {
    console.error("Claude account login failed:", err);
    res.status(500).json({ error: "login_failed" });
  }
});

accountRouter.get("/usage", async (_req, res) => {
  try {
    const summary = await getAccountUsage();
    if (!summary.loggedIn) {
      res.status(401).json({ error: "not_logged_in" });
      return;
    }
    res.json(summary);
  } catch (err) {
    console.error("Failed to fetch claude.ai account usage:", err);
    res.status(502).json({ error: "usage_fetch_failed" });
  }
});

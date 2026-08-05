import { Router } from "express";
import { checkPassword, clearSessionCookie, hasValidSession, setSessionCookie } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!password || !checkPassword(password)) {
    res.status(401).json({ error: "invalid_password" });
    return;
  }
  setSessionCookie(res);
  res.json({ ok: true });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get("/session", (req, res) => {
  if (!hasValidSession(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({ ok: true });
});

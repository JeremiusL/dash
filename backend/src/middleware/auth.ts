import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_COOKIE = "dash_session";
const SESSION_VALUE = "authenticated";

export function checkPassword(candidate: string): boolean {
  const expected = process.env.DASHBOARD_PASSWORD ?? "";
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function setSessionCookie(res: Response) {
  res.cookie(SESSION_COOKIE, SESSION_VALUE, {
    httpOnly: true,
    signed: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE);
}

export function hasValidSession(req: Request): boolean {
  return req.signedCookies?.[SESSION_COOKIE] === SESSION_VALUE;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!hasValidSession(req)) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

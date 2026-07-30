import { Router } from "express";
import { google } from "googleapis";
import { getAuthUrl, getAuthorizedClient, getOAuthClient, isConfigured, isConnected, saveTokens } from "../google.js";

export const calendarRouter = Router();

calendarRouter.get("/status", async (_req, res) => {
  res.json({ configured: isConfigured(), connected: isConfigured() && (await isConnected()) });
});

calendarRouter.get("/auth-url", (_req, res) => {
  if (!isConfigured()) {
    res.status(400).json({ error: "Google OAuth is not configured yet. See README for setup steps." });
    return;
  }
  res.json({ url: getAuthUrl() });
});

calendarRouter.get("/oauth-callback", async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const code = req.query.code as string | undefined;
  if (!code) {
    res.redirect(`${frontendUrl}/calendar?error=missing_code`);
    return;
  }
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    res.redirect(`${frontendUrl}/calendar?connected=1`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.redirect(`${frontendUrl}/calendar?error=oauth_failed`);
  }
});

calendarRouter.get("/events", async (_req, res) => {
  if (!isConfigured()) {
    res.status(400).json({ error: "not_configured" });
    return;
  }
  const client = await getAuthorizedClient();
  if (!client) {
    res.status(401).json({ error: "not_connected" });
    return;
  }
  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const calendarList = await calendar.calendarList.list();
    const calendars = (calendarList.data.items ?? []).filter((c) => c.selected !== false && c.id);

    const timeMin = new Date().toISOString();
    const perCalendar = await Promise.all(
      calendars.map(async (c) => {
        try {
          const result = await calendar.events.list({
            calendarId: c.id!,
            timeMin,
            maxResults: 10,
            singleEvents: true,
            orderBy: "startTime",
          });
          return (result.data.items ?? []).map((e) => ({
            id: e.id!,
            summary: e.summary ?? "(no title)",
            start: e.start?.dateTime ?? e.start?.date,
            end: e.end?.dateTime ?? e.end?.date,
            link: e.htmlLink,
            calendar: c.summary ?? c.id!,
          }));
        } catch (err) {
          console.error(`Failed to fetch events for calendar ${c.id}:`, err);
          return [];
        }
      })
    );

    const events = perCalendar
      .flat()
      .sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime())
      .slice(0, 10);

    res.json({ events });
  } catch (err) {
    console.error("Failed to fetch calendar events:", err);
    res.status(502).json({ error: "google_fetch_failed" });
  }
});

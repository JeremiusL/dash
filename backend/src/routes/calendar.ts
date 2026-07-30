import { Router } from "express";
import { google } from "googleapis";
import { getAuthUrl, getAuthorizedClient, getOAuthClient, isConfigured, isConnected, saveTokens } from "../google.js";
import { fetchAppleEvents, isConfigured as appleIsConfigured, isConnected as appleIsConnected } from "../apple.js";

export const calendarRouter = Router();

interface EventDTO {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  allDay: boolean;
  link?: string;
  calendar: string;
  source: "google" | "apple";
}

function currentWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

async function fetchGoogleEvents(start: Date, end: Date): Promise<EventDTO[]> {
  if (!isConfigured()) return [];
  const client = await getAuthorizedClient();
  if (!client) return [];
  try {
    const calendar = google.calendar({ version: "v3", auth: client });
    const calendarList = await calendar.calendarList.list();
    const calendars = (calendarList.data.items ?? []).filter((c) => c.selected !== false && c.id);

    const perCalendar = await Promise.all(
      calendars.map(async (c) => {
        try {
          const result = await calendar.events.list({
            calendarId: c.id!,
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
            maxResults: 250,
            singleEvents: true,
            orderBy: "startTime",
          });
          return (result.data.items ?? []).map(
            (e): EventDTO => ({
              id: e.id!,
              summary: e.summary ?? "(no title)",
              // Google gives date-only all-day events as a bare "YYYY-MM-DD" in
              // `date` (a calendar date, not a timezone-anchored instant) and
              // timed events as a full ISO string in `dateTime`.
              start: e.start?.dateTime ?? e.start?.date ?? undefined,
              end: e.end?.dateTime ?? e.end?.date ?? undefined,
              allDay: Boolean(e.start?.date && !e.start?.dateTime),
              link: e.htmlLink ?? undefined,
              calendar: c.summary ?? c.id!,
              source: "google",
            })
          );
        } catch (err) {
          console.error(`Failed to fetch events for calendar ${c.id}:`, err);
          return [];
        }
      })
    );

    return perCalendar.flat();
  } catch (err) {
    console.error("Failed to fetch Google calendar events:", err);
    return [];
  }
}

calendarRouter.get("/status", async (_req, res) => {
  const [googleConnected, appleConnected] = await Promise.all([
    isConfigured() ? isConnected() : Promise.resolve(false),
    appleIsConnected(),
  ]);
  res.json({
    google: { configured: isConfigured(), connected: googleConnected },
    apple: { configured: appleIsConfigured(), connected: appleConnected },
  });
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
    res.redirect(`${frontendUrl}/?error=missing_code`);
    return;
  }
  try {
    const client = getOAuthClient();
    const { tokens } = await client.getToken(code);
    await saveTokens(tokens);
    res.redirect(`${frontendUrl}/?connected=1`);
  } catch (err) {
    console.error("Google OAuth callback failed:", err);
    res.redirect(`${frontendUrl}/?error=oauth_failed`);
  }
});

calendarRouter.get("/events", async (_req, res) => {
  const { start, end } = currentWeekRange();
  const [googleEvents, appleEvents] = await Promise.all([fetchGoogleEvents(start, end), fetchAppleEvents(start, end)]);

  const events = [...googleEvents, ...appleEvents].sort(
    (a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime()
  );

  res.json({ events, weekStart: start.toISOString(), weekEnd: end.toISOString() });
});

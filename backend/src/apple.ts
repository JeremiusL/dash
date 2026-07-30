import { DAVClient, type DAVCalendar } from "tsdav";
import ical from "node-ical";

const APPLE_CALDAV_SERVER = "https://caldav.icloud.com";

// login() + fetchCalendars() together cost ~2s (principal/calendar-home-set
// discovery against iCloud). Basic auth has no token to expire, so the
// resolved client/calendar list stays valid indefinitely in practice; cache
// it for a while instead of re-discovering on every request.
const SESSION_TTL_MS = 30 * 60 * 1000;

interface AppleSession {
  client: DAVClient;
  calendars: DAVCalendar[];
  expiresAt: number;
}

let cachedSession: AppleSession | null = null;

export interface AppleEvent {
  id: string;
  summary: string;
  start?: string;
  end?: string;
  allDay: boolean;
  link?: string;
  calendar: string;
  source: "apple";
}

export function isConfigured(): boolean {
  return Boolean(process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD);
}

async function getSession(): Promise<AppleSession | null> {
  if (!isConfigured()) return null;
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession;
  try {
    const client = new DAVClient({
      serverUrl: APPLE_CALDAV_SERVER,
      credentials: {
        username: process.env.APPLE_ID,
        password: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      },
      authMethod: "Basic",
      defaultAccountType: "caldav",
    });
    await client.login();
    const calendars = await client.fetchCalendars();
    cachedSession = { client, calendars, expiresAt: Date.now() + SESSION_TTL_MS };
    return cachedSession;
  } catch (err) {
    cachedSession = null;
    throw err;
  }
}

export async function isConnected(): Promise<boolean> {
  try {
    return (await getSession()) !== null;
  } catch {
    return false;
  }
}

function textValue(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "val" in v) return String((v as { val: unknown }).val);
  return "";
}

function calendarName(displayName: string | Record<string, unknown> | undefined, fallback: string): string {
  return typeof displayName === "string" && displayName.length > 0 ? displayName : fallback;
}

// RFC 5545 DATE values (all-day events) carry no timezone; node-ical marks them
// with `.dateOnly` and constructs the Date at local midnight. Format with local
// getters (never toISOString, which would shift the calendar date in negative
// UTC-offset zones) so the day this event belongs to stays unambiguous.
function formatEventDate(d: (Date & { dateOnly?: true }) | undefined): { value?: string; allDay: boolean } {
  if (!d) return { allDay: false };
  if (d.dateOnly) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return { value: `${y}-${m}-${day}`, allDay: true };
  }
  return { value: d.toISOString(), allDay: false };
}

export async function fetchAppleEvents(rangeStart: Date, rangeEnd: Date): Promise<AppleEvent[]> {
  let session: AppleSession | null;
  try {
    session = await getSession();
  } catch (err) {
    console.error("Failed to establish Apple Calendar session:", err);
    return [];
  }
  if (!session) return [];
  const { client, calendars } = session;

  try {
    const perCalendar = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const objects = await client.fetchCalendarObjects({
            calendar: cal,
            timeRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
          });
          const events: AppleEvent[] = [];
          for (const obj of objects) {
            if (!obj.data) continue;
            const parsed = ical.sync.parseICS(String(obj.data));
            for (const component of Object.values(parsed)) {
              if (!component || component.type !== "VEVENT") continue;
              if (component.rrule) {
                // CalDAV returns the recurring event's original master VEVENT, not
                // the occurrence(s) that actually fall in range - expand it so a
                // monthly/weekly recurrence shows this week's date, not its
                // series start (which may be long past).
                const instances = ical.expandRecurringEvent(component, { from: rangeStart, to: rangeEnd });
                for (const inst of instances) {
                  const start = formatEventDate(inst.start);
                  const end = formatEventDate(inst.end);
                  events.push({
                    id: `${component.uid ?? obj.url}-${inst.start.toISOString()}`,
                    summary: textValue(inst.summary) || "(no title)",
                    start: start.value,
                    end: end.value,
                    allDay: start.allDay,
                    link: component.url,
                    calendar: calendarName(cal.displayName, "Apple Calendar"),
                    source: "apple",
                  });
                }
                continue;
              }
              const start = formatEventDate(component.start);
              const end = formatEventDate(component.end);
              events.push({
                id: component.uid ?? obj.url,
                summary: textValue(component.summary) || "(no title)",
                start: start.value,
                end: end.value,
                allDay: start.allDay,
                link: component.url,
                calendar: calendarName(cal.displayName, "Apple Calendar"),
                source: "apple",
              });
            }
          }
          return events;
        } catch (err) {
          console.error(`Failed to fetch Apple events for calendar ${cal.url}:`, err);
          return [];
        }
      })
    );

    return perCalendar.flat();
  } catch (err) {
    console.error("Failed to fetch Apple calendar events:", err);
    return [];
  }
}

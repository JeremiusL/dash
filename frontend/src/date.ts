import type { CalendarEvent } from "./api";

// All-day events carry a bare "YYYY-MM-DD" calendar date (see backend/src/apple.ts
// and routes/calendar.ts) and must be parsed as a local date, not through the
// UTC-anchored `new Date("YYYY-MM-DD")` parse, which can land on the wrong day
// in negative UTC-offset timezones.
export function eventDate(event: Pick<CalendarEvent, "start" | "allDay">): Date | null {
  if (!event.start) return null;
  if (event.allDay) {
    const [y, m, d] = event.start.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(event.start);
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

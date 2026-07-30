import { useEffect, useState } from "react";
import { Tile } from "../components/Tile";
import { api } from "../api";
import type { CalendarEvent, Habit, LinkItem, NoteItem, ReadingItem } from "../api";

export function Home() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [links, setLinks] = useState<LinkItem[] | null>(null);
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [reading, setReading] = useState<ReadingItem[] | null>(null);

  useEffect(() => {
    api.habits.list().then(setHabits).catch(() => setHabits([]));
    api.learning.links.list().then(setLinks).catch(() => setLinks([]));
    api.learning.notes.list().then(setNotes).catch(() => setNotes([]));
    api.learning.readingList.list().then(setReading).catch(() => setReading([]));
    Promise.all([api.calendar.status(), api.calendar.events()])
      .then(([status, { events }]) => {
        const connected = status.google.connected || status.apple.connected;
        setCalendarConnected(connected);
        const now = Date.now();
        const upcoming = events
          .filter((e) => e.start && new Date(e.start).getTime() >= now)
          .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
        setNextEvent(upcoming[0] ?? null);
      })
      .catch(() => setCalendarConnected(false));
  }, []);

  const topStreak = habits && habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0;
  const doneToday = habits ? habits.filter((h) => h.completedToday).length : 0;

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">DASH</h1>
        <span className="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </header>

      <div className="home-grid">
        <Tile to="/habits" label="Habits" accent="var(--accent-habits)" cta="View habits">
          {habits === null ? (
            "loading..."
          ) : habits.length === 0 ? (
            "No habits yet. Click to add one."
          ) : (
            <>
              {doneToday}/{habits.length} done today
              <br />
              best streak: {topStreak} day{topStreak === 1 ? "" : "s"}
            </>
          )}
        </Tile>

        <Tile to="/calendar" label="Calendar" accent="var(--accent-calendar)" cta="Open calendar">
          {calendarConnected === null ? (
            "loading..."
          ) : !calendarConnected ? (
            "Not connected. Click to set up Google or Apple Calendar."
          ) : nextEvent ? (
            <>
              next: {nextEvent.summary}
              <br />
              {nextEvent.start ? new Date(nextEvent.start).toLocaleString() : ""}
            </>
          ) : (
            "No upcoming events."
          )}
        </Tile>

        <Tile to="/learning" label="Learning Center" accent="var(--accent-learning)" cta="Open library">
          {links === null || notes === null || reading === null ? (
            "loading..."
          ) : (
            <>
              {links.length} link{links.length === 1 ? "" : "s"} &middot; {notes.length} note{notes.length === 1 ? "" : "s"}
              <br />
              {reading.filter((r) => r.status !== "done").length} reading item{reading.filter((r) => r.status !== "done").length === 1 ? "" : "s"} in queue
            </>
          )}
        </Tile>
      </div>
    </>
  );
}

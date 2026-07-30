import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Tile } from "../components/Tile";
import { WeekGrid } from "../components/WeekGrid";
import { api } from "../api";
import type { CalendarEvent, CalendarStatus, Habit, LinkItem, NoteItem, ReadingItem } from "../api";

export function Home() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [calendarStatus, setCalendarStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(false);
  const [links, setLinks] = useState<LinkItem[] | null>(null);
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [reading, setReading] = useState<ReadingItem[] | null>(null);
  const [params] = useSearchParams();

  useEffect(() => {
    api.habits.list().then(setHabits).catch(() => setHabits([]));
    api.learning.links.list().then(setLinks).catch(() => setLinks([]));
    api.learning.notes.list().then(setNotes).catch(() => setNotes([]));
    api.learning.readingList.list().then(setReading).catch(() => setReading([]));

    Promise.all([api.calendar.status(), api.calendar.events()])
      .then(([status, week]) => {
        setCalendarStatus(status);
        setEvents(week.events);
        setWeekStart(week.weekStart);
      })
      .catch((err) => setCalendarError(err instanceof Error ? err.message : "failed to load calendar"));

    const oauthError = params.get("error");
    if (oauthError) setCalendarError(oauthError);
  }, []);

  async function connectGoogle() {
    try {
      const { url } = await api.calendar.authUrl();
      window.location.href = url;
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : "failed to start connection");
    }
  }

  const topStreak = habits && habits.length > 0 ? Math.max(...habits.map((h) => h.streak)) : 0;
  const doneToday = habits ? habits.filter((h) => h.completedToday).length : 0;

  const anyConnected = calendarStatus ? calendarStatus.google.connected || calendarStatus.apple.connected : false;
  const now = Date.now();
  const upcoming = events
    .filter((e) => e.start && new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
  const nextEvent = upcoming[0] ?? null;
  const sortedEvents = [...events].sort((a, b) => {
    const at = a.start ? new Date(a.start).getTime() : 0;
    const bt = b.start ? new Date(b.start).getTime() : 0;
    return at - bt;
  });

  return (
    <>
      <header className="app-header">
        <h1 className="app-title">DASH</h1>
        <span className="muted">{new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </header>

      {calendarError && <p className="muted">calendar error: {calendarError}</p>}

      {calendarStatus && !anyConnected && (
        <>
          {!calendarStatus.google.configured ? (
            <div className="pixel-panel section">
              <p>Google Calendar isn't configured yet.</p>
              <p className="muted">Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to backend/.env (see README), then restart the backend.</p>
            </div>
          ) : !calendarStatus.google.connected ? (
            <div className="pixel-panel section">
              <p>Not connected to Google Calendar.</p>
              <button className="pixel-btn pixel-btn--accent" onClick={connectGoogle}>
                Connect Google Calendar
              </button>
            </div>
          ) : null}

          {!calendarStatus.apple.configured ? (
            <div className="pixel-panel section">
              <p>Apple Calendar isn't configured yet.</p>
              <p className="muted">Add APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD to backend/.env (see README), then restart the backend.</p>
            </div>
          ) : !calendarStatus.apple.connected ? (
            <div className="pixel-panel section">
              <p>Couldn't connect to Apple Calendar &mdash; check APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD in backend/.env.</p>
            </div>
          ) : null}
        </>
      )}

      {anyConnected && weekStart && <WeekGrid weekStart={weekStart} events={events} />}

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

        <Tile
          onClick={() => setShowEvents((v) => !v)}
          label="Calendar"
          accent="var(--accent-calendar)"
          cta={showEvents ? "Hide events" : "Show events"}
        >
          {calendarStatus === null ? (
            "loading..."
          ) : !anyConnected ? (
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

      {showEvents && (
        <div className="section">
          <h2 className="section-title">This week's events</h2>
          {sortedEvents.length === 0 ? (
            <p className="muted">No events this week.</p>
          ) : (
            <ul className="list">
              {sortedEvents.map((e) => (
                <li key={e.id} className="list-item">
                  <div>
                    <div>
                      <span className={`source-dot source-dot--${e.source}`} /> {e.summary}
                    </div>
                    <div className="muted">
                      {e.allDay ? "all day" : e.start ? new Date(e.start).toLocaleString() : ""}
                      {e.calendar ? ` · ${e.calendar}` : ""}
                    </div>
                  </div>
                  {e.link && (
                    <a className="pixel-btn" href={e.link} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

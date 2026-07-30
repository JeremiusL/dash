import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { CalendarEvent, CalendarStatus } from "../api";
import { WeekGrid } from "../components/WeekGrid";

export function CalendarPage() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();

  async function load() {
    // Fire both in parallel: /events independently no-ops for whichever
    // provider isn't configured/connected, so it doesn't need to wait on
    // /status first.
    const [s, week] = await Promise.all([api.calendar.status(), api.calendar.events()]);
    setStatus(s);
    setEvents(week.events);
    setWeekStart(week.weekStart);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);
  }, []);

  async function connectGoogle() {
    try {
      const { url } = await api.calendar.authUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to start connection");
    }
  }

  const anyConnected = status ? status.google.connected || status.apple.connected : false;
  const sortedEvents = [...events].sort((a, b) => {
    const at = a.start ? new Date(a.start).getTime() : 0;
    const bt = b.start ? new Date(b.start).getTime() : 0;
    return at - bt;
  });

  return (
    <>
      <Link to="/" className="back-link">
        &lt;&lt; back
      </Link>
      <h1 className="app-title" style={{ color: "var(--accent-calendar)" }}>
        Calendar
      </h1>

      {error && <p className="muted">error: {error}</p>}

      {!status ? (
        <p className="muted">loading...</p>
      ) : (
        <>
          {!status.google.configured ? (
            <div className="pixel-panel section">
              <p>Google Calendar isn't configured yet.</p>
              <p className="muted">Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to backend/.env (see README), then restart the backend.</p>
            </div>
          ) : !status.google.connected ? (
            <div className="pixel-panel section">
              <p>Not connected to Google Calendar.</p>
              <button className="pixel-btn pixel-btn--accent" onClick={connectGoogle}>
                Connect Google Calendar
              </button>
            </div>
          ) : null}

          {!status.apple.configured ? (
            <div className="pixel-panel section">
              <p>Apple Calendar isn't configured yet.</p>
              <p className="muted">Add APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD to backend/.env (see README), then restart the backend.</p>
            </div>
          ) : !status.apple.connected ? (
            <div className="pixel-panel section">
              <p>Couldn't connect to Apple Calendar &mdash; check APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD in backend/.env.</p>
            </div>
          ) : null}

          {anyConnected && weekStart && (
            <>
              <WeekGrid weekStart={weekStart} events={events} />

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
            </>
          )}
        </>
      )}
    </>
  );
}

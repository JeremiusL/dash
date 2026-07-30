import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import type { CalendarEvent, CalendarStatus } from "../api";

export function CalendarPage() {
  const [status, setStatus] = useState<CalendarStatus | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [params] = useSearchParams();

  async function load() {
    const s = await api.calendar.status();
    setStatus(s);
    if (s.connected) {
      const { events } = await api.calendar.events();
      setEvents(events);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);
  }, []);

  async function connect() {
    try {
      const { url } = await api.calendar.authUrl();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to start connection");
    }
  }

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
      ) : !status.configured ? (
        <div className="pixel-panel">
          <p>Google Calendar isn't configured yet.</p>
          <p className="muted">Add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET to backend/.env (see README), then restart the backend.</p>
        </div>
      ) : !status.connected ? (
        <div className="pixel-panel">
          <p>Not connected to Google Calendar.</p>
          <button className="pixel-btn pixel-btn--accent" onClick={connect}>
            Connect Google Calendar
          </button>
        </div>
      ) : events.length === 0 ? (
        <p className="muted">No upcoming events.</p>
      ) : (
        <ul className="list">
          {events.map((e) => (
            <li key={e.id} className="list-item">
              <div>
                <div>{e.summary}</div>
                <div className="muted">{e.start ? new Date(e.start).toLocaleString() : ""}</div>
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
    </>
  );
}

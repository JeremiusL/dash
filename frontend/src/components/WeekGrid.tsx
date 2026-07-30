import type { CalendarEvent } from "../api";
import { eventDate, isSameDay } from "../date";

interface WeekGridProps {
  weekStart: string;
  events: CalendarEvent[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function WeekGrid({ weekStart, events }: WeekGridProps) {
  const start = new Date(weekStart);
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="week-grid">
      {days.map((date, i) => {
        const dayEvents = events
          .map((e) => ({ e, d: eventDate(e) }))
          .filter((x): x is { e: CalendarEvent; d: Date } => x.d !== null && isSameDay(x.d, date))
          .sort((a, b) => a.d.getTime() - b.d.getTime())
          .map((x) => x.e);
        const isToday = isSameDay(date, today);

        return (
          <div key={i} className={`week-day${isToday ? " week-day--today" : ""}`}>
            <div className="week-day-header">
              <div className="week-day-name">{DAY_LABELS[i]}</div>
              <div className="week-day-number">{date.getDate()}</div>
            </div>
            <div className="week-day-events">
              {dayEvents.map((e) => (
                <div key={e.id} className={`week-event week-event--${e.source}`} title={e.summary}>
                  <span className="week-event-time">
                    {e.allDay
                      ? "all day"
                      : e.start
                        ? new Date(e.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
                        : ""}
                  </span>
                  <span className="week-event-summary">{e.summary}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

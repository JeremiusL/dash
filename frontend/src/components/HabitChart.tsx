import { useMemo, useRef, useState } from "react";
import type { Habit } from "../api";

// Fixed categorical order — validated for CVD-safety, never reassigned per habit.
const SERIES_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}`;
}

const ROW_HEIGHT = 56;
const Y_DONE = 15; // percent from top
const Y_MISSED = 85;

interface HoverState {
  day: number;
  x: number; // percent
}

export function HabitChart({ habits }: { habits: Habit[] }) {
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [hover, setHover] = useState<HoverState | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const isCurrentMonth = viewDate.year === today.getFullYear() && viewDate.month === today.getMonth();
  const daysInMonth = new Date(viewDate.year, viewDate.month + 1, 0).getDate();
  const lastDay = isCurrentMonth ? today.getDate() : daysInMonth;

  const monthLabel = new Date(viewDate.year, viewDate.month, 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  function goMonth(delta: number) {
    setHover(null);
    setViewDate((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const series = useMemo(
    () =>
      habits.map((h, i) => {
        const done = new Set(h.completions);
        const points = Array.from({ length: lastDay }, (_, idx) => {
          const day = idx + 1;
          return { day, done: done.has(dateStr(viewDate.year, viewDate.month, day)) };
        });
        return { habit: h, color: SERIES_COLORS[i % SERIES_COLORS.length], points };
      }),
    [habits, viewDate, lastDay]
  );

  const axisLabelDays = useMemo(() => {
    const step = daysInMonth <= 15 ? 2 : daysInMonth <= 24 ? 3 : 5;
    const days = [1];
    for (let d = step; d < daysInMonth; d += step) days.push(d);
    if (days[days.length - 1] !== daysInMonth) days.push(daysInMonth);
    return days;
  }, [daysInMonth]);

  function xPercent(day: number) {
    return ((day - 0.5) / daysInMonth) * 100;
  }

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const frac = (e.clientX - rect.left) / rect.width;
    const day = Math.min(lastDay, Math.max(1, Math.round(frac * daysInMonth + 0.5)));
    setHover({ day, x: xPercent(day) });
  }

  if (habits.length === 0) {
    return null;
  }

  return (
    <div className="pixel-panel habit-chart">
      <div className="habit-chart-nav">
        <button type="button" className="pixel-btn habit-chart-nav-btn" onClick={() => goMonth(-1)} aria-label="previous month">
          &lt;
        </button>
        <span className="habit-chart-month-label">{monthLabel}</span>
        <button
          type="button"
          className="pixel-btn habit-chart-nav-btn"
          onClick={() => goMonth(1)}
          disabled={isCurrentMonth}
          aria-label="next month"
        >
          &gt;
        </button>
      </div>

      <div className="habit-chart-readout">
        {hover ? (
          <>
            <strong>
              {new Date(viewDate.year, viewDate.month, hover.day).toLocaleString("default", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </strong>
            {series.map(({ habit, color, points }) => {
              const p = points[hover.day - 1];
              return (
                <span className="habit-chart-readout-item" key={habit.id}>
                  <span className="habit-chart-readout-key" style={{ background: color }} />
                  {habit.name} <em className={p?.done ? "is-done" : "is-missed"}>{p?.done ? "done" : "missed"}</em>
                </span>
              );
            })}
          </>
        ) : (
          <span className="muted">hover the chart for details</span>
        )}
      </div>

      <div
        className="habit-chart-track"
        ref={trackRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {hover && (
          <div className="habit-chart-crosshair" style={{ left: `${hover.x}%` }} />
        )}

        {series.map(({ habit, color, points }) => (
          <div className="habit-chart-row" key={habit.id}>
            <div className="habit-chart-row-label">
              <span className="habit-chart-swatch" style={{ background: color }} />
              <span>{habit.name}</span>
            </div>
            <div className="habit-chart-row-plot" style={{ height: ROW_HEIGHT }}>
              <svg className="habit-chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                {points.length > 1 && (
                  <polyline
                    className="habit-chart-line"
                    style={{ stroke: color }}
                    vectorEffect="non-scaling-stroke"
                    points={points
                      .map((p) => `${xPercent(p.day)},${p.done ? Y_DONE : Y_MISSED}`)
                      .join(" ")}
                  />
                )}
                {points.length > 1 && (
                  <polygon
                    className="habit-chart-area"
                    style={{ fill: color }}
                    points={
                      `${xPercent(points[0].day)},100 ` +
                      points.map((p) => `${xPercent(p.day)},${p.done ? Y_DONE : Y_MISSED}`).join(" ") +
                      ` ${xPercent(points[points.length - 1].day)},100`
                    }
                  />
                )}
              </svg>
              {points.map((p) => (
                <span
                  key={p.day}
                  className={`habit-chart-dot ${p.done ? "is-done" : "is-missed"}`}
                  style={{
                    left: `${xPercent(p.day)}%`,
                    top: `${p.done ? Y_DONE : Y_MISSED}%`,
                    borderColor: color,
                    background: p.done ? color : "var(--panel)",
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        <div className="habit-chart-axis">
          <span className="habit-chart-axis-spacer" />
          <span className="habit-chart-axis-plot">
            {axisLabelDays.map((d) => (
              <span
                key={d}
                className={`habit-chart-axis-tick ${isCurrentMonth && d === today.getDate() ? "is-today" : ""}`}
                style={{ left: `${xPercent(d)}%` }}
              >
                {d}
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

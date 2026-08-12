import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { ChessProgress, Habit } from "../api";
import { getDayPlan, CURRICULUM_LENGTH } from "../data/chessCurriculum";
import { ExerciseRunner } from "../components/chess/ExerciseRunner";
import type { DrillResult } from "../components/chess/types";

function dayWithinCycle(absoluteDay: number, cycle: number): number {
  return absoluteDay - (cycle - 1) * CURRICULUM_LENGTH;
}

export function Chess() {
  const [progress, setProgress] = useState<ChessProgress | null>(null);
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [runnerOpen, setRunnerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    return Promise.all([api.chess.state(), api.habits.list()]).then(([p, h]) => {
      setProgress(p);
      setHabits(h);
    });
  }

  useEffect(() => {
    refresh().catch(() => setError("Couldn't load chess training data."));
  }, []);

  const linkedHabit = useMemo(
    () => habits?.find((h) => h.id === progress?.linkedHabitId) ?? null,
    [habits, progress]
  );

  if (error) {
    return (
      <>
        <Link to="/" className="back-link">&lt;&lt; back</Link>
        <p className="chess-feedback-wrong">{error}</p>
      </>
    );
  }

  if (!progress || !habits) {
    return (
      <>
        <Link to="/" className="back-link">&lt;&lt; back</Link>
        <p className="muted">loading...</p>
      </>
    );
  }

  async function linkHabit(id: string) {
    await api.chess.linkHabit(id);
    await refresh();
  }

  async function completeDay(result: DrillResult & { timeSpentSec: number; exerciseType: string }) {
    await api.chess.complete({
      day: progress!.todayDayNumber,
      exerciseType: result.exerciseType,
      accuracyPct: result.accuracyPct,
      timeSpentSec: result.timeSpentSec,
    });
    setRunnerOpen(false);
    await refresh();
  }

  async function extend() {
    await api.chess.extend();
    await refresh();
  }

  const cycleDays = progress.cycle * CURRICULUM_LENGTH;
  const dayNumbers = Array.from({ length: cycleDays }, (_, i) => i + 1);
  const currentPlan = getDayPlan(dayWithinCycle(progress.todayDayNumber, progress.cycle), progress.cycle);

  const completedEntries = Object.entries(progress.days)
    .map(([day, rec]) => ({ day: Number(day), ...rec }))
    .sort((a, b) => a.day - b.day);

  if (runnerOpen) {
    return (
      <>
        <Link to="/" className="back-link">&lt;&lt; back</Link>
        <h1 className="app-title" style={{ color: "var(--accent-chess)" }}>Chess Visualization</h1>
        <ExerciseRunner plan={currentPlan} onComplete={completeDay} onCancel={() => setRunnerOpen(false)} />
      </>
    );
  }

  return (
    <>
      <Link to="/" className="back-link">&lt;&lt; back</Link>
      <h1 className="app-title" style={{ color: "var(--accent-chess)" }}>Chess Visualization</h1>

      {linkedHabit ? (
        <p className="muted">
          🔗 Driven by the <strong>{linkedHabit.name}</strong> habit — completing today's training checks it off automatically.
        </p>
      ) : (
        <div className="pixel-panel section">
          <p>No habit linked yet. Pick which habit this training should drive:</p>
          <div className="row">
            {habits.length === 0 ? (
              <p className="muted">Create a habit on the Habits page first.</p>
            ) : (
              habits.map((h) => (
                <button key={h.id} className="pixel-btn" type="button" onClick={() => linkHabit(h.id)}>
                  {h.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      <div className="pixel-panel section">
        <div className="row">
          <div>
            <div className="chess-runner-title">
              Day {progress.todayDayNumber} of {cycleDays}
            </div>
            <p className="muted">{currentPlan.title} — {currentPlan.skillFocus}</p>
          </div>
          <span className="streak-badge">{progress.streak} day streak</span>
        </div>
        {progress.todayCompleted ? (
          <p className="chess-feedback-right">Today's training is done. Nice work.</p>
        ) : (
          <button className="pixel-btn pixel-btn--accent" type="button" onClick={() => setRunnerOpen(true)}>
            Start today's 20-minute session
          </button>
        )}
      </div>

      {progress.cycleFinished && (
        <div className="pixel-panel section">
          <p>
            🎉 You've completed all {cycleDays} days! Ready to keep building — with slightly harder drills — for another
            30 days?
          </p>
          <button className="pixel-btn pixel-btn--accent" type="button" onClick={extend}>
            Extend to next 30 days →
          </button>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Progress</h2>
        <div className="chess-day-grid">
          {dayNumbers.map((d) => {
            const rec = progress.days[d];
            const status =
              d === progress.todayDayNumber && !rec
                ? "today"
                : rec
                  ? "done"
                  : d < progress.todayDayNumber
                    ? "missed"
                    : "locked";
            return (
              <div key={d} className={`chess-day-cell chess-day-cell--${status}`} title={rec ? `${rec.exerciseType}${rec.accuracyPct !== null ? ` — ${rec.accuracyPct}%` : ""}` : `Day ${d}`}>
                {d}
              </div>
            );
          })}
        </div>
      </div>

      {completedEntries.length > 1 && (
        <div className="section">
          <h2 className="section-title">Accuracy trend</h2>
          <AccuracyChart entries={completedEntries} />
        </div>
      )}
    </>
  );
}

function AccuracyChart({ entries }: { entries: { day: number; accuracyPct: number | null }[] }) {
  const scored = entries.filter((e): e is { day: number; accuracyPct: number } => e.accuracyPct !== null);
  if (scored.length < 2) return <p className="muted">Not enough scored sessions yet.</p>;

  const minDay = scored[0].day;
  const maxDay = scored[scored.length - 1].day;
  const span = Math.max(maxDay - minDay, 1);
  const xPercent = (day: number) => ((day - minDay) / span) * 100;
  const points = scored.map((e) => `${xPercent(e.day)},${100 - e.accuracyPct}`).join(" ");

  return (
    <div className="pixel-panel">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: 140 }}>
        <polyline points={points} style={{ fill: "none", stroke: "var(--series-1)", strokeWidth: 2 }} vectorEffect="non-scaling-stroke" />
        {scored.map((e) => (
          <circle key={e.day} cx={xPercent(e.day)} cy={100 - e.accuracyPct} r={1.6} style={{ fill: "var(--series-1)" }} />
        ))}
      </svg>
      <p className="muted">Day {minDay} → {maxDay}, accuracy % per scored session</p>
    </div>
  );
}

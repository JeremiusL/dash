import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { Habit } from "../api";
import { HabitChart } from "../components/HabitChart";

export function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  function refresh() {
    return api.habits.list().then(setHabits);
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await api.habits.create(name.trim());
    setName("");
    await refresh();
  }

  async function toggle(id: string) {
    await api.habits.checkin(id);
    await refresh();
  }

  async function remove(id: string) {
    await api.habits.remove(id);
    await refresh();
  }

  return (
    <>
      <Link to="/" className="back-link">
        &lt;&lt; back
      </Link>
      <h1 className="app-title" style={{ color: "var(--accent-habits)" }}>
        Habits
      </h1>

      <form className="row section" onSubmit={addHabit}>
        <input
          className="pixel-input"
          placeholder="new habit name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="pixel-btn" type="submit">
          Add
        </button>
      </form>

      {loading ? (
        <p className="muted">loading...</p>
      ) : habits.length === 0 ? (
        <p className="muted">No habits yet. Add your first one above.</p>
      ) : (
        <ul className="list">
          {habits.map((h) => (
            <li key={h.id} className="list-item">
              <div className="row">
                <span
                  className={`checkbox-pixel ${h.completedToday ? "checked" : ""}`}
                  onClick={() => toggle(h.id)}
                  role="button"
                  aria-label={`toggle ${h.name} for today`}
                />
                <span>{h.name}</span>
              </div>
              <div className="row">
                <span className="streak-badge">{h.streak} day streak</span>
                <button className="pixel-btn pixel-btn--danger" onClick={() => remove(h.id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && habits.length > 0 && (
        <div className="section">
          <h2 className="section-title">Monthly tracker</h2>
          <HabitChart habits={habits} />
        </div>
      )}
    </>
  );
}

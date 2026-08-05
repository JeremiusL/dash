import { useState } from "react";
import { api } from "../api";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError(null);
    try {
      await api.auth.login(password);
      onLoggedIn();
    } catch {
      setError("Wrong password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <h1 className="app-title">dash</h1>
      <form className="section" onSubmit={submit}>
        <input
          className="pixel-input"
          type="password"
          placeholder="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="pixel-btn" type="submit" disabled={loading}>
          {loading ? "checking..." : "Enter"}
        </button>
        {error && <p className="muted">{error}</p>}
      </form>
    </div>
  );
}

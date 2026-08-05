import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Habits } from "./pages/Habits";
import { Learning } from "./pages/Learning";
import { AzureJobs } from "./pages/AzureJobs";
import { Login } from "./pages/Login";
import { UsageWidget } from "./components/UsageWidget";
import { api } from "./api";

export default function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    api.auth
      .session()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === null) {
    return <div className="app-shell" />;
  }

  if (!authed) {
    return <Login onLoggedIn={() => setAuthed(true)} />;
  }

  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/learning" element={<Learning />} />
        <Route path="/azure-jobs" element={<AzureJobs />} />
      </Routes>
      <UsageWidget />
    </div>
  );
}

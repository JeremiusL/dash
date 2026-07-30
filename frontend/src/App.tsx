import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Habits } from "./pages/Habits";
import { CalendarPage } from "./pages/Calendar";
import { Learning } from "./pages/Learning";
import { UsageWidget } from "./components/UsageWidget";

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/learning" element={<Learning />} />
      </Routes>
      <UsageWidget />
    </div>
  );
}

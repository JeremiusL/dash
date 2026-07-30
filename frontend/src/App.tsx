import { Routes, Route } from "react-router-dom";
import { Home } from "./pages/Home";
import { Habits } from "./pages/Habits";
import { Learning } from "./pages/Learning";
import { UsageWidget } from "./components/UsageWidget";

export default function App() {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/habits" element={<Habits />} />
        <Route path="/learning" element={<Learning />} />
      </Routes>
      <UsageWidget />
    </div>
  );
}

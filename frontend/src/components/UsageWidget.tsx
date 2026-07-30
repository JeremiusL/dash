import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../api";
import type { AccountUsage, UsageSummary } from "../api";

const POLL_MS = 60_000;
const ACCOUNT_POLL_MS = 180_000;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCountdown(resetsAt: string): string {
  const ms = new Date(resetsAt).getTime() - Date.now();
  if (ms <= 0) return "now";
  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatResetAbsolute(resetsAt: string): string {
  return new Date(resetsAt).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
}

type AccountState = "loading" | "logged-out" | "logging-in" | "logged-in" | "unavailable";

// Reserved vertical space below each ring for its label + reset countdown + gaps.
const RING_LABEL_RESERVE = 28;
const MIN_RING_DIAMETER = 28;

function Ring({
  percent,
  label,
  resetsAt,
  diameter,
}: {
  percent: number;
  label: string;
  resetsAt: string;
  diameter: number;
}) {
  const pct = Math.max(0, Math.min(100, percent));
  return (
    <div className="usage-ring-wrap" style={{ width: diameter } as CSSProperties}>
      <div
        className="usage-ring"
        style={{ "--pct": pct, width: diameter, height: diameter } as CSSProperties}
        title={`resets ${formatResetAbsolute(resetsAt)}`}
      >
        <div className="usage-ring-hole">
          <span className="usage-ring-value" style={{ fontSize: Math.max(8, diameter * 0.17) }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>
      <div className="usage-ring-label">{label}</div>
      <div className="usage-ring-reset">{formatCountdown(resetsAt)}</div>
    </div>
  );
}

export function UsageWidget() {
  const [summary, setSummary] = useState<UsageSummary | null>(null);
  const [accountState, setAccountState] = useState<AccountState>("loading");
  const [accountUsage, setAccountUsage] = useState<AccountUsage | null>(null);
  const rightColRef = useRef<HTMLDivElement | null>(null);
  const [ringsHeight, setRingsHeight] = useState<number | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load() {
      api.usage
        .summary()
        .then((s) => {
          if (!cancelled) setSummary(s);
        })
        .catch(() => {
          if (!cancelled) setSummary({ available: false, days: [], todayTokens: 0, todayMessages: 0, weekTokens: 0, updatedAt: "" });
        });
    }
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function loadAccount() {
      api.account
        .status()
        .then((s) => {
          if (cancelled) return;
          if (!s.loggedIn) {
            setAccountState("logged-out");
            return;
          }
          return api.account.usage().then((u) => {
            if (cancelled) return;
            setAccountUsage(u);
            setAccountState("logged-in");
          });
        })
        .catch(() => {
          if (!cancelled) setAccountState("unavailable");
        });
    }
    loadAccount();
    const id = window.setInterval(loadAccount, ACCOUNT_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  async function connect() {
    setAccountState("logging-in");
    try {
      await api.account.login();
      const usage = await api.account.usage();
      setAccountUsage(usage);
      setAccountState("logged-in");
    } catch {
      setAccountState("logged-out");
    }
  }

  const showTokenSection = summary !== null && summary.available;

  useEffect(() => {
    if (!showTokenSection) return;
    const el = rightColRef.current;
    if (!el) return;
    const update = () => setRingsHeight(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showTokenSection]);

  if (!showTokenSection && accountState === "unavailable") return null;

  const today = summary?.days[summary.days.length - 1]?.date;
  const maxTokens = summary ? Math.max(1, ...summary.days.map((d) => d.tokens)) : 1;
  const ringDiameter = ringsHeight ? Math.max(MIN_RING_DIAMETER, ringsHeight - RING_LABEL_RESERVE) : MIN_RING_DIAMETER;

  return (
    <div className="usage-widget">
      <div className="usage-widget-header">
        <span className="usage-widget-title">CLAUDE USAGE</span>
        <span className="usage-live-dot" title="live" />
      </div>

      {accountState === "logged-out" && (
        <button className="usage-connect-btn" onClick={connect}>
          Connect Claude account
        </button>
      )}

      {accountState === "logging-in" && <div className="usage-connect-status">waiting for login in browser window...</div>}

      <div className="usage-body">
        {accountState === "logged-in" && accountUsage && (
          <div className="usage-rings">
            {accountUsage.session && (
              <Ring percent={accountUsage.session.percent} label="session" resetsAt={accountUsage.session.resetsAt} diameter={ringDiameter} />
            )}
            {accountUsage.weekly && (
              <Ring percent={accountUsage.weekly.percent} label="weekly" resetsAt={accountUsage.weekly.resetsAt} diameter={ringDiameter} />
            )}
          </div>
        )}

        {showTokenSection && summary && (
          <div className="usage-right-col" ref={rightColRef}>
            <div className="usage-hero-block">
              <div className="usage-hero">{formatTokens(summary.todayTokens)}</div>
              <div className="usage-hero-label">tokens today</div>
            </div>

            <div className="usage-bars">
              {summary.days.map((d) => (
                <div key={d.date} className={`usage-bar-col ${d.date === today ? "is-today" : ""}`}>
                  <div
                    className="usage-bar"
                    style={{ height: `${Math.max(6, (d.tokens / maxTokens) * 100)}%` }}
                    title={`${d.date}: ${d.tokens.toLocaleString()} tokens, ${d.messages} turns`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {showTokenSection && summary && (
        <div className="usage-widget-footer">
          <span>{formatTokens(summary.weekTokens)}/7d</span>
        </div>
      )}
    </div>
  );
}

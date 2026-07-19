import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { TrendChart, StarBreakdown } from "../components.jsx";
import { useApp } from "../App.jsx";

export default function Dashboard() {
  const { profile } = useApp();
  const [data, setData] = useState(null);
  const [windowDays, setWindowDays] = useState(30);
  const [error, setError] = useState("");

  useEffect(() => {
    api(`/analytics?window=${windowDays}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [windowDays]);

  if (error) return <p className="error-msg">{error}</p>;
  if (!data) return <div className="page-loading">Loading dashboard…</div>;

  const { overallScore, reviewCount, distribution, trend, praiseThemes, complaintThemes, starBreakdown, alerts } = data;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Reputation overview for {profile?.name}</p>
        </div>
        <div className="window-tabs" role="tablist" aria-label="Trend window">
          {[30, 60, 90].map((w) => (
            <button key={w} className={windowDays === w ? "active" : ""} onClick={() => setWindowDays(w)}>
              {w} days
            </button>
          ))}
        </div>
      </div>

      {alerts.map((a) => (
        <div className="alert-banner" key={a.theme}>
          <strong>⚠ Trend alert:</strong>
          <span>
            "{a.theme}" complaints are up {a.increasePct}% week-over-week ({a.lastWeek} → {a.thisWeek}).{" "}
            <Link to="/themes">View themes</Link>
          </span>
        </div>
      ))}

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        <div className="card stat-tile">
          <div className="stat-label">Overall sentiment score</div>
          <div className="stat-value">{overallScore ?? "—"}<span style={{ fontSize: 18, color: "var(--muted)" }}> / 100</span></div>
          <div className="stat-sub">Unweighted mean across all analyzed reviews</div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Total reviews</div>
          <div className="stat-value">{reviewCount}</div>
          <div className="stat-sub">
            {distribution.Positive} positive · {distribution.Neutral} neutral · {distribution.Negative} negative
          </div>
        </div>
        <div className="card stat-tile">
          <div className="stat-label">Needs attention</div>
          <div className="stat-value">{distribution.Negative}</div>
          <div className="stat-sub"><Link to="/responses">Draft responses →</Link></div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Sentiment trend — last {windowDays} days</h2>
        <TrendChart points={trend} />
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h2>Star rating breakdown</h2>
          <StarBreakdown breakdown={starBreakdown} />
        </div>
        <div className="card">
          <h2>Top themes</h2>
          <div className="grid grid-2" style={{ gap: 8 }}>
            <div>
              <h3 style={{ color: "var(--good-text)" }}>Praise</h3>
              {praiseThemes.length === 0 && <p className="hint">None detected yet</p>}
              {praiseThemes.map((t) => (
                <div className="theme-row" key={t.themeId} style={{ cursor: "default" }}>
                  <span>{t.label}</span>
                  <span className="theme-count">{t.reviewCount}</span>
                </div>
              ))}
            </div>
            <div>
              <h3 style={{ color: "var(--critical)" }}>Complaints</h3>
              {complaintThemes.length === 0 && <p className="hint">None detected yet</p>}
              {complaintThemes.map((t) => (
                <div className="theme-row" key={t.themeId} style={{ cursor: "default" }}>
                  <span>{t.label}</span>
                  <span className="theme-count">{t.reviewCount}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}><Link to="/themes">Explore all themes →</Link></p>
        </div>
      </div>
    </div>
  );
}

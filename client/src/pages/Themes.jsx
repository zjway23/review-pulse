import React, { useEffect, useState } from "react";
import { api } from "../api.js";
import { ReviewCard } from "../components.jsx";

export default function Themes() {
  const [themes, setThemes] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [themeReviews, setThemeReviews] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/themes"), api("/analytics?window=30")])
      .then(([t, a]) => {
        setThemes(t.themes);
        setAlerts(a.alerts);
      })
      .catch((e) => setError(e.message));
  }, []);

  const pick = async (theme) => {
    if (selected?.themeId === theme.themeId) {
      setSelected(null);
      return;
    }
    setSelected(theme);
    const { reviews } = await api(`/themes/${theme.themeId}/reviews`);
    setThemeReviews(reviews);
  };

  const praise = themes.filter((t) => t.polarity === "praise").slice(0, 5);
  const complaints = themes.filter((t) => t.polarity === "complaint").slice(0, 5);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Themes</h1>
          <p>What customers keep talking about, grouped by AI. Click a theme to see its reviews.</p>
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}

      {alerts.map((a) => (
        <div className="alert-banner" key={a.theme}>
          <strong>⚠ Trend alert:</strong>
          <span>"{a.theme}" complaints are up {a.increasePct}% week-over-week ({a.lastWeek} → {a.thisWeek}).</span>
        </div>
      ))}

      <div className="grid grid-2">
        <div className="card">
          <h2 style={{ color: "var(--good-text)" }}>Top praise themes</h2>
          {praise.length === 0 && <p className="empty">No praise themes detected yet.</p>}
          {praise.map((t) => (
            <div
              key={t.themeId}
              className={`theme-row ${selected?.themeId === t.themeId ? "selected" : ""}`}
              onClick={() => pick(t)}
            >
              <span>{t.label}</span>
              <span className="theme-count">{t.reviewCount}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <h2 style={{ color: "var(--critical)" }}>Top complaint themes</h2>
          {complaints.length === 0 && <p className="empty">No complaint themes detected yet.</p>}
          {complaints.map((t) => (
            <div
              key={t.themeId}
              className={`theme-row ${selected?.themeId === t.themeId ? "selected" : ""}`}
              onClick={() => pick(t)}
            >
              <span>{t.label}</span>
              <span className="theme-count">{t.reviewCount}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ marginTop: 20 }}>
          <h2>
            Reviews mentioning "{selected.label}" ({themeReviews.length})
          </h2>
          <div className="grid">
            {themeReviews.map((r) => <ReviewCard key={r.reviewId} review={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}

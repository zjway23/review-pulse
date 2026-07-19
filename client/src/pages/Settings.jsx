import React, { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../App.jsx";

export default function Settings() {
  const { profile, setProfile } = useApp();
  const [fields, setFields] = useState({
    name: profile?.name || "",
    type: profile?.type || "",
    description: profile?.description || "",
    toneProfile: profile?.toneProfile || "Friendly",
    responseLength: profile?.responseLength || "Medium",
    alertThresholdPct: profile?.alertThresholdPct ?? 30,
    theme: profile?.theme || "light",
    itemsPerPage: profile?.itemsPerPage || 10,
  });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setFields({ ...fields, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    setError("");
    try {
      const { settings } = await api("/settings", {
        method: "PUT",
        body: { ...fields, alertThresholdPct: Number(fields.alertThresholdPct), itemsPerPage: Number(fields.itemsPerPage) },
      });
      setProfile(settings);
      setNotice("Settings saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p>Business profile, response preferences, and dashboard options.</p>
        </div>
      </div>
      <form onSubmit={save}>
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Business profile</h2>
          <label className="field">
            Business name
            <input value={fields.name} onChange={set("name")} required />
          </label>
          <label className="field">
            Business type
            <input value={fields.type} onChange={set("type")} required />
          </label>
          <label className="field">
            Description
            <textarea value={fields.description} onChange={set("description")} />
          </label>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>AI response preferences</h2>
          <div className="form-row">
            <label className="field">
              Response tone
              <select value={fields.toneProfile} onChange={set("toneProfile")}>
                <option>Friendly</option>
                <option>Professional</option>
                <option>Formal</option>
              </select>
            </label>
            <label className="field">
              Response length
              <select value={fields.responseLength} onChange={set("responseLength")}>
                <option>Short</option>
                <option>Medium</option>
                <option>Long</option>
              </select>
            </label>
          </div>
          <label className="field">
            Trend alert threshold — notify when a complaint theme rises week-over-week by
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min="5" max="200" value={fields.alertThresholdPct} onChange={set("alertThresholdPct")} style={{ width: 90 }} />
              <span>%</span>
            </div>
          </label>
        </div>

        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Dashboard preferences</h2>
          <div className="form-row">
            <label className="field">
              Theme
              <select value={fields.theme} onChange={set("theme")}>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="field">
              Reviews per page
              <select value={fields.itemsPerPage} onChange={set("itemsPerPage")}>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </label>
          </div>
        </div>

        {notice && <p className="ok-msg">{notice}</p>}
        {error && <p className="error-msg">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? <span className="spinner" /> : "Save settings"}</button>
      </form>

      <div className="card" style={{ marginTop: 16 }}>
        <h2>Change password</h2>
        <p className="hint">
          Password changes are handled by the authentication provider. In this prototype, use "Forgot password?" on the
          login page.
        </p>
      </div>
    </div>
  );
}

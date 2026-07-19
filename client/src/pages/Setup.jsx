import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useApp } from "../App.jsx";

export default function Setup() {
  const { setProfile } = useApp();
  const navigate = useNavigate();
  const [fields, setFields] = useState({
    name: "",
    type: "",
    description: "",
    toneProfile: "Friendly",
    responseLength: "Medium",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key) => (e) => setFields({ ...fields, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { profile } = await api("/profile", { method: "PUT", body: fields });
      setProfile(profile);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card" style={{ maxWidth: 480 }}>
        <h1>Set up your business profile</h1>
        <p className="hint" style={{ marginTop: 0 }}>
          Tell us about your business — this shapes your AI-generated responses. You can change it anytime in Settings.
        </p>
        <form onSubmit={submit}>
          <label className="field">
            Business name *
            <input value={fields.name} onChange={set("name")} required autoFocus placeholder="e.g. The Copper Kettle Cafe" />
          </label>
          <label className="field">
            Business type *
            <input value={fields.type} onChange={set("type")} required placeholder="e.g. Restaurant, Salon, Hotel" />
          </label>
          <label className="field">
            Short description
            <textarea value={fields.description} onChange={set("description")} placeholder="What you do, in a sentence or two" />
          </label>
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
          {error && <p className="error-msg">{error}</p>}
          <button className="btn" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? <span className="spinner" /> : "Save and continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

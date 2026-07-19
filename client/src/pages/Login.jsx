import React, { useState } from "react";
import { api } from "../api.js";
import { useApp } from "../App.jsx";

export default function Login() {
  const { login } = useApp();
  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (mode === "reset") {
        const res = await api("/reset-password", { method: "POST", body: { email } });
        setMessage(res.message);
      } else {
        const res = await api(`/${mode}`, { method: "POST", body: { email, password } });
        await login(res.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <div className="brand"><span className="brand-pulse">●</span> Review Pulse</div>
        <div className="auth-tabs">
          <button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Log in</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Sign up</button>
        </div>
        <form onSubmit={submit}>
          <label className="field">
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </label>
          {mode !== "reset" && (
            <label className="field">
              Password
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </label>
          )}
          {error && <p className="error-msg">{error}</p>}
          {message && <p className="ok-msg">{message}</p>}
          <button className="btn" disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
            {busy ? <span className="spinner" /> : mode === "login" ? "Log in" : mode === "register" ? "Create account" : "Send reset link"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginBottom: 0 }}>
          {mode === "reset" ? (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("login"); }}>Back to log in</a>
          ) : (
            <a href="#" onClick={(e) => { e.preventDefault(); setMode("reset"); setMessage(""); setError(""); }}>Forgot password?</a>
          )}
        </p>
        <hr className="divider" />
        <p className="hint" style={{ textAlign: "center" }}>
          Demo account: <strong>demo@reviewpulse.app</strong> / <strong>demo1234</strong>
        </p>
      </div>
    </div>
  );
}

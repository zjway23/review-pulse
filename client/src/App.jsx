import React, { useEffect, useState, createContext, useContext } from "react";
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from "react-router-dom";
import { api, getToken, setToken } from "./api.js";
import Login from "./pages/Login.jsx";
import Setup from "./pages/Setup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Reviews from "./pages/Reviews.jsx";
import Themes from "./pages/Themes.jsx";
import Responses from "./pages/Responses.jsx";
import Settings from "./pages/Settings.jsx";

const AppContext = createContext(null);
export const useApp = () => useContext(AppContext);

function Shell({ children }) {
  const { profile, logout } = useApp();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <NavLink to="/" className="brand">
            <span className="brand-pulse">●</span> Review Pulse
          </NavLink>
          <nav className="nav">
            <NavLink to="/" end>Dashboard</NavLink>
            <NavLink to="/reviews">Reviews Feed</NavLink>
            <NavLink to="/themes">Themes</NavLink>
            <NavLink to="/responses">Responses</NavLink>
          </nav>
          <div className="topbar-right">
            <span className="biz-name">{profile?.name}</span>
            <NavLink to="/settings" className="icon-btn" title="Settings">⚙</NavLink>
            <button className="btn btn-ghost" onClick={logout}>Log out</button>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const navigate = useNavigate();
  const location = useLocation();

  const refreshProfile = async () => {
    const { profile } = await api("/profile");
    setProfile(profile);
    return profile;
  };

  useEffect(() => {
    if (!getToken()) return;
    refreshProfile()
      .catch(() => setToken(null) || setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = profile?.theme === "dark" ? "dark" : "light";
  }, [profile?.theme]);

  const login = async (token) => {
    setToken(token);
    setAuthed(true);
    const p = await refreshProfile().catch(() => null);
    navigate(p ? "/" : "/setup");
  };

  const logout = async () => {
    try { await api("/logout", { method: "POST" }); } catch { /* session may be gone */ }
    setToken(null);
    setAuthed(false);
    setProfile(null);
    navigate("/login");
  };

  const ctx = { profile, setProfile, refreshProfile, login, logout };

  if (!authed) {
    return (
      <AppContext.Provider value={ctx}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AppContext.Provider>
    );
  }

  if (loading) return <div className="page-loading">Loading…</div>;

  // Profile gate: first login must complete the business profile (SRS 3.1.2)
  if (!profile && location.pathname !== "/setup") {
    return (
      <AppContext.Provider value={ctx}>
        <Navigate to="/setup" replace />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={ctx}>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Shell><Dashboard /></Shell>} />
        <Route path="/reviews" element={<Shell><Reviews /></Shell>} />
        <Route path="/themes" element={<Shell><Themes /></Shell>} />
        <Route path="/responses" element={<Shell><Responses /></Shell>} />
        <Route path="/responses/:reviewId" element={<Shell><Responses /></Shell>} />
        <Route path="/settings" element={<Shell><Settings /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppContext.Provider>
  );
}

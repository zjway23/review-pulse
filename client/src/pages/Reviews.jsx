import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { ReviewCard } from "../components.jsx";
import { useApp } from "../App.jsx";

const EMPTY_FILTERS = { rating: "", platform: "", sentiment: "", search: "", dateFrom: "", dateTo: "" };

export default function Reviews() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importErrors, setImportErrors] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = profile?.itemsPerPage || 10;

  const load = useCallback(async () => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
    const data = await api(`/reviews?${params}`);
    setReviews(data.reviews);
    setPlatforms(data.platforms);
  }, [filters]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    setPage(1);
  }, [load]);

  const setF = (key) => (e) => setFilters({ ...filters, [key]: e.target.value });

  const onImportFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError(""); setNotice(""); setImportErrors([]);
    if (file.size > 10 * 1024 * 1024) return setError("CSV exceeds the 10 MB limit.");
    setImporting(true);
    try {
      const csv = await file.text();
      const res = await api("/reviews/import", { method: "POST", body: { csv } });
      setNotice(`Imported ${res.imported} review${res.imported === 1 ? "" : "s"} successfully.`);
      setImportErrors(res.errors || []);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("Delete this review? This also removes its analysis and responses.")) return;
    await api(`/reviews/${id}`, { method: "DELETE" });
    await load();
  };

  const shown = reviews.slice(0, page * perPage);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Reviews Feed</h1>
          <p>{reviews.length} review{reviews.length === 1 ? "" : "s"} · newest first</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            {importing ? <span className="spinner" /> : "Import CSV"}
            <input type="file" accept=".csv,text/csv" onChange={onImportFile} style={{ display: "none" }} />
          </label>
          <button className="btn" onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancel" : "+ Add review"}</button>
        </div>
      </div>

      {notice && <p className="ok-msg">{notice}</p>}
      {error && <p className="error-msg">{error}</p>}
      {importErrors.length > 0 && (
        <div className="card" style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
          <h3>Rows skipped during import</h3>
          {importErrors.map((e, i) => <div className="hint" key={i}>{e}</div>)}
        </div>
      )}
      <p className="hint" style={{ marginTop: -8 }}>
        CSV needs columns: reviewerName, reviewText, starRating, reviewDate, platformSource (UTF-8, max 10 MB).
        Export these from your Google or Yelp business dashboard.
      </p>

      {showAdd && <AddReviewForm onDone={() => { setShowAdd(false); load(); }} />}

      <div className="filter-bar card">
        <label className="field search">
          Search
          <input placeholder="Search by keyword or reviewer…" value={filters.search} onChange={setF("search")} />
        </label>
        <label className="field">
          Rating
          <select value={filters.rating} onChange={setF("rating")}>
            <option value="">All</option>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} stars</option>)}
          </select>
        </label>
        <label className="field">
          Platform
          <select value={filters.platform} onChange={setF("platform")}>
            <option value="">All</option>
            {platforms.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label className="field">
          Sentiment
          <select value={filters.sentiment} onChange={setF("sentiment")}>
            <option value="">All</option>
            <option>Positive</option>
            <option>Neutral</option>
            <option>Negative</option>
          </select>
        </label>
        <label className="field">
          From
          <input type="date" value={filters.dateFrom} onChange={setF("dateFrom")} />
        </label>
        <label className="field">
          To
          <input type="date" value={filters.dateTo} onChange={setF("dateTo")} />
        </label>
        <button className="btn btn-ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
      </div>

      <div className="grid">
        {shown.length === 0 && <div className="empty card">No reviews match. Try clearing filters or import a CSV.</div>}
        {shown.map((r) => (
          <ReviewCard
            key={r.reviewId}
            review={r}
            actions={
              <>
                <button className="btn btn-sm" onClick={() => navigate(`/responses/${r.reviewId}`)}>
                  {r.hasResponse ? "View response" : "Generate response"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => remove(r.reviewId)}>Delete</button>
              </>
            }
          />
        ))}
      </div>
      {shown.length < reviews.length && (
        <p style={{ textAlign: "center" }}>
          <button className="btn btn-ghost" onClick={() => setPage(page + 1)}>
            Show more ({reviews.length - shown.length} remaining)
          </button>
        </p>
      )}
    </div>
  );
}

function AddReviewForm({ onDone }) {
  const [fields, setFields] = useState({
    reviewerName: "",
    reviewText: "",
    starRating: 5,
    reviewDate: new Date().toISOString().slice(0, 10),
    platformSource: "Google",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setFields({ ...fields, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/reviews", { method: "POST", body: fields });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card" style={{ marginBottom: 16 }} onSubmit={submit}>
      <h2>Add a review manually</h2>
      <div className="form-row">
        <label className="field">
          Reviewer name
          <input value={fields.reviewerName} onChange={set("reviewerName")} placeholder="Anonymous" />
        </label>
        <label className="field">
          Star rating
          <select value={fields.starRating} onChange={set("starRating")}>
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="field">
          Date
          <input type="date" value={fields.reviewDate} onChange={set("reviewDate")} required />
        </label>
        <label className="field">
          Platform
          <select value={fields.platformSource} onChange={set("platformSource")}>
            <option>Google</option>
            <option>Yelp</option>
            <option>Facebook</option>
            <option>TripAdvisor</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <label className="field">
        Review text *
        <textarea value={fields.reviewText} onChange={set("reviewText")} required placeholder="Paste the review text here…" />
      </label>
      {error && <p className="error-msg">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? <span className="spinner" /> : "Save review"}</button>
    </form>
  );
}

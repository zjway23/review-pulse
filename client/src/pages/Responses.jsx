import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { Stars, SentimentBadge } from "../components.jsx";

export default function Responses() {
  const { reviewId } = useParams();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null); // { draftId, text, similarityWarning }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const [r, h] = await Promise.all([api("/reviews"), api("/responses")]);
    // Most crucial first: negative & unanswered on top (SRS response page)
    const order = { Negative: 0, Neutral: 1, Positive: 2 };
    const sorted = [...r.reviews].sort((a, b) => {
      if (a.hasResponse !== b.hasResponse) return a.hasResponse ? 1 : -1;
      return (order[a.sentiment?.label] ?? 1) - (order[b.sentiment?.label] ?? 1);
    });
    setReviews(sorted);
    setHistory(h.responses);
    return sorted;
  };

  useEffect(() => {
    load()
      .then((sorted) => {
        if (reviewId) {
          const match = sorted.find((r) => r.reviewId === reviewId);
          if (match) setSelected(match);
        }
      })
      .catch((e) => setError(e.message));
  }, [reviewId]);

  const pick = (review) => {
    setSelected(review);
    setDraft(null);
    setNotice("");
    setError("");
    navigate(`/responses/${review.reviewId}`, { replace: true });
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { draft } = await api("/responses/generate", { method: "POST", body: { reviewId: selected.reviewId } });
      setDraft({ draftId: draft.draftId, text: draft.draftText, similarityWarning: draft.similarityWarning });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    try {
      await api(`/responses/${draft.draftId}/approve`, { method: "POST", body: { responseText: draft.text } });
      setDraft(null);
      setNotice("Response approved and saved. Copy it to the review platform when you're ready — Review Pulse never posts for you.");
      const sorted = await load();
      setSelected(sorted.find((r) => r.reviewId === selected.reviewId) || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    await api(`/responses/${draft.draftId}/discard`, { method: "POST" });
    setDraft(null);
  };

  const existing = selected && history.find((h) => h.reviewId === selected.reviewId);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Responses</h1>
          <p>Generate an on-brand draft, edit it, and approve. Nothing is ever posted automatically.</p>
        </div>
      </div>
      {error && <p className="error-msg">{error}</p>}

      <div className="response-layout">
        <div className="card">
          <h2>Pick a review</h2>
          <p className="hint">Unanswered negative reviews first.</p>
          <div className="pick-list">
            {reviews.map((r) => (
              <div
                key={r.reviewId}
                className={`review-pick ${selected?.reviewId === r.reviewId ? "selected" : ""}`}
                onClick={() => pick(r)}
              >
                <div className="review-top" style={{ gap: 6 }}>
                  <span className="review-name" style={{ fontSize: 13 }}>{r.reviewerName}</span>
                  <Stars rating={r.starRating} />
                  {r.hasResponse && <span className="responded-tag">✓</span>}
                </div>
                <span className="snippet">{r.reviewText.slice(0, 70)}…</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          {!selected && <div className="card empty">Select a review on the left to get started.</div>}
          {selected && (
            <div className="card">
              <div className="review-top">
                <span className="review-name">{selected.reviewerName}</span>
                <Stars rating={selected.starRating} />
                <SentimentBadge sentiment={selected.sentiment} />
                <span className="badge badge-platform">{selected.platformSource}</span>
                <span className="review-meta">{selected.reviewDate}</span>
              </div>
              <p className="review-text">{selected.reviewText}</p>
              <hr className="divider" />

              {existing && !draft && (
                <>
                  <h3>Sent response <span className="responded-tag">({new Date(existing.approvedAt).toLocaleDateString()})</span></h3>
                  <p className="review-text">{existing.responseText}</p>
                </>
              )}

              {notice && <p className="ok-msg">{notice}</p>}

              {!draft ? (
                <button className="btn" onClick={generate} disabled={busy}>
                  {busy ? <><span className="spinner" /> Generating…</> : existing ? "Generate another response" : "✨ Generate response"}
                </button>
              ) : (
                <>
                  <h3>Draft response — edit before approving</h3>
                  {draft.similarityWarning && <div className="similarity-warning">⚠ {draft.similarityWarning}</div>}
                  <textarea
                    value={draft.text}
                    onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                    rows={5}
                    style={{ marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="btn" onClick={approve} disabled={busy}>Approve & mark as sent</button>
                    <button className="btn btn-ghost" onClick={generate} disabled={busy}>
                      {busy ? <span className="spinner" /> : "Regenerate"}
                    </button>
                    <button className="btn btn-ghost" onClick={discard} disabled={busy}>Discard</button>
                  </div>
                  <p className="hint" style={{ marginBottom: 0 }}>
                    AI drafts are suggestions and can make mistakes — review before approving. Approving stores the response here; you post it to the platform yourself.
                  </p>
                </>
              )}
            </div>
          )}

          {history.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h2>Response history ({history.length})</h2>
              {history.map((h) => (
                <div key={h.responseId} style={{ borderBottom: "1px solid var(--grid)", padding: "8px 0" }}>
                  <div className="review-meta">
                    To {h.review?.reviewerName || "deleted review"} · {new Date(h.approvedAt).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-2)" }}>{h.responseText}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

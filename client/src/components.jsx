import React, { useState, useRef } from "react";

export function Stars({ rating }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= rating ? "" : "star-off"}>★</span>
      ))}
    </span>
  );
}

export function SentimentBadge({ sentiment }) {
  if (!sentiment) return <span className="badge badge-neutral"><span className="badge-dot" />Pending</span>;
  return (
    <span className={`badge badge-${sentiment.label.toLowerCase()}`} title={`Confidence: ${sentiment.confidence}%`}>
      <span className="badge-dot" />
      {sentiment.label}
    </span>
  );
}

export function ReviewCard({ review, actions }) {
  const [expanded, setExpanded] = useState(false);
  const long = review.reviewText.length > 150;
  const text = expanded || !long ? review.reviewText : review.reviewText.slice(0, 150) + "…";
  return (
    <div className="card review-card">
      <div className="review-top">
        <span className="review-name">{review.reviewerName}</span>
        <Stars rating={review.starRating} />
        <SentimentBadge sentiment={review.sentiment} />
        <span className="badge badge-platform">{review.platformSource}</span>
        <span className="review-meta">{review.reviewDate}</span>
        {review.hasResponse && <span className="responded-tag">✓ Responded</span>}
      </div>
      <p className="review-text">
        {text}{" "}
        {long && (
          <a href="#" onClick={(e) => { e.preventDefault(); setExpanded(!expanded); }}>
            {expanded ? "show less" : "read more"}
          </a>
        )}
      </p>
      {actions && <div className="review-actions">{actions}</div>}
    </div>
  );
}

// Single-series sentiment trend line (0–100) with crosshair tooltip.
export function TrendChart({ points, height = 180 }) {
  const [hover, setHover] = useState(null);
  const wrapRef = useRef(null);
  const width = 640;
  const pad = { top: 12, right: 12, bottom: 24, left: 34 };

  if (!points || points.length === 0) {
    return <div className="empty">Not enough data for a trend yet — import some reviews.</div>;
  }

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const x = (i) => pad.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v) => pad.top + innerH - (v / 100) * innerH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.avgSentiment).toFixed(1)}`).join(" ");

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let nearest = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(i) - px) < Math.abs(x(nearest) - px)) nearest = i;
    setHover({ i: nearest, left: (x(nearest) / width) * rect.width, top: (y(points[nearest].avgSentiment) / height) * rect.height });
  };

  const gridVals = [0, 50, 100];
  return (
    <div className="chart-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: "100%", display: "block" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label="Sentiment trend over time"
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke="var(--grid)" strokeWidth="1" />
            <text x={pad.left - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">{v}</text>
          </g>
        ))}
        {hover && (
          <line x1={x(hover.i)} x2={x(hover.i)} y1={pad.top} y2={height - pad.bottom} stroke="var(--baseline)" strokeWidth="1" strokeDasharray="3 3" />
        )}
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={x(i)} cy={y(p.avgSentiment)}
            r={hover?.i === i ? 5 : points.length <= 20 ? 3 : 0}
            fill="var(--accent)" stroke="var(--surface)" strokeWidth="2"
          />
        ))}
        <text x={pad.left} y={height - 6} fontSize="10" fill="var(--muted)">{points[0].date}</text>
        <text x={width - pad.right} y={height - 6} fontSize="10" fill="var(--muted)" textAnchor="end">
          {points[points.length - 1].date}
        </text>
      </svg>
      {hover && (
        <div className="chart-tooltip" style={{ left: hover.left, top: hover.top }}>
          <div>{points[hover.i].date}</div>
          <div className="tt-value">{points[hover.i].avgSentiment} / 100</div>
        </div>
      )}
    </div>
  );
}

// Horizontal star-rating breakdown bars (magnitude per ordered category → single hue).
export function StarBreakdown({ breakdown }) {
  const max = Math.max(1, ...breakdown.map((b) => b.count));
  return (
    <div>
      {[...breakdown].reverse().map((b) => (
        <div className="bar-row" key={b.star}>
          <span className="bar-label">{b.star} ★</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(b.count / max) * 100}%` }} title={`${b.count} reviews`} />
          </div>
          <span className="bar-value">{b.count} · {b.pct}%</span>
        </div>
      ))}
    </div>
  );
}

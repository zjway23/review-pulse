# Review Pulse

Web-based reputation management dashboard for small businesses. Import customer
reviews (CSV or paste), get AI sentiment + theme analysis, and draft on-brand
responses with a human-in-the-loop approval flow. Built from the Review Pulse
SRS/SDD (FAU Principles of Software Engineering).

## Quick start

```bash
npm install
npm --prefix client install
npm run build        # builds the React frontend into client/dist
npm run dev          # starts the server on http://localhost:4000
```

Open http://localhost:4000 and log in with the demo account:

- **Email:** `demo@reviewpulse.app`
- **Password:** `demo1234`

**Use the demo account for testing.** It is seeded with 54 reviews across 90
days — every star rating 1–5, five platforms, and three already-approved
responses — so the dashboard, filters, themes, and trend alerts all have data
immediately. A newly registered account starts empty by design (each account
only ever sees its own business's data), so if the app looks blank, check which
account you are logged into.

You can also sign up fresh and import your own CSV (columns: `reviewerName,
reviewText, starRating, reviewDate, platformSource`).

### The database

Data lives in `server/db.json`, written automatically as you use the app —
imported reviews, approved responses, and settings all survive a restart. The
file is gitignored, so a fresh clone seeds itself on first run.

To start over from clean demo data, delete it and restart:

```bash
rm server/db.json && npm run dev
```

### Frontend development (hot reload)

```bash
npm run dev      # terminal 1 — API on :4000
npm run client   # terminal 2 — Vite dev server on :5173, proxies /api to :4000
```

## Architecture

- `client/` — React + Vite SPA (Dashboard, Reviews Feed, Themes, Responses, Settings)
- `server/index.js` — Express REST API (all endpoints from SDD §3.2.1)
- `server/store.js` — **data-access layer** (see "Swapping in PostgreSQL")
- `server/ai.js` — sentiment, theme detection, response drafts, Jaccard similarity
- `server/analysis.js` — sentiment scoring, trend, top-5 themes, star breakdown, trend alerts
- `server/csv.js` — CSV validation/parsing (10 MB cap, row-level error log)
- `server/seed.js` — demo account + seed reviews

## Current stand-ins (by design, for the UI-first build)

| Piece | Now | Later |
|---|---|---|
| Database | JSON file (`server/db.json`) holding the SDD's tables; data survives restarts | PostgreSQL — reimplement the functions in `server/store.js` with SQL; nothing else changes |
| Auth | Local email/password with in-memory sessions + 5-strike lockout | Firebase Auth — replace register/login and the `requireAuth` middleware in `server/index.js` |
| AI | Keyword-rule sentiment/themes + template responses (works offline) | Set `OPENAI_API_KEY` in `.env` — `server/ai.js` already calls OpenAI when the key is present and falls back to the mock on API errors |

## Safety rules implemented

- Responses are **never** posted anywhere automatically — approval only marks
  them "sent" internally (SRS human-in-the-loop requirement).
- Drafts are checked against response history with Jaccard similarity and
  flagged if too close to a past reply.
- Bad CSV rows are rejected with clear errors without touching saved reviews.
- Each account only sees its own business's data.

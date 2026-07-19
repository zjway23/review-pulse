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

The demo account is seeded with ~35 reviews across 90 days so the dashboard,
themes, and trend alerts have data immediately. Or sign up for a fresh account
and import your own CSV (columns: `reviewerName, reviewText, starRating,
reviewDate, platformSource`).

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
| Database | In-memory arrays shaped like the SDD schema (data resets on restart) | PostgreSQL — reimplement the functions in `server/store.js` with SQL; nothing else changes |
| Auth | Local email/password with in-memory sessions + 5-strike lockout | Firebase Auth — replace register/login and the `requireAuth` middleware in `server/index.js` |
| AI | Keyword-rule sentiment/themes + template responses (works offline) | Set `OPENAI_API_KEY` in `.env` — `server/ai.js` already calls OpenAI when the key is present and falls back to the mock on API errors |

## Safety rules implemented

- Responses are **never** posted anywhere automatically — approval only marks
  them "sent" internally (SRS human-in-the-loop requirement).
- Drafts are checked against response history with Jaccard similarity and
  flagged if too close to a past reply.
- Bad CSV rows are rejected with clear errors without touching saved reviews.
- Each account only sees its own business's data.

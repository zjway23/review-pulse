// Review Pulse — Express REST API (SDD 3.2.1).
//
// Auth is a local mock standing in for Firebase Authentication: tokens are
// random session ids held in memory. To swap in Firebase later, replace
// register/login and the requireAuth middleware with Firebase Admin SDK
// verification — the route handlers stay the same.

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

import {
  findUserByEmail, createUser, getProfileByOwner, createProfile, updateProfile,
  addReview, getReviews, getReview, deleteReview, getSentiment,
  getThemes, getThemeReviews, addDraft, getDraft, removeDraft,
  addStoredResponse, getStoredResponses, getResponseForReview,
} from "./store.js";
import { runAnalysis, getAnalytics } from "./analysis.js";
import { generateResponse, jaccardSimilarity, SIMILARITY_THRESHOLD } from "./ai.js";
import { parseReviewCsv } from "./csv.js";
import { seedDemoData } from "./seed.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "12mb" })); // CSV cap is 10 MB per the SRS

// ---- session + lockout (in-memory, per SDD 3.1.1) ----
const sessions = new Map(); // token -> userId
const loginFailures = new Map(); // email -> { count, lockedUntil }
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function requireAuth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const userId = sessions.get(token);
  if (!userId) return res.status(401).json({ error: "Not authenticated" });
  req.userId = userId;
  req.profile = getProfileByOwner(userId);
  next();
}

// ---- Authentication ----
app.post("/api/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });
  if (findUserByEmail(email)) return res.status(400).json({ error: "An account with that email already exists" });
  const user = createUser(email, password);
  const token = randomUUID();
  sessions.set(token, user.userId);
  res.json({ token, email: user.email, hasProfile: false });
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const failure = loginFailures.get(email.toLowerCase());
  if (failure?.lockedUntil && Date.now() < failure.lockedUntil) {
    const mins = Math.ceil((failure.lockedUntil - Date.now()) / 60000);
    return res.status(401).json({ error: `Account locked after too many failed attempts. Try again in ${mins} min.` });
  }

  const user = findUserByEmail(email);
  if (!user || user.password !== password) {
    const entry = loginFailures.get(email.toLowerCase()) || { count: 0, lockedUntil: null };
    entry.count++;
    if (entry.count >= MAX_FAILURES) {
      entry.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
      entry.count = 0;
    }
    loginFailures.set(email.toLowerCase(), entry);
    return res.status(401).json({ error: "Incorrect email or password. Please try again." });
  }

  loginFailures.delete(email.toLowerCase());
  const token = randomUUID();
  sessions.set(token, user.userId);
  res.json({ token, email: user.email, hasProfile: !!getProfileByOwner(user.userId) });
});

app.post("/api/logout", requireAuth, (req, res) => {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  sessions.delete(token);
  res.json({ ok: true });
});

app.post("/api/reset-password", (req, res) => {
  // Mock: in production this sends a reset link via Firebase.
  res.json({ ok: true, message: "If an account exists for that email, a reset link has been sent." });
});

// ---- Profile & Settings ----
app.get("/api/profile", requireAuth, (req, res) => {
  res.json({ profile: req.profile });
});

app.put("/api/profile", requireAuth, (req, res) => {
  const fields = req.body || {};
  if (!req.profile) {
    if (!fields.name || !fields.type) return res.status(400).json({ error: "Business name and type are required" });
    return res.json({ profile: createProfile(req.userId, fields) });
  }
  res.json({ profile: updateProfile(req.profile.businessId, fields) });
});

// Settings live on the business profile (SDD 3.1.2); same PUT handles both.
app.get("/api/settings", requireAuth, (req, res) => res.json({ settings: req.profile }));
app.put("/api/settings", requireAuth, (req, res) => {
  if (!req.profile) return res.status(400).json({ error: "Complete your business profile first" });
  res.json({ settings: updateProfile(req.profile.businessId, req.body || {}) });
});

// ---- Review Ingestion & Management ----
function requireProfile(req, res, next) {
  if (!req.profile) return res.status(400).json({ error: "Complete your business profile first" });
  next();
}

app.post("/api/reviews/import", requireAuth, requireProfile, async (req, res) => {
  const { csv } = req.body || {};
  if (!csv) return res.status(400).json({ error: "No CSV content provided" });
  if (Buffer.byteLength(csv, "utf8") > 10 * 1024 * 1024)
    return res.status(400).json({ error: "CSV exceeds the 10 MB limit" });
  const result = parseReviewCsv(csv);
  if (result.error) return res.status(400).json({ error: result.error });
  for (const record of result.valid) addReview(req.profile.businessId, record);
  await runAnalysis(req.profile.businessId);
  res.json({ imported: result.valid.length, errors: result.errors });
});

app.post("/api/reviews", requireAuth, requireProfile, async (req, res) => {
  const { reviewerName, reviewText, starRating, reviewDate, platformSource } = req.body || {};
  if (!reviewText || !starRating || !reviewDate)
    return res.status(400).json({ error: "Review text, star rating, and date are required" });
  const review = addReview(req.profile.businessId, { reviewerName, reviewText, starRating, reviewDate, platformSource });
  await runAnalysis(req.profile.businessId);
  res.json({ review });
});

app.get("/api/reviews", requireAuth, requireProfile, (req, res) => {
  const { rating, platform, sentiment, search, dateFrom, dateTo } = req.query;
  let reviews = getReviews(req.profile.businessId);
  if (rating) reviews = reviews.filter((r) => r.starRating === Number(rating));
  if (platform) reviews = reviews.filter((r) => r.platformSource.toLowerCase() === String(platform).toLowerCase());
  if (dateFrom) reviews = reviews.filter((r) => r.reviewDate >= dateFrom);
  if (dateTo) reviews = reviews.filter((r) => r.reviewDate <= dateTo);
  if (search) {
    const q = String(search).toLowerCase();
    reviews = reviews.filter(
      (r) => r.reviewText.toLowerCase().includes(q) || r.reviewerName.toLowerCase().includes(q)
    );
  }
  let result = reviews.map((r) => ({
    ...r,
    sentiment: getSentiment(r.reviewId),
    hasResponse: !!getResponseForReview(r.reviewId),
  }));
  if (sentiment) result = result.filter((r) => r.sentiment?.label === sentiment);
  result.sort((a, b) => b.reviewDate.localeCompare(a.reviewDate)); // most recent first
  res.json({ reviews: result, platforms: [...new Set(getReviews(req.profile.businessId).map((r) => r.platformSource))] });
});

app.delete("/api/reviews/:id", requireAuth, requireProfile, (req, res) => {
  const review = getReview(req.params.id);
  if (!review || review.businessId !== req.profile.businessId)
    return res.status(404).json({ error: "Review not found" });
  deleteReview(req.params.id);
  res.json({ ok: true });
});

// ---- Sentiment & Theme Analysis ----
app.post("/api/analyze", requireAuth, requireProfile, async (req, res) => {
  const result = await runAnalysis(req.profile.businessId);
  res.json(result);
});

app.get("/api/analytics", requireAuth, requireProfile, (req, res) => {
  const windowDays = [30, 60, 90].includes(Number(req.query.window)) ? Number(req.query.window) : 30;
  res.json(getAnalytics(req.profile.businessId, windowDays, req.profile.alertThresholdPct));
});

app.get("/api/themes", requireAuth, requireProfile, (req, res) => {
  const themes = getThemes(req.profile.businessId)
    .filter((t) => t.reviewCount > 0)
    .sort((a, b) => b.reviewCount - a.reviewCount);
  res.json({ themes });
});

app.get("/api/themes/:id/reviews", requireAuth, requireProfile, (req, res) => {
  const reviews = getThemeReviews(req.params.id)
    .filter((r) => r.businessId === req.profile.businessId)
    .map((r) => ({ ...r, sentiment: getSentiment(r.reviewId) }));
  res.json({ reviews });
});

// ---- Response Generation & Drafting ----
app.post("/api/responses/generate", requireAuth, requireProfile, async (req, res) => {
  const review = getReview(req.body?.reviewId);
  if (!review || review.businessId !== req.profile.businessId)
    return res.status(404).json({ error: "Review not found" });
  const sentiment = getSentiment(review.reviewId);
  const draftText = await generateResponse(review, sentiment?.label || "Neutral", req.profile);

  // Similarity check against past responses (Jaccard, SDD 3.1.5)
  let similarityWarning = null;
  for (const past of getStoredResponses(req.profile.businessId)) {
    const score = jaccardSimilarity(draftText, past.responseText);
    if (score >= SIMILARITY_THRESHOLD) {
      similarityWarning = `This draft is ${Math.round(score * 100)}% similar to a response you already sent.`;
      break;
    }
  }
  const draft = addDraft(review.reviewId, draftText, similarityWarning);
  res.json({ draft });
});

app.post("/api/responses/:id/approve", requireAuth, requireProfile, (req, res) => {
  const draft = getDraft(req.params.id);
  if (!draft) return res.status(404).json({ error: "Draft not found" });
  // The approved text may have been edited by the owner before approval.
  const responseText = req.body?.responseText || draft.draftText;
  const stored = addStoredResponse(draft.reviewId, req.profile.businessId, responseText);
  removeDraft(draft.draftId);
  res.json({ response: stored });
});

app.post("/api/responses/:id/discard", requireAuth, requireProfile, (req, res) => {
  removeDraft(req.params.id);
  res.json({ ok: true });
});

app.get("/api/responses", requireAuth, requireProfile, (req, res) => {
  const responses = getStoredResponses(req.profile.businessId)
    .map((s) => ({ ...s, review: getReview(s.reviewId) }))
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt));
  res.json({ responses });
});

// ---- static frontend in production ----
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(dist));
app.get(/^\/(?!api).*/, (req, res, next) => {
  res.sendFile(path.join(dist, "index.html"), (err) => err && next());
});

const PORT = process.env.PORT || 4000;
await seedDemoData();
app.listen(PORT, () => {
  console.log(`Review Pulse API running on http://localhost:${PORT}`);
  console.log(`Demo login: demo@reviewpulse.app / demo1234`);
  console.log(process.env.OPENAI_API_KEY ? "OpenAI: enabled" : "OpenAI: not configured — using local mock AI");
});

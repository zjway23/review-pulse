// JSON-file data store for Review Pulse.
//
// This module is the single data-access layer. Every table from the SDD
// (section 4.2) is an array below, and all reads/writes go through the
// exported repository functions. To move to PostgreSQL later, reimplement
// these functions with SQL queries — nothing outside this file needs to change.
//
// Persistence: the whole db object is mirrored to server/db.json. Tables are
// held in memory and reads stay synchronous; writes mark the db dirty and one
// flush runs after the current request finishes, so a 500-row CSV import costs
// one disk write instead of 500.

import { randomUUID } from "crypto";
import { existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "db.json");

const emptyDb = () => ({
  users: [],            // { userId, email, password, businessId, createdAt }
  businessProfiles: [], // { businessId, ownerUserId, name, type, description, toneProfile, responseLength, alertThresholdPct, theme, itemsPerPage, createdAt }
  reviews: [],          // { reviewId, businessId, reviewerName, reviewText, starRating, reviewDate, platformSource }
  sentimentResults: [], // { reviewId, label, confidence }
  themes: [],           // { themeId, businessId, label, polarity, reviewCount }
  reviewThemes: [],     // { reviewId, themeId }
  responseDrafts: [],   // { draftId, reviewId, draftText, generatedAt, similarityWarning }
  storedResponses: [],  // { responseId, reviewId, businessId, responseText, status, approvedAt }
});

function load() {
  if (!existsSync(DB_FILE)) return emptyDb();
  try {
    // Spread over emptyDb() so a db.json written before a table was added
    // still loads, with the missing table defaulting to [].
    return { ...emptyDb(), ...JSON.parse(readFileSync(DB_FILE, "utf8")) };
  } catch (err) {
    console.error(`Could not read ${DB_FILE} (${err.message}) — starting with an empty database.`);
    return emptyDb();
  }
}

export const db = load();

export const isEmpty = () => db.users.length === 0;

let dirty = false;

// Write to a temp file and rename, so a crash mid-write can't leave a
// half-written db.json behind — rename is atomic.
export function save() {
  dirty = false;
  const tmp = `${DB_FILE}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify(db, null, 2));
    renameSync(tmp, DB_FILE);
  } catch (err) {
    console.error(`Could not write ${DB_FILE}: ${err.message}`);
  }
}

function scheduleSave() {
  if (dirty) return; // a flush is already queued; this change rides along
  dirty = true;
  setImmediate(save);
}

process.on("exit", () => dirty && save());
process.on("SIGINT", () => process.exit(0));  // Ctrl-C: run the exit handler
process.on("SIGTERM", () => process.exit(0));

export const uuid = () => randomUUID();

// ---- users ----
export const findUserByEmail = (email) =>
  db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
export const createUser = (email, password) => {
  const user = { userId: uuid(), email, password, businessId: null, createdAt: new Date().toISOString() };
  db.users.push(user);
  scheduleSave();
  return user;
};

// ---- business profile / settings ----
export const getProfile = (businessId) =>
  db.businessProfiles.find((b) => b.businessId === businessId) || null;
export const getProfileByOwner = (userId) =>
  db.businessProfiles.find((b) => b.ownerUserId === userId) || null;
export const createProfile = (ownerUserId, fields) => {
  const profile = {
    businessId: uuid(),
    ownerUserId,
    name: "",
    type: "",
    description: "",
    toneProfile: "Friendly",
    responseLength: "Medium",
    alertThresholdPct: 30,
    theme: "light",
    itemsPerPage: 10,
    createdAt: new Date().toISOString(),
    ...fields,
  };
  db.businessProfiles.push(profile);
  const user = db.users.find((u) => u.userId === ownerUserId);
  if (user) user.businessId = profile.businessId;
  scheduleSave();
  return profile;
};
export const updateProfile = (businessId, fields) => {
  const profile = getProfile(businessId);
  if (profile) Object.assign(profile, fields);
  scheduleSave();
  return profile;
};

// ---- reviews ----
export const addReview = (businessId, r) => {
  const review = {
    reviewId: uuid(),
    businessId,
    reviewerName: r.reviewerName || "Anonymous",
    reviewText: r.reviewText,
    starRating: Number(r.starRating),
    reviewDate: r.reviewDate,
    platformSource: r.platformSource || "Other",
  };
  db.reviews.push(review);
  scheduleSave();
  return review;
};
export const getReviews = (businessId) => db.reviews.filter((r) => r.businessId === businessId);
export const getReview = (reviewId) => db.reviews.find((r) => r.reviewId === reviewId) || null;
export const deleteReview = (reviewId) => {
  db.reviews = db.reviews.filter((r) => r.reviewId !== reviewId);
  db.sentimentResults = db.sentimentResults.filter((s) => s.reviewId !== reviewId);
  db.reviewThemes = db.reviewThemes.filter((rt) => rt.reviewId !== reviewId);
  db.responseDrafts = db.responseDrafts.filter((d) => d.reviewId !== reviewId);
  db.storedResponses = db.storedResponses.filter((s) => s.reviewId !== reviewId);
  scheduleSave();
};

// ---- sentiment ----
export const setSentiment = (reviewId, label, confidence) => {
  const existing = db.sentimentResults.find((s) => s.reviewId === reviewId);
  if (existing) Object.assign(existing, { label, confidence });
  else db.sentimentResults.push({ reviewId, label, confidence });
  scheduleSave();
};
export const getSentiment = (reviewId) =>
  db.sentimentResults.find((s) => s.reviewId === reviewId) || null;

// ---- themes ----
export const upsertTheme = (businessId, label, polarity) => {
  let theme = db.themes.find(
    (t) => t.businessId === businessId && t.label === label && t.polarity === polarity
  );
  if (!theme) {
    theme = { themeId: uuid(), businessId, label, polarity, reviewCount: 0 };
    db.themes.push(theme);
    scheduleSave();
  }
  return theme;
};
export const linkReviewTheme = (reviewId, themeId) => {
  if (!db.reviewThemes.find((rt) => rt.reviewId === reviewId && rt.themeId === themeId)) {
    db.reviewThemes.push({ reviewId, themeId });
    scheduleSave();
  }
};
export const recountThemes = (businessId) => {
  for (const theme of db.themes.filter((t) => t.businessId === businessId)) {
    theme.reviewCount = db.reviewThemes.filter((rt) => rt.themeId === theme.themeId).length;
  }
  scheduleSave();
};
export const getThemes = (businessId) => db.themes.filter((t) => t.businessId === businessId);
export const getThemeReviews = (themeId) => {
  const ids = db.reviewThemes.filter((rt) => rt.themeId === themeId).map((rt) => rt.reviewId);
  return db.reviews.filter((r) => ids.includes(r.reviewId));
};

// ---- drafts & responses ----
export const addDraft = (reviewId, draftText, similarityWarning) => {
  const draft = { draftId: uuid(), reviewId, draftText, generatedAt: new Date().toISOString(), similarityWarning };
  db.responseDrafts.push(draft);
  scheduleSave();
  return draft;
};
export const getDraft = (draftId) => db.responseDrafts.find((d) => d.draftId === draftId) || null;
export const removeDraft = (draftId) => {
  db.responseDrafts = db.responseDrafts.filter((d) => d.draftId !== draftId);
  scheduleSave();
};
export const addStoredResponse = (reviewId, businessId, responseText) => {
  const resp = {
    responseId: uuid(),
    reviewId,
    businessId,
    responseText,
    status: "sent",
    approvedAt: new Date().toISOString(),
  };
  db.storedResponses.push(resp);
  scheduleSave();
  return resp;
};
export const getStoredResponses = (businessId) =>
  db.storedResponses.filter((s) => s.businessId === businessId);
export const getResponseForReview = (reviewId) =>
  db.storedResponses.find((s) => s.reviewId === reviewId) || null;

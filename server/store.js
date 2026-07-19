// In-memory data store for Review Pulse.
//
// This module is the single data-access layer. Every table from the SDD
// (section 4.2) is an array below, and all reads/writes go through the
// exported repository functions. To move to PostgreSQL later, reimplement
// these functions with SQL queries — nothing outside this file needs to change.

import { randomUUID } from "crypto";

export const db = {
  users: [],            // { userId, email, password, businessId, createdAt }
  businessProfiles: [], // { businessId, ownerUserId, name, type, description, toneProfile, responseLength, alertThresholdPct, theme, itemsPerPage, createdAt }
  reviews: [],          // { reviewId, businessId, reviewerName, reviewText, starRating, reviewDate, platformSource }
  sentimentResults: [], // { reviewId, label, confidence }
  themes: [],           // { themeId, businessId, label, polarity, reviewCount }
  reviewThemes: [],     // { reviewId, themeId }
  responseDrafts: [],   // { draftId, reviewId, draftText, generatedAt, similarityWarning }
  storedResponses: [],  // { responseId, reviewId, businessId, responseText, status, approvedAt }
};

export const uuid = () => randomUUID();

// ---- users ----
export const findUserByEmail = (email) =>
  db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
export const createUser = (email, password) => {
  const user = { userId: uuid(), email, password, businessId: null, createdAt: new Date().toISOString() };
  db.users.push(user);
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
  return profile;
};
export const updateProfile = (businessId, fields) => {
  const profile = getProfile(businessId);
  if (profile) Object.assign(profile, fields);
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
};

// ---- sentiment ----
export const setSentiment = (reviewId, label, confidence) => {
  const existing = db.sentimentResults.find((s) => s.reviewId === reviewId);
  if (existing) Object.assign(existing, { label, confidence });
  else db.sentimentResults.push({ reviewId, label, confidence });
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
  }
  return theme;
};
export const linkReviewTheme = (reviewId, themeId) => {
  if (!db.reviewThemes.find((rt) => rt.reviewId === reviewId && rt.themeId === themeId)) {
    db.reviewThemes.push({ reviewId, themeId });
  }
};
export const recountThemes = (businessId) => {
  for (const theme of db.themes.filter((t) => t.businessId === businessId)) {
    theme.reviewCount = db.reviewThemes.filter((rt) => rt.themeId === theme.themeId).length;
  }
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
  return draft;
};
export const getDraft = (draftId) => db.responseDrafts.find((d) => d.draftId === draftId) || null;
export const removeDraft = (draftId) => {
  db.responseDrafts = db.responseDrafts.filter((d) => d.draftId !== draftId);
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
  return resp;
};
export const getStoredResponses = (businessId) =>
  db.storedResponses.filter((s) => s.businessId === businessId);
export const getResponseForReview = (reviewId) =>
  db.storedResponses.find((s) => s.reviewId === reviewId) || null;

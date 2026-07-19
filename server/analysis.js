// Sentiment & Theme Analysis component (SDD 3.1.4) plus dashboard analytics.

import {
  getReviews, getSentiment, setSentiment, upsertTheme, linkReviewTheme,
  recountThemes, getThemes, db,
} from "./store.js";
import { analyzeSentiment, detectThemes } from "./ai.js";

const LABEL_SCORE = { Positive: 100, Neutral: 50, Negative: 0 };

// Analyze any reviews that don't yet have a sentiment result, and (re)build themes.
export async function runAnalysis(businessId) {
  const reviews = getReviews(businessId);
  let analyzed = 0;
  // Batch of 20 per the SDD; the mock is local so batching only matters for OpenAI.
  for (const review of reviews) {
    if (!getSentiment(review.reviewId)) {
      const { label, confidence } = await analyzeSentiment(review.reviewText, review.starRating);
      setSentiment(review.reviewId, label, confidence);
      analyzed++;
    }
    for (const rule of detectThemes(review.reviewText)) {
      const theme = upsertTheme(businessId, rule.label, rule.polarity);
      linkReviewTheme(review.reviewId, theme.themeId);
    }
  }
  recountThemes(businessId);
  return { analyzed, total: reviews.length };
}

export function getAnalytics(businessId, windowDays = 30, alertThresholdPct = 30) {
  const reviews = getReviews(businessId);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - windowDays);
  const inWindow = reviews.filter((r) => new Date(r.reviewDate) >= cutoff);

  // Overall sentiment score: unweighted mean of label scores (SDD 3.1.4)
  const labeled = reviews
    .map((r) => getSentiment(r.reviewId))
    .filter(Boolean);
  const overallScore = labeled.length
    ? Math.round(labeled.reduce((sum, s) => sum + LABEL_SCORE[s.label], 0) / labeled.length)
    : null;

  // Trend points: 7-day trailing average so single-review days don't whipsaw the line
  const daily = [];
  for (const review of inWindow) {
    const sentiment = getSentiment(review.reviewId);
    if (!sentiment) continue;
    daily.push({ date: review.reviewDate.slice(0, 10), score: LABEL_SCORE[sentiment.label] });
  }
  daily.sort((a, b) => a.date.localeCompare(b.date));
  const days = [...new Set(daily.map((d) => d.date))];
  const trend = days.map((date) => {
    const from = new Date(date);
    from.setDate(from.getDate() - 6);
    const fromStr = from.toISOString().slice(0, 10);
    const windowScores = daily.filter((d) => d.date >= fromStr && d.date <= date).map((d) => d.score);
    return {
      date,
      avgSentiment: Math.round(windowScores.reduce((a, b) => a + b, 0) / windowScores.length),
    };
  });

  // Top 5 praise / complaint themes
  const themes = getThemes(businessId).filter((t) => t.reviewCount > 0);
  const top = (polarity) =>
    themes
      .filter((t) => t.polarity === polarity)
      .sort((a, b) => b.reviewCount - a.reviewCount)
      .slice(0, 5);

  // Star rating breakdown (counts + percentages)
  const starBreakdown = [1, 2, 3, 4, 5].map((star) => {
    const count = reviews.filter((r) => r.starRating === star).length;
    return { star, count, pct: reviews.length ? Math.round((count / reviews.length) * 100) : 0 };
  });

  // Trend alerts: complaint theme mentions this week vs last week above threshold
  const alerts = [];
  const now = Date.now();
  const week = 7 * 24 * 3600 * 1000;
  for (const theme of themes.filter((t) => t.polarity === "complaint")) {
    const themeReviewIds = db.reviewThemes.filter((rt) => rt.themeId === theme.themeId).map((rt) => rt.reviewId);
    const themeReviews = reviews.filter((r) => themeReviewIds.includes(r.reviewId));
    const thisWeek = themeReviews.filter((r) => now - new Date(r.reviewDate).getTime() < week).length;
    const lastWeek = themeReviews.filter((r) => {
      const age = now - new Date(r.reviewDate).getTime();
      return age >= week && age < 2 * week;
    }).length;
    const increasePct = lastWeek === 0 ? (thisWeek > 1 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
    if (increasePct >= alertThresholdPct && thisWeek > 0) {
      alerts.push({ theme: theme.label, thisWeek, lastWeek, increasePct });
    }
  }

  const distribution = { Positive: 0, Neutral: 0, Negative: 0 };
  for (const s of labeled) distribution[s.label]++;

  return {
    overallScore,
    reviewCount: reviews.length,
    analyzedCount: labeled.length,
    distribution,
    trend,
    praiseThemes: top("praise"),
    complaintThemes: top("complaint"),
    starBreakdown,
    alerts,
  };
}

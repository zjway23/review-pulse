// AI layer for Review Pulse.
//
// If OPENAI_API_KEY is set, sentiment analysis and response generation go
// through the OpenAI API. Otherwise a local mock (keyword rules + templates)
// is used so the whole app works with zero external dependencies.

const OPENAI_KEY = process.env.OPENAI_API_KEY || null;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------------- Theme detection (always local keyword clustering) ----------------

const THEME_RULES = [
  { label: "Slow service", polarity: "complaint", keywords: ["slow", "waited", "wait time", "took forever", "waiting", "45 minutes", "an hour"] },
  { label: "Friendly staff", polarity: "praise", keywords: ["friendly", "kind", "welcoming", "sweet", "warm staff", "great staff", "attentive"] },
  { label: "Rude staff", polarity: "complaint", keywords: ["rude", "dismissive", "ignored", "attitude", "unprofessional"] },
  { label: "Food quality", polarity: "praise", keywords: ["delicious", "tasty", "amazing food", "best food", "flavorful", "fresh", "incredible"] },
  { label: "Cold food", polarity: "complaint", keywords: ["cold food", "lukewarm", "arrived cold", "not hot", "cold when"] },
  { label: "Great atmosphere", polarity: "praise", keywords: ["atmosphere", "cozy", "ambiance", "vibe", "decor", "charming"] },
  { label: "Parking", polarity: "complaint", keywords: ["parking", "no spots", "park"] },
  { label: "Prices", polarity: "complaint", keywords: ["expensive", "overpriced", "pricey", "too much money", "price"] },
  { label: "Good value", polarity: "praise", keywords: ["good value", "affordable", "reasonable", "worth every"] },
  { label: "Cleanliness", polarity: "complaint", keywords: ["dirty", "sticky", "unclean", "messy", "bathroom was"] },
  { label: "Order mistakes", polarity: "complaint", keywords: ["wrong order", "forgot", "missing", "mixed up", "incorrect"] },
  { label: "Fast service", polarity: "praise", keywords: ["quick", "fast service", "prompt", "right away", "speedy"] },
];

export function detectThemes(reviewText) {
  const text = reviewText.toLowerCase();
  return THEME_RULES.filter((rule) => rule.keywords.some((k) => text.includes(k)));
}

// ---------------- Sentiment ----------------

const POSITIVE_WORDS = ["great", "amazing", "love", "excellent", "wonderful", "best", "delicious", "friendly", "perfect", "fantastic", "awesome", "incredible", "recommend", "favorite", "cozy", "fresh", "attentive"];
const NEGATIVE_WORDS = ["bad", "terrible", "awful", "worst", "rude", "slow", "cold", "dirty", "disappointing", "disappointed", "never again", "overpriced", "wrong", "horrible", "mediocre", "bland", "ignored"];

function mockSentiment(reviewText, starRating) {
  const text = reviewText.toLowerCase();
  const pos = POSITIVE_WORDS.filter((w) => text.includes(w)).length;
  const neg = NEGATIVE_WORDS.filter((w) => text.includes(w)).length;
  // Blend keyword signal with star rating
  let score = (starRating - 3) + (pos - neg) * 0.75;
  let label = score > 0.5 ? "Positive" : score < -0.5 ? "Negative" : "Neutral";
  const confidence = Math.max(55, Math.min(98, Math.round(60 + Math.abs(score) * 12)));
  return { label, confidence };
}

async function openaiSentiment(reviewText) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: "system", content: 'Classify the customer review. Reply with JSON only: {"label":"Positive|Neutral|Negative","confidence":0-100}' },
        { role: "user", content: reviewText },
      ],
      temperature: 0,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}

export async function analyzeSentiment(reviewText, starRating) {
  if (OPENAI_KEY) {
    try {
      return await openaiSentiment(reviewText);
    } catch {
      // fall through to mock on API failure (SRS reliability requirement)
    }
  }
  return mockSentiment(reviewText, starRating);
}

// ---------------- Response generation ----------------

const OPENERS = {
  Friendly: { Positive: "Thank you so much", Neutral: "Thanks for taking the time", Negative: "We're really sorry" },
  Professional: { Positive: "Thank you", Neutral: "We appreciate you taking the time", Negative: "We sincerely apologize" },
  Formal: { Positive: "We are grateful", Neutral: "We appreciate your feedback", Negative: "Please accept our sincere apologies" },
};

function mockResponse(review, sentimentLabel, tone, length) {
  const name = review.reviewerName && review.reviewerName !== "Anonymous" ? review.reviewerName.split(" ")[0] : "there";
  const opener = (OPENERS[tone] || OPENERS.Friendly)[sentimentLabel] || OPENERS.Friendly.Neutral;
  const themes = detectThemes(review.reviewText);
  const themeMention = themes.length
    ? themes[0].polarity === "praise"
      ? `We're thrilled you noticed our ${themes[0].label.toLowerCase()} — our team works hard on that.`
      : `We hear you on the ${themes[0].label.toLowerCase()} issue and we're already working on making it right.`
    : sentimentLabel === "Negative"
      ? "Your experience is not the standard we hold ourselves to, and we're looking into what went wrong."
      : "Feedback like yours helps us keep improving.";
  const invite =
    sentimentLabel === "Negative"
      ? "We'd love the chance to make it up to you — please give us another try."
      : "We hope to see you again soon!";

  const parts = [`Hi ${name}, ${opener.toLowerCase() === opener ? opener : opener} for your ${review.starRating}-star review.`, themeMention, invite];
  if (length === "Short") return `${parts[0]} ${parts[2]}`;
  if (length === "Long")
    return `${parts[0]} ${parts[1]} ${sentimentLabel === "Negative" ? "We've shared your comments directly with our team so it doesn't happen again." : "It truly means a lot to the whole team."} ${parts[2]}`;
  return parts.join(" ");
}

async function openaiResponse(review, profile, tone, length) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content: `You draft replies to customer reviews for "${profile.name}" (${profile.type}). Tone: ${tone}. Length: ${length}. Structure: acknowledge, address their specific points, invite them back. Reply with the response text only.`,
        },
        { role: "user", content: `${review.starRating}-star review from ${review.reviewerName}: "${review.reviewText}"` },
      ],
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content.trim();
}

export async function generateResponse(review, sentimentLabel, profile) {
  const tone = profile.toneProfile || "Friendly";
  const length = profile.responseLength || "Medium";
  if (OPENAI_KEY) {
    try {
      return await openaiResponse(review, profile, tone, length);
    } catch {
      // fall back to mock
    }
  }
  return mockResponse(review, sentimentLabel, tone, length);
}

// ---------------- Similarity (Jaccard word overlap, per SDD 3.1.5) ----------------

const normalize = (text) =>
  new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
  );

export function jaccardSimilarity(a, b) {
  const setA = normalize(a);
  const setB = normalize(b);
  if (!setA.size || !setB.size) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

export const SIMILARITY_THRESHOLD = 0.6;

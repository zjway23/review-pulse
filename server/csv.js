// Minimal CSV parser (handles quoted fields and escaped quotes).
// Required columns per SRS 3.1.3: reviewerName, reviewText, starRating, reviewDate, platformSource.

const REQUIRED = ["reviewername", "reviewtext", "starrating", "reviewdate", "platformsource"];

// Also accept common export header spellings
const HEADER_ALIASES = {
  reviewername: ["reviewername", "reviewer_name", "reviewer", "name", "author"],
  reviewtext: ["reviewtext", "review_text", "review", "text", "comment", "content"],
  starrating: ["starrating", "star_rating", "rating", "stars", "score"],
  reviewdate: ["reviewdate", "review_date", "date", "created", "published"],
  platformsource: ["platformsource", "platform_source", "platform", "source", "site"],
};

function parseRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export function parseReviewCsv(text) {
  const rows = parseRows(text);
  if (rows.length < 2) return { error: "CSV must have a header row and at least one review row." };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, ""));
  const colIndex = {};
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx !== -1) colIndex[canonical] = idx;
  }
  const missing = REQUIRED.filter((c) => !(c in colIndex));
  if (missing.length) {
    return { error: `CSV is missing required columns: ${missing.join(", ")}. Expected headers: reviewerName, reviewText, starRating, reviewDate, platformSource.` };
  }

  const valid = [];
  const errors = [];
  rows.slice(1).forEach((row, i) => {
    const line = i + 2;
    const record = {
      reviewerName: (row[colIndex.reviewername] || "").trim(),
      reviewText: (row[colIndex.reviewtext] || "").trim(),
      starRating: Number((row[colIndex.starrating] || "").trim()),
      reviewDate: (row[colIndex.reviewdate] || "").trim(),
      platformSource: (row[colIndex.platformsource] || "").trim(),
    };
    if (!record.reviewText) errors.push(`Row ${line}: missing review text`);
    else if (!record.starRating || record.starRating < 1 || record.starRating > 5)
      errors.push(`Row ${line}: star rating must be 1-5`);
    else if (!record.reviewDate || isNaN(Date.parse(record.reviewDate)))
      errors.push(`Row ${line}: invalid or missing review date`);
    else valid.push(record);
  });
  return { valid, errors };
}

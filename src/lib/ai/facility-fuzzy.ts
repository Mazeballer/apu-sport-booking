// src/lib/ai/facility-fuzzy.ts
import Fuse from "fuse.js";

export type FacilityForMatch = {
  id: string;
  name: string;
  type: string;
};

// A bit more tolerant than before
// 0 means exact, 1 means very loose
const THRESHOLD = 0.5;

const STOP_WORDS = new Set([
  "what",
  "which",
  "when",
  "where",
  "how",
  "can",
  "could",
  "you",
  "i",
  "me",
  "my",
  "please",
  "book",
  "booking",
  "reserve",
  "schedule",
  "time",
  "times",
  "slot",
  "slots",
  "available",
  "availability",
  "free",
  "tomorrow",
  "today",
  "tonight",
  "morning",
  "afternoon",
  "evening",
  "at",
  "on",
  "for",
  "to",
  "the",
  "a",
  "an",
  "this",
  "that",
  "there",
  "any",
]);

function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const clean = lower.replace(/[^a-z0-9\s]/g, " ");
  const tokens = clean.split(/\s+/).filter(Boolean);

  const keywords = tokens.filter((t) => {
    if (STOP_WORDS.has(t)) return false;
    if (t.length < 3) return false;
    return true;
  });

  // If everything got filtered out, fall back to the original tokens
  return keywords.length > 0 ? keywords : tokens;
}

export function findBestMatchingFacility(
  questionText: string,
  facilities: FacilityForMatch[]
): FacilityForMatch | null {
  if (!questionText || facilities.length === 0) return null;

  const keywords = extractKeywords(questionText);
  const query = keywords.join(" ");

  const fuse = new Fuse(facilities, {
    keys: ["name", "type"],
    threshold: THRESHOLD,
    includeScore: true,
    ignoreLocation: true,
    distance: 100,
    minMatchCharLength: 2,
  });

  // First try using all keywords together
  let result = fuse.search(query);
  if (result && result.length > 0 && result[0].score !== undefined) {
    // If the best match is reasonably good, take it
    if (result[0].score <= THRESHOLD) {
      return result[0].item;
    }
  }

  // Second pass: try each keyword separately and pick the best score
  let bestItem: FacilityForMatch | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const word of keywords) {
    const r = fuse.search(word);
    if (!r || r.length === 0) continue;

    const candidate = r[0];
    if (candidate.score !== undefined && candidate.score < bestScore) {
      bestScore = candidate.score;
      bestItem = candidate.item;
    }
  }

  if (bestItem) {
    return bestItem;
  }

  // Final fallback: simple substring check for safety
  const lowerQ = questionText.toLowerCase();
  for (const f of facilities) {
    const name = f.name.toLowerCase();
    const type = f.type.toLowerCase();
    if (lowerQ.includes(name) || lowerQ.includes(type)) {
      return f;
    }
  }

  return null;
}

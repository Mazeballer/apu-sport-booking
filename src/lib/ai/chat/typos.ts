// src/lib/ai/chat/typos.ts

export type ReplacementRule = {
  // Whole word or phrase to match (normalized input).
  from: string;
  // Replacement string (also normalized style).
  to: string;
};

/**
 * Normalize user text so intent detection and facility matching are stable.
 * This is NOT AI. It just standardises input.
 */
export function normalizeUserText(input: string): string {
  if (!input) return "";

  // 1) Lowercase and Unicode normalize (helps with weird characters)
  let s = input.toLowerCase().normalize("NFKD");

  // 2) Remove diacritics (rare in your case but harmless)
  s = s.replace(/[\u0300-\u036f]/g, "");

  // 3) Replace common separators with spaces
  s = s.replace(/[_/\\|]+/g, " ");

  // 4) Remove punctuation (keep digits and letters)
  s = s.replace(/[^a-z0-9:\s]/g, " ");

  // 5) Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Applies phrase replacements in a safe order:
 * - Longer phrases first, so "basket ball" is fixed before "ball".
 * - Whole word boundaries where possible.
 */
export function applyReplacements(
  normalizedText: string,
  rules: ReplacementRule[]
): string {
  let text = normalizedText;

  const sorted = [...rules].sort((a, b) => b.from.length - a.from.length);

  for (const r of sorted) {
    if (!r.from.trim()) continue;

    // Replace as whole phrase with boundary-ish matching.
    // We wrap with spaces to avoid partial word issues.
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(r.from)}(?=\\s|$)`, "g");
    text = text.replace(pattern, `$1${r.to}`);
  }

  // Clean up spacing again
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Your central replacement rules.
 * Keep these “meaningful” words only: sports, intents, confirm/cancel, duration.
 *
 * IMPORTANT:
 * - Do NOT add random English typos for every word.
 * - Only add typos that affect routing, booking, or equipment decisions.
 */
export const BOOKING_TYPO_RULES: ReplacementRule[] = [
  // ------------------------
  // Booking intent and actions
  // ------------------------
  { from: "bok", to: "book" },
  { from: "boook", to: "book" },
  { from: "bookk", to: "book" },
  { from: "buk", to: "book" },
  { from: "bokk", to: "book" },
  { from: "reserve", to: "book" },
  { from: "reservation", to: "book" },
  { from: "reserver", to: "book" },
  { from: "sched", to: "schedule" },
  { from: "schedual", to: "schedule" },
  { from: "scheduel", to: "schedule" },
  { from: "schedule", to: "book" },
  { from: "make a booking", to: "book" },
  { from: "make booking", to: "book" },
  { from: "help me book", to: "book" },

  { from: "availablity", to: "availability" },
  { from: "avalibility", to: "availability" },
  { from: "available", to: "availability" },
  { from: "free slot", to: "availability" },
  { from: "slot", to: "availability" },
  { from: "time slot", to: "availability" },

  // confirm/cancel signals
  { from: "confim", to: "confirm" },
  { from: "confrim", to: "confirm" },
  { from: "cnfrm", to: "confirm" },
  { from: "confirm booking", to: "confirm" },
  { from: "yes confirm", to: "confirm" },
  { from: "okay confirm", to: "confirm" },

  { from: "cancel booking", to: "cancel" },
  { from: "cancell", to: "cancel" },
  { from: "cancle", to: "cancel" },
  { from: "cncl", to: "cancel" },
  { from: "dont book", to: "cancel" },
  { from: "do not book", to: "cancel" },
  { from: "no book", to: "cancel" },

  // ------------------------
  // Durations (1h / 2h)
  // ------------------------
  { from: "1hour", to: "1 hour" },
  { from: "onehour", to: "1 hour" },
  { from: "1 hr", to: "1 hour" },
  { from: "1hrs", to: "1 hour" },
  { from: "one hr", to: "1 hour" },
  { from: "one hour", to: "1 hour" },

  { from: "2hour", to: "2 hours" },
  { from: "twohour", to: "2 hours" },
  { from: "2 hr", to: "2 hours" },
  { from: "2hrs", to: "2 hours" },
  { from: "two hr", to: "2 hours" },
  { from: "two hours", to: "2 hours" },

  // ------------------------
  // Common “today/tomorrow” typos
  // ------------------------
  { from: "tmr", to: "tomorrow" },
  { from: "tmrw", to: "tomorrow" },
  { from: "tommorow", to: "tomorrow" },
  { from: "tomorow", to: "tomorrow" },
  { from: "tomorroww", to: "tomorrow" },

  { from: "todai", to: "today" },
  { from: "tody", to: "today" },
  { from: "toady", to: "today" },

  // ------------------------
  // Sports / facilities (generic)
  // Add your real facility names too if students type them often
  // ------------------------
  { from: "tenis", to: "tennis" },
  { from: "tennis court", to: "tennis" },
  { from: "tnnis", to: "tennis" },

  { from: "badminto", to: "badminton" },
  { from: "badmintion", to: "badminton" },
  { from: "badminton court", to: "badminton" },

  { from: "basket ball", to: "basketball" },
  { from: "baskteball", to: "basketball" },
  { from: "basketbol", to: "basketball" },
  { from: "basketball court", to: "basketball" },

  { from: "futsall", to: "futsal" },
  { from: "fut sall", to: "futsal" },
  { from: "futsel", to: "futsal" },

  { from: "footbal", to: "football" },
  { from: "soccer", to: "football" },
  { from: "football field", to: "football" },

  // ------------------------
  // Equipment related words (optional)
  // These help your “no equipment” detection
  // ------------------------
  { from: "eq", to: "equipment" },
  { from: "equip", to: "equipment" },
  { from: "equiment", to: "equipment" },
  { from: "equipement", to: "equipment" },

  { from: "no eq", to: "no equipment" },
  { from: "no equip", to: "no equipment" },
  { from: "no equipments", to: "no equipment" },
  { from: "dont need equipment", to: "no equipment" },
  { from: "do not need equipment", to: "no equipment" },
  { from: "none", to: "no equipment" }, // careful: only safe because your chat domain is booking
];

/**
 * Convenience helper that does both steps:
 * normalize, then replace.
 */
export function normalizeForBookingChat(input: string) {
  const normalized = normalizeUserText(input);
  return applyReplacements(normalized, BOOKING_TYPO_RULES);
}

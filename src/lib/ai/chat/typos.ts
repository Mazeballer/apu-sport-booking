// src/lib/ai/chat/typos.ts

export type ReplacementRule = {
  from: string;
  to: string;
};

function baseNormalizeText(input: string): string {
  if (!input) return "";

  // 1) Lowercase and Unicode normalize (helps with weird characters)
  let s = input.toLowerCase().normalize("NFKD");

  // 2) Remove diacritics
  s = s.replace(/[\u0300-\u036f]/g, "");

  // 3) Replace common separators with spaces
  s = s.replace(/[_/\\|]+/g, " ");

  // 4) Remove punctuation (keep digits and letters)
  s = s.replace(/[^a-z0-9:\s]/g, " ");

  // 5) Collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyReplacements(
  normalizedText: string,
  rules: ReplacementRule[]
): string {
  let text = normalizedText;

  const sorted = [...rules].sort((a, b) => b.from.length - a.from.length);

  for (const r of sorted) {
    const from = r.from.trim();
    if (!from) continue;

    // Replace as whole phrase with boundary-ish matching.
    const pattern = new RegExp(`(^|\\s)${escapeRegExp(from)}(?=\\s|$)`, "g");
    text = text.replace(pattern, `$1${r.to}`);
  }

  // Clean up spacing again
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

export const BOOKING_TYPO_RULES: ReplacementRule[] = [
  // Booking intent and actions
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

  // Availability wording
  { from: "availablity", to: "availability" },
  { from: "avalibility", to: "availability" },
  { from: "available", to: "availability" },
  { from: "free slot", to: "availability" },
  { from: "time slot", to: "availability" },
  { from: "slot", to: "availability" },

  // Confirm and cancel signals
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

  // Durations (1h / 2h)
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

  // Today / tomorrow typos
  { from: "tmr", to: "tomorrow" },
  { from: "tmrw", to: "tomorrow" },
  { from: "tommorow", to: "tomorrow" },
  { from: "tomorow", to: "tomorrow" },
  { from: "tomorroww", to: "tomorrow" },

  { from: "todai", to: "today" },
  { from: "tody", to: "today" },
  { from: "toady", to: "today" },

  // Sports / facilities (generic)
  { from: "tenis", to: "tennis" },
  { from: "tnnis", to: "tennis" },
  { from: "tennis court", to: "tennis" },

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

  // Equipment related words
  { from: "eq", to: "equipment" },
  { from: "equip", to: "equipment" },
  { from: "equiment", to: "equipment" },
  { from: "equipement", to: "equipment" },

  { from: "no eq", to: "no equipment" },
  { from: "no equip", to: "no equipment" },
  { from: "no equipments", to: "no equipment" },
  { from: "dont need equipment", to: "no equipment" },
  { from: "do not need equipment", to: "no equipment" },
  { from: "none", to: "no equipment" },
];

export function normalizeForBookingChat(input: string) {
  const normalized = baseNormalizeText(input);
  return applyReplacements(normalized, BOOKING_TYPO_RULES);
}

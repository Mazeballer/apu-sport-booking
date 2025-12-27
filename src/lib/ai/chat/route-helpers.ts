// src/lib/ai/chat/route-helpers.ts
import type { UIMessage } from "ai";
import * as chrono from "chrono-node";

/* -----------------------------
   Date formatting (display)
----------------------------- */

export function formatDateDMY(isoDate: string): string {
  // isoDate: "YYYY-MM-DD" -> "DD-MM-YYYY"
  const m = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return isoDate;
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}

/* -----------------------------
   Malaysia time helpers
----------------------------- */

export function getMalaysiaNow(): Date {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const y = get("year");
  const m = get("month");
  const d = get("day");
  const hh = get("hour");
  const mm = get("minute");
  const ss = get("second");

  return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+08:00`);
}

export function getMalaysiaToday(): string {
  const nowMy = getMalaysiaNow();
  const year = nowMy.getFullYear();
  const month = String(nowMy.getMonth() + 1).padStart(2, "0");
  const day = String(nowMy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getMalaysiaMinuteKey(nowMy: Date): string {
  const y = nowMy.getFullYear();
  const m = String(nowMy.getMonth() + 1).padStart(2, "0");
  const d = String(nowMy.getDate()).padStart(2, "0");
  const hh = String(nowMy.getHours()).padStart(2, "0");
  const mm = String(nowMy.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}:${mm}`;
}

export function getMalaysiaDayKey(nowMy: Date): string {
  const y = nowMy.getFullYear();
  const m = String(nowMy.getMonth() + 1).padStart(2, "0");
  const d = String(nowMy.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/* -----------------------------
   Text normalisation + date-only detection
----------------------------- */

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDateOnlyMessage(text: string): boolean {
  const t = normalizeText(text);

  if (t === "today" || t === "tomorrow" || t === "yesterday") return true;

  if (
    t === "monday" ||
    t === "tuesday" ||
    t === "wednesday" ||
    t === "thursday" ||
    t === "friday" ||
    t === "saturday" ||
    t === "sunday"
  ) {
    return true;
  }

  // ISO date only (2025-12-27)
  if (/^\d{4}\s*\d{2}\s*\d{2}$/.test(t.replace(/-/g, " "))) return true;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;

  // DMY short (27/12 or 27-12)
  if (/^\d{1,2}[\/-]\d{1,2}$/.test(t)) return true;

  // DMY full (27/12/2025 or 27-12-2025)
  if (/^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(t)) return true;

  return false;
}

/* -----------------------------
   Fuzzy matching helpers
----------------------------- */

const GENERIC_FACILITY_TOKENS = new Set([
  "court",
  "field",
  "sports",
  "sport",
  "hall",
  "gym",
  "centre",
  "center",
  "facility",
  "facilities",
]);

export function tokenizeForFuzzy(text: string): string[] {
  return normalizeText(text)
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC_FACILITY_TOKENS.has(t));
}

export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && (a.startsWith(b) || b.startsWith(a))) return 0.85;

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  return 1 - dist / maxLen;
}

export function findFacilityIdStrict(
  question: string,
  facilities: { id: string; name: string; type: string }[]
): string | null {
  const q = normalizeText(question);
  if (!q) return null;

  for (const f of facilities) {
    const full = normalizeText(f.name);
    const type = normalizeText(f.type);

    if (!full && !type) continue;
    if ((full && q.includes(full)) || (type && q.includes(type))) return f.id;
  }
  return null;
}

export function guessFacilityForClarification(
  question: string,
  facilities: { id: string; name: string; type: string }[]
): { id: string; name: string } | null {
  const qTokens = tokenizeForFuzzy(question);
  if (qTokens.length === 0) return null;

  let best: { id: string; name: string; score: number } | null = null;

  for (const f of facilities) {
    const fTokens = tokenizeForFuzzy(`${f.name} ${f.type}`);
    if (fTokens.length === 0) continue;

    let localBest = 0;
    for (const qt of qTokens) {
      for (const ft of fTokens) {
        const sim = tokenSimilarity(qt, ft);
        if (sim > localBest) localBest = sim;
      }
    }

    if (!best || localBest > best.score) {
      best = { id: f.id, name: f.name, score: localBest };
    }
  }

  if (!best || best.score < 0.8) return null;
  return { id: best.id, name: best.name };
}

export function hasFuzzyBookingIntentWord(text: string): boolean {
  const tokens = normalizeText(text).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;

  const intentWords = ["book", "booking", "reserve", "schedule"];
  for (const tok of tokens) {
    for (const target of intentWords) {
      if (tokenSimilarity(tok, target) >= 0.8) return true;
    }
  }
  return false;
}

/* -----------------------------
   Conversation helpers
----------------------------- */

export function getLastUserText(messages: UIMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (text) return text;
  }
  return undefined;
}

/* -----------------------------
   Date parsing (accept DD-MM-YYYY, still return ISO)
----------------------------- */

export function extractDate(text: string, refDate: Date): string | null {
  const raw = text.trim();

  // Manual DD-MM-YYYY or DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmy) {
    const day = String(Number(dmy[1])).padStart(2, "0");
    const month = String(Number(dmy[2])).padStart(2, "0");
    const year = dmy[3];

    const mm = Number(month);
    const dd = Number(day);

    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${year}-${month}-${day}`; // internal ISO
    }
  }

  const lower = text.toLowerCase();

  const hasDateHint =
    /(today|tomorrow|yesterday|next|this|on\s+\d{1,2}\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i.test(
      lower
    );

  if (!hasDateHint) return null;

  const chronoResult = chrono.parseDate(text, refDate);
  return chronoResult ? chronoResult.toISOString().split("T")[0] : null;
}

export type ChatMode = "availability" | "booking" | null;

export function getLastChatMode(messages: UIMessage[]): ChatMode {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim()
      .toLowerCase();

    if (!text) continue;

    if (
      text === "check availability" ||
      text === "availability" ||
      text === "check available times"
    ) {
      return "availability";
    }

    if (
      text === "make a booking" ||
      text === "book" ||
      text.startsWith("book ")
    ) {
      return "booking";
    }
  }

  return null;
}

export function getRequestedDateFromConversation(
  uiMessages: UIMessage[],
  lastUserText: string | undefined,
  today: string
): string {
  const refDate = getMalaysiaNow();

  if (lastUserText) {
    const d = extractDate(lastUserText, refDate);
    if (d) return d;
  }

  for (let i = uiMessages.length - 1; i >= 0; i -= 1) {
    const m = uiMessages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (!text) continue;

    const d = extractDate(text, refDate);
    if (d) return d;
  }

  return today;
}

export function getLastBookingIntentQuestion(
  messages: UIMessage[],
  bookingIntentRegex: RegExp
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (text && bookingIntentRegex.test(text)) return text;
  }
  return undefined;
}

export function getFacilityAwareQuestionText(
  messages: UIMessage[],
  facilityTokens: string[]
): string | undefined {
  const lastUser = getLastUserText(messages);
  if (!lastUser) return undefined;

  const lastLower = lastUser.toLowerCase();
  if (facilityTokens.some((token) => lastLower.includes(token)))
    return lastUser;

  for (let i = messages.length - 2; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (!text) continue;

    const lower = text.toLowerCase();
    if (facilityTokens.some((token) => lower.includes(token))) {
      const parts: string[] = [];
      for (let j = i; j < messages.length; j += 1) {
        const mj = messages[j];
        if (mj.role !== "user") continue;

        const t = mj.parts
          .filter((p) => p.type === "text")
          .map((p) => (p as any).text as string)
          .join(" ")
          .trim();

        if (t) parts.push(t);
      }
      return parts.join(" ");
    }
  }

  return lastUser;
}

/* -----------------------------
   Booking details prompt
----------------------------- */

export type FacilityDetailsForPrompt = {
  name: string;
  courts: { id: string; name: string }[];
  equipmentNames: string[];
};

export function buildMissingBookingDetailsMessage(options: {
  facility: FacilityDetailsForPrompt;
  requestedDate: string;
  hasDuration: boolean;
  hasEquipmentDecision: boolean;
}) {
  const { facility, requestedDate, hasDuration, hasEquipmentDecision } =
    options;
  const lines: string[] = [];

  lines.push(
    `You want to make a booking for "${facility.name}" on ${requestedDate}, but I still need a bit more information before I can create it.`
  );

  if (!hasDuration) {
    lines.push(
      `1) How long do you want the booking? You can choose 1 hour or 2 hours.`
    );
  }

  if (facility.courts.length > 1) {
    const courtList = facility.courts.map((c) => c.name).join(", ");
    lines.push(
      `2) If you have a preferred court, tell me which one. Available courts: ${courtList}. If you do not mind, I will pick one for you based on availability.`
    );
  }

  if (facility.equipmentNames.length === 0) {
    lines.push(`Equipment: none`);
    lines.push(
      `This facility has no equipment available for borrowing, so the user must bring their own if needed.`
    );
  } else if (!hasEquipmentDecision) {
    const eqInline = facility.equipmentNames.join(", ");
    const eqListBlocks = facility.equipmentNames
      .map((e) => `- ${e}`)
      .join("\n");

    lines.push(`Equipment: ${eqInline}`);
    lines.push(
      `This facility provides equipment you can borrow on a first come basis. The only available equipment is exactly what is listed in the "Equipment:" line.`
    );
    lines.push(`Detailed list:\n${eqListBlocks}`);
    lines.push(
      `Please tell me which ones you want to borrow, or say "no equipment" if you do not need any.`
    );
  }

  lines.push(
    `In your reply to the user you MUST clearly mention the equipment names exactly as listed in the "Equipment:" line. You are not allowed to add, remove, or rename any equipment.`
  );

  return lines.join("\n");
}

/* -----------------------------
   Facility memory
----------------------------- */

export function getLastFacilityIdFromConversation(
  messages: UIMessage[],
  facilities: { id: string; name: string; type: string }[]
): string | null {
  if (facilities.length === 0) return null;

  const facilityTokenMap = facilities.map((f) => ({
    id: f.id,
    tokens: [f.name, f.type].filter(Boolean).map((t) => t.toLowerCase()),
  }));

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (!text) continue;

    const lower = text.toLowerCase();
    for (const f of facilityTokenMap) {
      if (f.tokens.some((t) => t && lower.includes(t))) return f.id;
    }
  }

  return null;
}

export function resolveFacilityAwareQuestionText(
  messages: UIMessage[],
  facilityTokens: string[],
  allFacilities: { id: string; name: string; type: string }[],
  lastUserText: string
): string | undefined {
  let text = getFacilityAwareQuestionText(messages, facilityTokens);

  if (text && facilityTokens.some((t) => text.toLowerCase().includes(t))) {
    return text;
  }

  const followUpLower = lastUserText.toLowerCase();
  const isClearlyFollowUp =
    /\b(book|reserve|schedule|slot|time|what time|which time|that time|this time|available|availability|can i book|help me book)\b/i.test(
      followUpLower
    );

  if (!isClearlyFollowUp) return text;

  const lastFacilityId = getLastFacilityIdFromConversation(
    messages,
    allFacilities
  );
  if (!lastFacilityId) return text;

  const lastFacility = allFacilities.find((f) => f.id === lastFacilityId);
  if (!lastFacility) return text;

  const synthetic = `${lastFacility.name} ${lastUserText}`.trim();
  return synthetic || text;
}

export function findFacilityExact(
  text: string,
  facilities: { id: string; name: string; type: string }[]
): { id: string; name: string; type: string } | null {
  const q = normalizeText(text);
  if (!q) return null;

  for (const f of facilities) {
    const name = normalizeText(f.name);
    const type = normalizeText(f.type);

    if (q === name || (type && q === type)) return f;
  }

  return null;
}

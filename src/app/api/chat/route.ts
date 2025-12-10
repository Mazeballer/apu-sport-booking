// src/app/api/chat/route.ts

import {
  convertToModelMessages,
  streamText,
  type UIMessage,
  validateUIMessages,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { FACILITY_FAQ } from "@/lib/faq";
import { getFacilityAvailabilityById } from "@/lib/ai/get-availability";
import { computeFreeHours } from "@/lib/ai/free-slots";
import {
  getBookingSuggestionFromQuestion,
  createBookingFromAI,
} from "@/lib/ai/book-facility";
import { prisma } from "@/lib/prisma";
import * as chrono from "chrono-node";

export const runtime = "nodejs";

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

function getMalaysiaNow(): Date {
  const now = new Date();
  const malaysiaString = now.toLocaleString("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
  });
  return new Date(malaysiaString);
}

function getMalaysiaToday(): string {
  const nowMy = getMalaysiaNow();
  const year = nowMy.getFullYear();
  const month = String(nowMy.getMonth() + 1).padStart(2, "0");
  const day = String(nowMy.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/* --------------------------------
   Fuzzy facility matcher
-------------------------------- */

function findFacilityIdFromQuestion(
  question: string,
  facilities: { id: string; name: string; type: string }[]
) {
  const q = normalizeText(question);

  if (!q || facilities.length === 0) {
    return null;
  }

  // Simple include match first
  for (const f of facilities) {
    const fullName = normalizeText(f.name);
    const typeName = normalizeText(f.type);

    if (!fullName && !typeName) continue;

    if (q.includes(fullName) || q.includes(typeName)) {
      return f.id;
    }
  }

  // Token based fuzzy match
  const qTokens = q.split(/\s+/).filter(Boolean);

  let bestFacility: { id: string; score: number } | null = null;

  for (const f of facilities) {
    const fullName = normalizeText(f.name);
    const typeName = normalizeText(f.type);
    const fTokens = `${fullName} ${typeName}`
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (fTokens.length === 0) continue;

    let maxTokenScore = 0;

    for (const ft of fTokens) {
      for (const qt of qTokens) {
        const s = tokenSimilarity(ft, qt);
        if (s > maxTokenScore) {
          maxTokenScore = s;
        }
      }
    }

    if (!bestFacility || maxTokenScore > bestFacility.score) {
      bestFacility = { id: f.id, score: maxTokenScore };
    }
  }

  const MIN_CONFIDENCE = 0.7;

  if (!bestFacility || bestFacility.score < MIN_CONFIDENCE) {
    return null;
  }

  return bestFacility.id;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;

  const minLen = Math.min(a.length, b.length);
  if (minLen >= 3 && (a.startsWith(b) || b.startsWith(a))) {
    return 0.85;
  }

  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;

  return 1 - dist / maxLen;
}

function levenshteinDistance(a: string, b: string): number {
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

/* --------------------------------
   Conversation helpers
-------------------------------- */

function getLastUserText(messages: UIMessage[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
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

function extractDate(text: string): string | null {
  const lower = text.toLowerCase();

  // Only treat it as a date if there are any date-like words or patterns.
  // This avoids "8 am" being interpreted as "today at 8 am".
  const hasDateHint =
    /(today|tomorrow|yesterday|next|this|on\s+\d{1,2}\b|monday|tuesday|wednesday|thursday|friday|saturday|sunday|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)/i.test(
      lower
    );

  if (!hasDateHint) {
    return null;
  }

  const chronoResult = chrono.parseDate(text);
  if (chronoResult) {
    return chronoResult.toISOString().split("T")[0];
  }
  return null;
}

function getRequestedDateFromConversation(
  uiMessages: UIMessage[],
  lastUserText: string | undefined,
  today: string
): string {
  if (lastUserText) {
    const d = extractDate(lastUserText);
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

    const d = extractDate(text);
    if (d) return d;
  }

  // No date detected, fall back to today
  return today;
}

/**
 * Last booking intent text such as "can you book 6pm for me"
 */
function getLastBookingIntentQuestion(
  messages: UIMessage[],
  bookingIntentRegex: RegExp
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "user") continue;

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (!text) continue;

    if (bookingIntentRegex.test(text)) {
      return text;
    }
  }
  return undefined;
}

/**
 * Facility aware question
 *
 * Example flow:
 *   "What facilities are available today?"
 *   "Football Field"
 *   "what time?"
 *   "can you book 6pm for me"
 *   "1 hour"
 *
 * Returns:
 *   "Football Field what time? can you book 6pm for me 1 hour"
 */
function getFacilityAwareQuestionText(
  messages: UIMessage[],
  facilityTokens: string[]
): string | undefined {
  const lastUser = getLastUserText(messages);
  if (!lastUser) return undefined;

  const lastLower = lastUser.toLowerCase();
  const mentionsInLast = facilityTokens.some((token) =>
    lastLower.includes(token)
  );
  if (mentionsInLast) {
    return lastUser;
  }

  for (let i = messages.length - 2; i >= 0; i--) {
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

      for (let j = i; j < messages.length; j++) {
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

/* --------------------------------
   Missing booking details helper
-------------------------------- */

type FacilityDetailsForPrompt = {
  name: string;
  courts: { id: string; name: string }[];
  equipmentNames: string[];
};

function buildMissingBookingDetailsMessage(options: {
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

  // 1. Duration
  if (!hasDuration) {
    lines.push(
      `1) How long do you want the booking? You can choose 1 hour or 2 hours.`
    );
  }

  // 2. Courts
  if (facility.courts.length > 1) {
    const courtList = facility.courts.map((c) => c.name).join(", ");
    lines.push(
      `2) If you have a preferred court, tell me which one. Available courts: ${courtList}. If you do not mind, I will pick one for you based on availability.`
    );
  }

  // 3. Equipment
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

    // This line is the single source of truth for equipment
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

/* --------------------------------
   System prompt builder
-------------------------------- */

function buildSystemPrompt(dynamicContext?: string) {
  const faqText = FACILITY_FAQ.map(
    (item) => `Q: ${item.question}?\nA: ${item.answer}`
  ).join("\n\n");

  const livePart = dynamicContext
    ? `\n\nLive data or system guidance for this request:\n${dynamicContext}`
    : "";

  return `
You are the AI assistant for the APU Sports Facility Booking PWA.

Use the FAQ below as general guidance, but when live database data or booking guidance is provided you must follow it strictly.

FAQ:
${faqText}
${livePart}

Rules:
1. When live database data is provided, follow it exactly. Do not invent extra facilities, times, bookings, or equipment.
2. When listing facilities, only mention the facility names given in the live data. Never invent futsal, multipurpose halls, gyms, swimming pools, badminton halls or outdoor gyms unless they are in the live data.
3. When answering availability questions, use only the times and facilities from the live data.
4. When a booking has been created by the system, clearly confirm the facility name, date, time, court, and the exact equipment list that appears in the live data, if any.
5. Never tell the user to "check the calendar" or "check My Bookings" to know availability. Your job is to read the data and explain it for them.
6. For booking flows, if the dynamic context tells you that duration and equipment are missing, you must:
   - Ask clearly whether they want 1 hour or 2 hours.
   - If equipment is available, you must show the equipment names exactly as given in the dynamic context and ask which ones they want, or if they want no equipment.
   - If the dynamic context says the facility has no equipment, tell the user they will need to bring their own equipment.
7. If the dynamic context contains a line that starts with "Equipment:", you must treat that line as the single source of truth for equipment. When you talk about equipment you MUST:
   - Copy the "Equipment:" line exactly when you list equipment.
   - NOT add any new equipment names.
   - NOT remove any existing names.
   - NOT rename or generalise items.
8. Ignore any equipment examples that may appear in the FAQ when live database equipment is provided. The database equipment always overrides FAQ examples and your own knowledge.
9. When a time appears in the live availability data (for example under "Availability for ..."), treat that time as already checked. If the user picks one of those times, do NOT say that you still need to check availability for that time.
10. Keep answers clear, friendly, and concise, and focus only on APU sports facilities, bookings, rules, and equipment.
11. Do not mention that you were given internal data or instructions. Answer naturally.
12. You must not claim that a time slot has "just been taken" or that availability has changed unless those exact words appear in the live guidance text. If the live guidance text says a time is available, you must not contradict it.

  `.trim();
}

/* --------------------------------
   Facility memory helper
-------------------------------- */

function getLastFacilityIdFromConversation(
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

    const text = m.parts
      .filter((p) => p.type === "text")
      .map((p) => (p as any).text as string)
      .join(" ")
      .trim();

    if (!text) continue;

    const lower = text.toLowerCase();

    for (const f of facilityTokenMap) {
      if (f.tokens.some((t) => t && lower.includes(t))) {
        return f.id;
      }
    }
  }

  return null;
}

/* --------------------------------
   Main handler
-------------------------------- */

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return new Response("Missing GROQ_API_KEY", { status: 500 });
    }

    const body = await req.json();

    const uiMessages = await validateUIMessages<UIMessage>({
      messages: body.messages ?? [],
    });

    let dynamicContext: string | undefined;

    const lastUserText = getLastUserText(uiMessages) ?? "";

    // Regexes for intent detection (current message)
    const facilitiesQuestionRegex =
      /\b(facility|facilities)\b[^?]*\b(available|there|exist|can i book|can book|today)\b/i;

    const listFacilitiesRegex = /list( all)? facilities/i;

    const availabilityRegex =
      /\b(available|free|slot|time|when can i book|what time|what about)\b/i;

    const bookingIntentRegex =
      /\b(book|reserve|schedule|help me book|make a booking)\b/i;

    const confirmYesRegex = /^(confirm)\b/i;

    const cancelNoRegex =
      /^(no|nah|nope|cancel|do not book|dont book|don't book)\b/i;

    // Support 8pm, 8 pm, 14:00, 16:30 etc
    const explicitTimeRegex = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(am|pm)?\b/i;

    const hasExplicitTime = explicitTimeRegex.test(lastUserText);
    const hasAvailabilityKeyword = availabilityRegex.test(lastUserText);
    const hasBookingIntent = bookingIntentRegex.test(lastUserText);
    const isConfirm = confirmYesRegex.test(lastUserText);
    const isCancel = cancelNoRegex.test(lastUserText);

    const isFacilitiesQuestion =
      facilitiesQuestionRegex.test(lastUserText) ||
      listFacilitiesRegex.test(lastUserText);

    const lastBookingQuestionText = getLastBookingIntentQuestion(
      uiMessages,
      bookingIntentRegex
    );

    const explicitInLastBookingQuestion = lastBookingQuestionText
      ? explicitTimeRegex.test(lastBookingQuestionText)
      : false;

    // Treat it as a booking conversation if any message had booking intent
    const isBookingConversation =
      hasBookingIntent || Boolean(lastBookingQuestionText);

    const allFacilities = await prisma.facility.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    const facilityNames = allFacilities.map((f) => f.name);
    const facilityTokens = allFacilities
      .flatMap((f) => [f.name.toLowerCase(), f.type.toLowerCase()])
      .filter(Boolean);

    const today = getMalaysiaToday();

    // Existing helper based on user messages only
    const facilityQuestionTextForBooking = getFacilityAwareQuestionText(
      uiMessages,
      facilityTokens
    );

    // Facility memory awareness wrapper
    function resolveFacilityAwareQuestionText(
      messages: UIMessage[],
      facilityTokens: string[],
      allFacilities: { id: string; name: string; type: string }[],
      lastUserText: string
    ): string | undefined {
      // First, try the existing logic
      let text = getFacilityAwareQuestionText(messages, facilityTokens);

      if (text && facilityTokens.some((t) => text.toLowerCase().includes(t))) {
        return text;
      }

      // Try to fall back to the last facility mentioned in the conversation
      const lastFacilityId = getLastFacilityIdFromConversation(
        messages,
        allFacilities
      );

      if (!lastFacilityId) {
        return text;
      }

      const lastFacility = allFacilities.find((f) => f.id === lastFacilityId);
      if (!lastFacility) {
        return text;
      }

      // Build a synthetic question like:
      // "Basketball Court ok can you show me the availability for tomorrow?"
      const synthetic = `${lastFacility.name} ${lastUserText}`.trim();
      return synthetic || text;
    }

    const conversationHasTime = facilityQuestionTextForBooking
      ? explicitTimeRegex.test(facilityQuestionTextForBooking)
      : false;

    // Follow up availability after a booking conversation
    const isFollowUpAvailability =
      !hasBookingIntent &&
      hasAvailabilityKeyword &&
      !hasExplicitTime &&
      isBookingConversation;

    /* 1. Explicit confirmation "confirm" */

    if (isConfirm) {
      const requestedDate = getRequestedDateFromConversation(
        uiMessages,
        lastUserText,
        today
      );

      const facilityQuestionText =
        resolveFacilityAwareQuestionText(
          uiMessages,
          facilityTokens,
          allFacilities,
          lastUserText
        ) ?? "";

      if (
        !facilityQuestionText ||
        !facilityTokens.some((t) =>
          facilityQuestionText.toLowerCase().includes(t)
        )
      ) {
        if (facilityNames.length === 0) {
          dynamicContext = `You said yes, but there are no active facilities configured in the system yet.`;
        } else {
          dynamicContext = `You said yes, but I still do not know which facility you want to book.

Active facilities:
${facilityNames.join("\n")}

Please say something like:
- "Book Tennis tomorrow at 6pm"
- "Help me book Basketball Court on Friday at 5pm"`;
        }
      } else {
        const facilityId = findFacilityIdFromQuestion(
          facilityQuestionText,
          allFacilities
        );

        if (!facilityId) {
          dynamicContext = `I could not find any active facility matching your booking request.`;
        } else {
          const facilityRow = await prisma.facility.findUnique({
            where: { id: facilityId },
            include: {
              courts: { where: { active: true }, orderBy: { name: "asc" } },
              equipment: true,
            },
          });

          if (!facilityRow) {
            dynamicContext = `I could not load details for that facility.`;
          } else {
            const facilityForPrompt: FacilityDetailsForPrompt = {
              name: facilityRow.name,
              courts: facilityRow.courts.map((c) => ({
                id: c.id,
                name: c.name,
              })),
              equipmentNames: facilityRow.equipment.map((e) => e.name),
            };

            const qLower = facilityQuestionText.toLowerCase();

            const hasDuration =
              /\b(1\s*hour|one\s*hour|2\s*hours|two\s*hours)\b/i.test(
                facilityQuestionText
              );

            let hasEquipmentDecision = false;
            let deniesEquipment = false;
            let chosenEquipmentNamesFromText: string[] = [];

            if (facilityForPrompt.equipmentNames.length === 0) {
              // No equipment in this facility, nothing for the user to decide
              hasEquipmentDecision = true;
            } else {
              deniesEquipment =
                /\b(no equipment|no need equipment|do not need equipment|dont need equipment)\b/i.test(
                  qLower
                );

              // Capture all equipment items the user mentioned
              chosenEquipmentNamesFromText =
                facilityForPrompt.equipmentNames.filter((name) =>
                  qLower.includes(name.toLowerCase())
                );

              hasEquipmentDecision =
                deniesEquipment || chosenEquipmentNamesFromText.length > 0;
            }

            // If details are still missing, do not create booking
            if (!hasDuration || !hasEquipmentDecision) {
              dynamicContext = buildMissingBookingDetailsMessage({
                facility: facilityForPrompt,
                requestedDate,
                hasDuration,
                hasEquipmentDecision,
              });
            } else {
              // All details gathered, now compute suggestion and create booking
              const suggestion = await getBookingSuggestionFromQuestion({
                questionText: facilityQuestionText,
                requestedDate,
              });

              if (!suggestion) {
                dynamicContext = `I could not find any active facility matching your booking request.`;
              } else if (suggestion.reason) {
                dynamicContext = suggestion.reason;
              } else {
                // Override equipment choice with what the user said
                if (facilityForPrompt.equipmentNames.length > 0) {
                  if (deniesEquipment) {
                    suggestion.chosenEquipmentNames = [];
                  } else if (chosenEquipmentNamesFromText.length > 0) {
                    suggestion.chosenEquipmentNames =
                      chosenEquipmentNamesFromText;
                  }
                }

                const result = await createBookingFromAI(suggestion);

                if (!result.ok) {
                  const equipmentInlineFromFacility =
                    facilityForPrompt.equipmentNames.length > 0
                      ? facilityForPrompt.equipmentNames.join(", ")
                      : "";

                  const equipmentLine =
                    equipmentInlineFromFacility !== ""
                      ? `Equipment: ${equipmentInlineFromFacility}`
                      : `Equipment: none`;

                  dynamicContext = `
Booking could not be created.

System reason:
${result.message}

${equipmentLine}

In your reply:
- Briefly explain that the booking could not be created using the system reason above.
- Do not invent stories such as "someone just took the slot".
- Do not invent new times or equipment.
- Ask the user to choose another time or check availability again.
      `.trim();
                } else {
                  const finalEquipInline =
                    result.equipmentNames && result.equipmentNames.length > 0
                      ? result.equipmentNames.join(", ")
                      : "";

                  const equipmentLineForUser =
                    finalEquipInline !== ""
                      ? `- Equipment: ${finalEquipInline}`
                      : `- Equipment: none requested. You can still bring your own equipment.`;

                  const equipmentSourceOfTruth =
                    finalEquipInline !== ""
                      ? `Equipment: ${finalEquipInline}`
                      : `Equipment: none`;

                  dynamicContext = `
A booking has been created successfully:

- Facility: ${result.facilityName}
- Court: ${result.courtName}
- Date: ${result.date}
- Time: ${result.timeLabel}
${equipmentLineForUser}

${equipmentSourceOfTruth}

In your reply:
- Confirm the booking details exactly as shown.
- When mentioning equipment copy the Equipment line exactly.
- Do not suggest any other times.
You may remind the user they can view it in My Bookings.
      `.trim();
                }
              }
            }
          }
        }
      }
    }

    /* 2. Cancellation replies */

    if (!dynamicContext && isCancel) {
      dynamicContext = "Okay, I will not create any booking.";
    }

    /* 3. List facilities */

    if (!dynamicContext && isFacilitiesQuestion) {
      if (facilityNames.length === 0) {
        dynamicContext =
          "There are no active facilities configured in the system yet. An admin needs to add them before students can book.";
      } else {
        dynamicContext = `Active facilities in the system:\n${facilityNames.join(
          "\n"
        )}`;
      }
    }

    /* 4. Availability flows
          - Pure availability, for example "What time is Basketball free on Friday?"
          - Follow up in a booking conversation like "what time is available then?"
          - Start of booking flow when the user asks "what time can I book...?"
    */

    if (
      !dynamicContext &&
      !isFacilitiesQuestion &&
      hasAvailabilityKeyword &&
      !hasExplicitTime &&
      !isConfirm &&
      !isCancel
    ) {
      const requestedDate = getRequestedDateFromConversation(
        uiMessages,
        lastUserText,
        today
      );

      const facilityQuestionText =
        resolveFacilityAwareQuestionText(
          uiMessages,
          facilityTokens,
          allFacilities,
          lastUserText
        ) ?? "";

      const wantsBookingFlow =
        hasBookingIntent || isFollowUpAvailability || isBookingConversation;

      if (
        !facilityQuestionText ||
        !facilityTokens.some((t) =>
          facilityQuestionText.toLowerCase().includes(t)
        )
      ) {
        if (facilityNames.length === 0) {
          if (wantsBookingFlow) {
            dynamicContext = `You want to know what time you can book on ${requestedDate}, but there are no active facilities in the system yet.`;
          } else {
            dynamicContext = `You asked about availability on ${requestedDate}, but there are no active facilities in the database. Ask the sports admin for help.`;
          }
        } else {
          if (wantsBookingFlow) {
            dynamicContext = `I did not fully understand your booking question.

You want to know what time you can book around ${requestedDate}, but the system could not clearly detect which facility you mean.

Active facilities:
${facilityNames.join("\n")}

Please say something like:
- "What time can I book Tennis on ${requestedDate}?"
- "What time is Basketball Court available to book today?"`;
          } else {
            dynamicContext = `I did not fully understand your availability question.

You want to know about availability around ${requestedDate}, but the system could not clearly detect which facility you mean.

These are the active facilities in the system:
${facilityNames.join("\n")}

Ask about one facility at a time, for example:
- "What time is Tennis free on ${requestedDate}?"
- "What time is Basketball Court available on ${requestedDate}?"`;
          }
        }
      } else {
        const facilityId = findFacilityIdFromQuestion(
          facilityQuestionText,
          allFacilities
        );

        if (!facilityId) {
          dynamicContext = `I could not find any active facility matching "${facilityQuestionText}".`;
        } else {
          const data = await getFacilityAvailabilityById(
            facilityId,
            requestedDate
          );

          if (!data) {
            dynamicContext = `The system has no availability data for that facility on ${requestedDate}.`;
          } else {
            const { facility, courts, bookings, date } = data;
            const lines: string[] = [];

            for (const court of courts) {
              const courtBookings = bookings.filter(
                (b) => b.courtId === court.id
              );

              const openTime = facility.openTime ?? "08:00";
              const closeTime = facility.closeTime ?? "22:00";

              const free = computeFreeHours(
                openTime,
                closeTime,
                date,
                courtBookings,
                new Date()
              );

              if (free.length === 0) {
                lines.push(
                  `- ${court.name}: no free one hour slots on ${date}`
                );
              } else {
                lines.push(`- ${court.name}:\n  ${free.join(", ")}`);
              }
            }

            if (!wantsBookingFlow) {
              // Pure availability only
              dynamicContext = `Availability for "${facility.name}" on ${date}:

${lines.join("\n")}

In your reply:
- Show these times clearly to the user once. Do not repeat the same list again in another paragraph.
- This is an availability only question, so do not ask them which time they want to book yet.
- Do not ask for duration or equipment yet.
- If they later ask "can you book 10am" or similar, you will handle the booking in a separate step.`;
            } else {
              // Availability plus booking flow start
              const equipmentRows = await prisma.equipment.findMany({
                where: { facilityId: facility.id },
              });
              const equipmentNames = equipmentRows.map((e) => e.name);
              const equipmentInline =
                equipmentNames.length > 0 ? equipmentNames.join(", ") : "";

              const equipmentSection =
                equipmentNames.length > 0
                  ? `

Equipment: ${equipmentInline}

In your reply:
- If you ask about equipment, you MUST repeat the line starting with "Equipment:" exactly as shown above and you MUST NOT add or remove any equipment names.`
                  : `
This facility currently has no equipment configured in the system. If the user needs equipment, tell them they may need to bring their own.`;

              dynamicContext = `Availability for "${facility.name}" on ${date}:

${lines.join("\n")}${equipmentSection}

In your reply:
- First, show these available times clearly once. Do not print the same list again after that.
- Then treat this as the start of a booking flow.
- Ask the user:
  1) Which COURT they want (if there is more than one court).
  2) Which START TIME they want from the list.
  3) How long they want the booking (1 hour or 2 hours).
  4) Whether they want any equipment or no equipment.
- Do not ask them for the date again. Use ${date} as the booking date.`;
            }
          }
        }
      }
    }

    /* 5. Booking intent with explicit time, based on the whole conversation
          - Direct "book at 6pm"
          - "6pm works" after earlier booking question
          - "can you book that time" after picking a slot
    */

    const shouldHandleBookingWithTime =
      !dynamicContext &&
      !isFacilitiesQuestion &&
      (hasBookingIntent || isBookingConversation) &&
      (hasExplicitTime ||
        explicitInLastBookingQuestion ||
        (hasBookingIntent && conversationHasTime)) &&
      !isConfirm &&
      !isCancel &&
      !isFollowUpAvailability;

    if (shouldHandleBookingWithTime) {
      const requestedDate = getRequestedDateFromConversation(
        uiMessages,
        lastUserText,
        today
      );

      const facilityQuestionText =
        facilityQuestionTextForBooking ??
        resolveFacilityAwareQuestionText(
          uiMessages,
          facilityTokens,
          allFacilities,
          lastUserText
        );

      if (
        !facilityQuestionText ||
        !facilityTokens.some((t) =>
          facilityQuestionText.toLowerCase().includes(t)
        )
      ) {
        if (facilityNames.length === 0) {
          dynamicContext = `You want to make a booking on ${requestedDate}, but there are no active facilities in the system yet.`;
        } else {
          dynamicContext = `I did not fully understand your booking request.

You asked about a booking around ${requestedDate}, but the system could not clearly detect which facility you mean.
Active facilities:
${facilityNames.join("\n")}

Please say something like:
- "Book Tennis tomorrow at 6pm"
- "Help me book Basketball Court on Friday at 5pm"`;
        }
      } else {
        const facilityId = findFacilityIdFromQuestion(
          facilityQuestionText,
          allFacilities
        );

        if (!facilityId) {
          dynamicContext = `I could not find any active facility matching "${facilityQuestionText}".`;
        } else {
          const facilityRow = await prisma.facility.findUnique({
            where: { id: facilityId },
            include: {
              courts: { where: { active: true }, orderBy: { name: "asc" } },
              equipment: true,
            },
          });

          if (!facilityRow) {
            dynamicContext = `I could not load details for that facility.`;
          } else {
            const facilityForPrompt: FacilityDetailsForPrompt = {
              name: facilityRow.name,
              courts: facilityRow.courts.map((c) => ({
                id: c.id,
                name: c.name,
              })),
              equipmentNames: facilityRow.equipment.map((e) => e.name),
            };

            const qLower = facilityQuestionText.toLowerCase();

            const hasDuration =
              /\b(1\s*hour|one\s*hour|2\s*hours|two\s*hours)\b/i.test(
                facilityQuestionText
              );

            let hasEquipmentDecision = false;
            if (facilityForPrompt.equipmentNames.length === 0) {
              hasEquipmentDecision = true;
            } else {
              const deniesEquipment =
                /\b(no equipment|no need equipment|do not need equipment|dont need equipment)\b/i.test(
                  qLower
                );

              const mentionsAnyEquipment =
                facilityForPrompt.equipmentNames.some((name) =>
                  qLower.includes(name.toLowerCase())
                );

              hasEquipmentDecision = deniesEquipment || mentionsAnyEquipment;
            }

            // Always compute a suggestion so we know if the requested time is actually free
            const suggestion = await getBookingSuggestionFromQuestion({
              questionText: facilityQuestionText,
              requestedDate,
            });

            if (!suggestion) {
              dynamicContext = `I could not find any active facility matching "${facilityQuestionText}".`;
            } else if (suggestion.reason) {
              dynamicContext = `
${suggestion.reason}

In your reply:
- Explain clearly that there are no free one hour slots for that facility on ${requestedDate}.
- Do not create or confirm any booking.
- Do not choose a different date or time by yourself.
- Ask the user if they want to check availability on another date or pick a different time.
`.trim();
            } else if (!hasDuration || !hasEquipmentDecision) {
              const availableEquipInline =
                facilityForPrompt.equipmentNames.length > 0
                  ? facilityForPrompt.equipmentNames.join(", ")
                  : "";

              const availableEquipmentLine =
                availableEquipInline !== ""
                  ? `Available equipment: ${availableEquipInline}`
                  : `Available equipment: none (the user must bring their own if needed).`;

              if (suggestion.isExactMatch) {
                dynamicContext = `
You are in the middle of a booking flow.

Requested booking so far:
- Facility: ${suggestion.facilityName}
- Court: ${suggestion.courtName}
- Date: ${suggestion.date}
- Time: ${suggestion.suggestedTimeLabel}
${availableEquipmentLine}

In your reply:
- Confirm the facility, court, date and time.
- Do NOT say "Equipment: ..." as if equipment has already been chosen.
- Treat the equipment above as AVAILABLE options only.
- Ask the user how long they want the booking (1 hour or 2 hours).
- Ask the user whether they want to borrow any of the available equipment, or no equipment.

Do not say you still need to check availability for this time and do not suggest any other times.
    `.trim();
              } else {
                // Requested time is not free, suggest only the nearest slot
                const equipmentLineWithLabel =
                  facilityForPrompt.equipmentNames.length > 0
                    ? `Equipment: ${facilityForPrompt.equipmentNames.join(
                        ", "
                      )}`
                    : `Equipment: none`;

                dynamicContext = `
You are in the middle of a booking flow.

The requested time ${suggestion.requestedTimeLabel} is not free for "${suggestion.facilityName}" on ${suggestion.date}.
You must offer only this nearest available one hour slot:
- Facility: ${suggestion.facilityName}
- Court: ${suggestion.courtName}
- Date: ${suggestion.date}
- Time: ${suggestion.suggestedTimeLabel}
${equipmentLineWithLabel}

Your reply to the user must:
1) Explain briefly that their requested time is not available.
2) Present the suggested time above as the alternative.
3) Ask if they want to use this suggested time.
4) Ask how long they want the booking (1 hour or 2 hours).
5) Ask whether they want any equipment from the Equipment line or no equipment.

Do not invent any extra alternative times.
                `.trim();
              }
            } else {
              // We have facility, time, duration, and equipment decision,
              // but the booking should only be created after the user types "confirm".

              const durationLabel = /\b2\s*hours|two\s*hours\b/i.test(
                facilityQuestionText
              )
                ? "2 hours"
                : "1 hour";

              const chosenEquipInline =
                suggestion.chosenEquipmentNames &&
                suggestion.chosenEquipmentNames.length > 0
                  ? suggestion.chosenEquipmentNames.join(", ")
                  : "none";

              const equipmentLine = `Equipment: ${chosenEquipInline}`;

              dynamicContext = `
The user has provided all booking details, but the booking has NOT been created yet.

Planned booking:
- Facility: ${suggestion.facilityName}
- Court: ${suggestion.courtName}
- Date: ${suggestion.date}
- Time: ${suggestion.suggestedTimeLabel}
- Duration: ${durationLabel}
${equipmentLine}

In your reply:
- Show these details clearly to the user.
- Tell them that if everything looks correct, they should type "confirm" to create the booking.
- Make it clear that the booking is NOT created yet.
- Do NOT say that the booking is already confirmed.
- Do NOT say or imply that this time is unavailable, taken, or that someone else just booked it.
- Do NOT say that availability changed.
- Do NOT suggest any other times, because this time is already verified as available.
`.trim();
            }
          }
        }
      }
    }

    // 6. Fallback: normal FAQ based chat if no dynamicContext was set

    const result = streamText({
      model: groq(process.env.GROQ_MODEL ?? "llama-3.1-8b-instant"),
      system: buildSystemPrompt(dynamicContext),
      messages: convertToModelMessages(uiMessages),
      temperature: dynamicContext ? 0 : 0.3,
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("Chat error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}

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
import { getCurrentUser } from "@/lib/authz";
import { assertBookingLimit, BookingLimitError } from "@/lib/booking-limits";
import { normalizeUserText } from "@/lib/ai/chat/normalize";
import {
  getMalaysiaNow,
  getMalaysiaToday,
  getMalaysiaMinuteKey,
  getMalaysiaDayKey,
  findFacilityIdStrict,
  guessFacilityForClarification,
  hasFuzzyBookingIntentWord,
  getLastUserText,
  getRequestedDateFromConversation,
  getLastBookingIntentQuestion,
  getFacilityAwareQuestionText,
  buildMissingBookingDetailsMessage,
  type FacilityDetailsForPrompt,
  resolveFacilityAwareQuestionText,
  findFacilityExact,
  getLastChatMode,
  isDateOnlyMessage,
  getLastFacilityIdFromConversation,
  formatDateDMY,
  getLastProposedTimeFromConversation,
  getLastProposedDateFromConversation,
} from "@/lib/ai/chat/route-helpers";
import {
  templateBookingConfirmed,
  templateBookingFailed,
  templateBookingLimitExceeded,
  templateBookingCancelled,
  templateConfirmBooking,
  templateAskDuration,
  templateSlotUnavailable,
} from "@/lib/ai/chat/response-templates";

export const runtime = "nodejs";

/**
 * Helper to properly escape text for the AI stream format.
 * Uses JSON.stringify to handle all special characters correctly.
 */
function escapeForAIStream(text: string): string {
  // JSON.stringify handles all escaping, then we remove the outer quotes
  const escaped = JSON.stringify(text);
  // Remove the surrounding quotes that JSON.stringify adds
  return escaped.slice(1, -1);
}

const groq = createOpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

/* --------------------------------
   System prompt builder
-------------------------------- */

function buildSystemPrompt(dynamicContext?: string) {
  const faqText = FACILITY_FAQ.map(
    (item) => `Q: ${item.question}?\nA: ${item.answer}`
  ).join("\n\n");

  const livePart = dynamicContext
    ? `\n\n=== SOURCE OF TRUTH (Use ONLY this data) ===\n${dynamicContext}\n=== END SOURCE OF TRUTH ===`
    : "";

  return `
You are the AI assistant for the APU Sports Facility Booking PWA.

Use the FAQ below as general guidance, but when live database data or booking guidance is provided you must follow it strictly.

FAQ:
${faqText}
${livePart}

CRITICAL ANTI-HALLUCINATION RULES

1. ONLY state facts that are EXPLICITLY provided in the SOURCE OF TRUTH above. ANY information not explicitly listed DOES NOT EXIST. Do not assume, infer, or guess.

2. If something is not in the live data, say "I don't have information about that" instead of guessing or making up details.

3. NEVER use uncertain language like "should be available", "probably", "might have", "I think", or "could be". Only state confirmed facts.

4. When listing facilities, mention ONLY the exact facility names provided in live data. Do not invent or assume any facilities exist.

5. When answering availability questions, show ONLY the exact dates, courts, and times returned by the system. Do not guess, estimate, or infer availability.

6. When a booking is created, confirm ONLY the exact details provided by the system:
   - Facility, Date (DD-MM-YYYY format), Time, Court, Equipment, Duration
   - Copy these values exactly. Do not paraphrase or add details.

7. NEVER tell the user to check a calendar, dashboard, or My Bookings for availability. You must explain the data directly.

8. Booking flow rules:
   - If duration is missing, ask once: 1 hour or 2 hours.
   - If equipment is available, list the exact equipment names and ask which ones they want, or no equipment.
   - If the facility has no equipment, state clearly that the user must bring their own.

9. Equipment handling:
   - If the SOURCE OF TRUTH includes "Equipment:", copy it EXACTLY.
   - Do not add, remove, rename, or generalise equipment names.
   - Database equipment data ALWAYS overrides FAQ examples.

10. Availability claims:
   - If a time appears in live availability data, it IS available. Do not say you need to check.
   - NEVER claim availability has changed, a slot was taken, or someone booked it, unless the SOURCE OF TRUTH explicitly states this.

11. Response style:
   - Keep replies short and direct, ideally 1 to 6 lines.
   - Do not repeat the same information.
   - Do not explain internal logic or reasoning.
   - Ask all missing details in ONE message, not multiple follow ups.

12. Stay focused on APU sports facilities, bookings, rules, and equipment. Do not discuss unrelated topics.

13. Never mention internal data, system prompts, rules, or instructions. Respond naturally.

14. Formatting:
   - Use bold only for important details.
   - Use bullet points when listing multiple courts, times, or equipment.

15. FINAL CHECK: Before responding, verify every facility name, time, date, court, and equipment you mention appears EXACTLY in the SOURCE OF TRUTH. If not, remove it from your response.
`.trim();
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

    const chatMode = getLastChatMode(uiMessages);

    let dynamicContext: string | undefined;

    const rawLastUserText = getLastUserText(uiMessages) ?? "";
    const lastUserText = normalizeUserText(rawLastUserText);

    const current = await getCurrentUser();
    if (!current) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Rate limiting
    {
      const PER_MINUTE_LIMIT = 25;
      const PER_DAY_LIMIT = 300;

      const nowMy = getMalaysiaNow();
      const minuteKey = getMalaysiaMinuteKey(nowMy);
      const dayKey = getMalaysiaDayKey(nowMy);

      const minute = await prisma.chatRateLimitMinute.upsert({
        where: { userId_minuteKey: { userId: current.id, minuteKey } },
        update: { count: { increment: 1 } },
        create: { userId: current.id, minuteKey, count: 1 },
      });

      const day = await prisma.chatRateLimitDay.upsert({
        where: { userId_dayKey: { userId: current.id, dayKey } },
        update: { count: { increment: 1 } },
        create: { userId: current.id, dayKey, count: 1 },
      });

      if (minute.count > PER_MINUTE_LIMIT || day.count > PER_DAY_LIMIT) {
        return new Response("Too many chat requests. Please slow down.", {
          status: 429,
        });
      }
    }

    // Regexes for intent detection (current message)
    const facilitiesQuestionRegex =
      /\b(facility|facilities)\b[^?]*\b(available|there|exist|can i book|can book|today)\b/i;

    const listFacilitiesRegex = /list( all)? facilities/i;

    const availabilityRegex =
      /\b(available|free|slot|time|when can i book|what time|what about)\b/i;

    // Detect explicit request to show all available time slots
    const showAllSlotsRegex =
      /\b(show|list|what are|tell me|give me|what other|any other|other available|other time|other slot).*(time|slot|hour|available|availability)?\b/i;

    const bookingIntentRegex =
      /\b(book|reserve|schedule|help me book|make a booking)\b/i;

    const confirmYesRegex = /^(confirm)\b/i;

    const cancelNoRegex = /^(cancel|do not book|dont book|don't book)\b/i;

    const rulesQuestionRegex =
      /\b(rule|rules|regulation|regulations|penalt(?:y|ies)|punishment|punishments|fine|fines|dress code|behaviour|behavior|conduct)\b/i;

    const myBookingsRegex =
      /\b(my bookings?|my reservations?|show my bookings?|what are my bookings?|list my bookings?|view my bookings?|do i have any bookings?|upcoming bookings?|my upcoming)\b/i;

    const explicitTimeRegex = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(am|pm)?\b/i;

    const hasExplicitTime = explicitTimeRegex.test(lastUserText);
    const hasAvailabilityKeyword = availabilityRegex.test(lastUserText);
    const isShowAllSlotsRequest = showAllSlotsRegex.test(lastUserText) && !hasExplicitTime;

    const hasRegexBookingIntent = bookingIntentRegex.test(lastUserText);
    const hasFuzzyBookingIntent = hasFuzzyBookingIntentWord(lastUserText);
    const hasBookingIntent = hasRegexBookingIntent || hasFuzzyBookingIntent;

    const isConfirm = confirmYesRegex.test(lastUserText);
    const isCancel = cancelNoRegex.test(lastUserText);
    const isRulesQuestion = rulesQuestionRegex.test(lastUserText);
    const isMyBookingsQuestion = myBookingsRegex.test(lastUserText);

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

    const isBookingConversation =
      hasBookingIntent || Boolean(lastBookingQuestionText);

    // Load facilities
    const allFacilities = await prisma.facility.findMany({
      where: { active: true },
      select: { id: true, name: true, type: true },
      orderBy: { name: "asc" },
    });

    const facilityNames = allFacilities.map((f) => f.name);
    const facilityTokens = allFacilities
      .flatMap((f) => [f.name.toLowerCase(), f.type.toLowerCase()])
      .filter(Boolean);

    const todayIso = getMalaysiaToday();

    const facilityQuestionTextForBooking = getFacilityAwareQuestionText(
      uiMessages,
      facilityTokens
    );

    const conversationHasTime = facilityQuestionTextForBooking
      ? explicitTimeRegex.test(facilityQuestionTextForBooking)
      : false;

    // Detect implied booking intent: facility (even fuzzy) + time = booking request
    // e.g., "tenis later at 8pm" should be treated as a booking intent
    const hasFuzzyFacilityMatch = guessFacilityForClarification(lastUserText, allFacilities) !== null;
    const hasImpliedBookingIntent = hasFuzzyFacilityMatch && hasExplicitTime;

    // Detect time change request in active booking flow
    // e.g., "6pm instead", "give me 6pm", "what about 7pm", "can I have 5pm", "book 8pm", "can i book 8pm one"
    const timeChangePattern = /\b(instead|give me|what about|how about|can i have|can i get|i want|i prefer|change to|switch to|book|can i book|i'll take|take the|that one)\b/i;
    const isTimeOnlyMessage = lastUserText.match(/^\s*\d{1,2}\s*(am|pm)?\s*(one|slot|please)?\s*$/i);
    const isTimeChangeRequest = 
      hasExplicitTime && 
      isBookingConversation &&
      !facilityTokens.some((t) => lastUserText.toLowerCase().includes(t)) && // No facility mentioned = changing time only
      (timeChangePattern.test(lastUserText) || isTimeOnlyMessage);

    const isFollowUpAvailability =
      !hasBookingIntent &&
      hasAvailabilityKeyword &&
      !hasExplicitTime &&
      isBookingConversation;

    /* 1. Explicit confirmation "confirm" */
    if (isConfirm) {
      // First try to get the date from the last assistant proposal (what user saw)
      // This ensures we use the date the user agreed to, not re-parse from messages
      let requestedDateIso = getLastProposedDateFromConversation(uiMessages);
      
      // Fallback to parsing from conversation if no proposal found
      if (!requestedDateIso) {
        requestedDateIso = getRequestedDateFromConversation(
          uiMessages,
          lastUserText,
          todayIso
        );
      }
      const requestedDateDmy = formatDateDMY(requestedDateIso);

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
          dynamicContext =
            "You said confirm, but there are no active facilities configured in the system yet.";
        } else {
          dynamicContext = `You said confirm, but I still do not know which facility you want to book.

Active facilities:
${facilityNames.join("\n")}

Please say something like:
- "Book Tennis tomorrow at 6pm"
- "Help me book Basketball Court on Friday at 5pm"`;
        }
      } else {
        const facilityId = findFacilityIdStrict(
          facilityQuestionText,
          allFacilities
        );

        if (!facilityId) {
          dynamicContext =
            "I could not find any active facility matching your booking request.";
        } else {
          const facilityRow = await prisma.facility.findUnique({
            where: { id: facilityId },
            include: {
              courts: { where: { active: true }, orderBy: { name: "asc" } },
              equipment: true,
            },
          });

          if (!facilityRow) {
            dynamicContext = "I could not load details for that facility.";
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
              /\b(1\s*hours?|one\s*hours?|2\s*hours?|two\s*hours?)\b/i.test(
                facilityQuestionText
              );

            // Check for invalid durations (3+ hours)
            const hasInvalidDuration =
              /\b([3-9]|[1-9]\d+)\s*(hours?|hrs?)\b/i.test(facilityQuestionText);

            let hasEquipmentDecision = false;
            let deniesEquipment = false;
            let chosenEquipmentNamesFromText: string[] = [];

            if (facilityForPrompt.equipmentNames.length === 0) {
              hasEquipmentDecision = true;
            } else {
              deniesEquipment =
                /\b(no equipment|no need equipment|do not need equipment|dont need equipment|no\b|none\b|nothing\b)\b/i.test(
                  qLower
                );

              // Use word-based matching for equipment names
              chosenEquipmentNamesFromText = facilityForPrompt.equipmentNames.filter(
                (name) => {
                  const nameLower = name.toLowerCase();
                  const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 0);
                  const allWordsFound = nameWords.every((word) => qLower.includes(word));
                  return allWordsFound || qLower.includes(nameLower);
                }
              );

              hasEquipmentDecision =
                deniesEquipment || chosenEquipmentNamesFromText.length > 0;
            }

            if (hasInvalidDuration) {
              dynamicContext = `
Bookings can only be made for **1 hour** or **2 hours**.

You requested a duration that is not allowed. Please specify either 1 hour or 2 hours for your booking.
              `.trim();
            } else if (!hasDuration) {
              dynamicContext = buildMissingBookingDetailsMessage({
                facility: facilityForPrompt,
                requestedDate: requestedDateDmy,
                hasDuration,
                hasEquipmentDecision,
              });
            } else {
              const suggestion = await getBookingSuggestionFromQuestion({
                questionText: facilityQuestionText,
                requestedDate: requestedDateIso,
              });

              // Override the suggested time with the last proposed time from the conversation
              // This ensures we use the time the user agreed to confirm, not the re-parsed time
              if (suggestion) {
                const lastProposedTime = getLastProposedTimeFromConversation(uiMessages);
                if (lastProposedTime) {
                  suggestion.suggestedTimeLabel = lastProposedTime;
                  suggestion.isExactMatch = true; // Treat as exact match since user confirmed this time
                }
              }

              if (!suggestion) {
                dynamicContext =
                  "I could not find any active facility matching your booking request.";
              } else if (suggestion.reason) {
                dynamicContext = suggestion.reason;
              } else {
                if (facilityForPrompt.equipmentNames.length > 0) {
                  if (deniesEquipment || !hasEquipmentDecision) {
                    suggestion.chosenEquipmentNames = [];
                  } else if (chosenEquipmentNamesFromText.length > 0) {
                    suggestion.chosenEquipmentNames =
                      chosenEquipmentNamesFromText;
                  }
                }

                const startForLimit = new Date(
                  `${suggestion.date}T${suggestion.suggestedTimeLabel}:00+08:00`
                );

                try {
                  await assertBookingLimit({
                    userId: current.id,
                    start: startForLimit,
                  });
                } catch (e: unknown) {
                  const msg =
                    e instanceof BookingLimitError
                      ? e.message
                      : "Booking could not be created. Please try again.";

                  // Set dynamicContext so LLM can respond properly
                  dynamicContext = `
**Booking Limit Reached**

${msg}

In your reply:
- Inform the user they have reached their booking limit.
- Suggest they cancel an existing booking or try a different date.
- Do NOT try to create the booking.
                  `.trim();
                }

                // Only proceed with booking if limit check passed
                if (!dynamicContext) {
                  const result = await createBookingFromAI(suggestion);

                  if (!result.ok) {
                    // Booking failed - use dynamicContext for proper response
                    dynamicContext = `
❌ **Booking Failed**

${result.message}

Please choose another time or check availability again.
                    `.trim();
                  } else {
                    // Booking succeeded!
                    const finalEquipInline =
                      result.equipmentNames && result.equipmentNames.length > 0
                        ? result.equipmentNames.join(", ")
                        : "None";

                    const durationLabel =
                      suggestion.durationHours === 2 ? "2 hours" : "1 hour";

                    dynamicContext = `
✅ **Booking Confirmed**

• **Facility:** ${result.facilityName}
• **Date:** ${formatDateDMY(result.date)}
• **Time:** ${result.timeLabel}
• **Court:** ${result.courtName}
• **Duration:** ${durationLabel}
• **Equipment:** ${finalEquipInline}

In your reply:
- Confirm the booking was successful.
- Show the details exactly as listed above.
- Remind the user to arrive on time and follow facility rules.
                    `.trim();
                  }
                }
              }
            }
          }
        }
      }
    }

    /* 2. Cancellation replies */
    if (!dynamicContext && isCancel) {
      // Use templated response for cancellation - bypass LLM
      const templateResponse = templateBookingCancelled();

      return new Response(
        `0:"${escapeForAIStream(templateResponse)}"\n`,
        {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "X-Vercel-AI-Data-Stream": "v1",
          },
        }
      );
    }

    /* 2.5 Show all available time slots during booking flow */
    if (!dynamicContext && isShowAllSlotsRequest && isBookingConversation) {
      const lastFacilityId = getLastFacilityIdFromConversation(uiMessages, allFacilities);
      const lastFacility = lastFacilityId
        ? allFacilities.find((f) => f.id === lastFacilityId)
        : null;

      if (lastFacility) {
        const requestedDateIso = getRequestedDateFromConversation(
          uiMessages,
          lastUserText,
          todayIso
        );

        const data = await getFacilityAvailabilityById(lastFacility.id, requestedDateIso);

        if (data) {
          const { facility, courts, bookings, date } = data;
          const dateDmy = formatDateDMY(date);
          const nowMy = getMalaysiaNow();

          const lines: string[] = [];

          for (const court of courts) {
            const courtBookings = bookings.filter((b) => b.courtId === court.id);

            const openTime = facility.openTime ?? "08:00";
            const closeTime = facility.closeTime ?? "22:00";

            const free = computeFreeHours(
              openTime,
              closeTime,
              date,
              courtBookings,
              nowMy,
              1
            );

            if (free.length === 0) continue;

            lines.push(`**${court.name}:**\n${free.map((t) => `• ${t}`).join("\n")}`);
          }

          if (lines.length === 0) {
            dynamicContext = `📅 **${facility.name}** on ${dateDmy}\n\nNo available slots remaining for this date. Please try another date.`;
          } else {
            dynamicContext = `📅 **${facility.name}** on ${dateDmy}\n\n${lines.join("\n\n")}\n\nReply with a time, duration (1 or 2 hours), and equipment choice to book.`;
          }
        } else {
          dynamicContext = `I couldn't retrieve availability for ${lastFacility.name}. Please try again.`;
        }
      } else {
        dynamicContext = `I'm not sure which facility you're asking about. Please specify the facility name.`;
      }
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

    /* 3b. Rules and policy questions */
    if (!dynamicContext && isRulesQuestion) {
      const facilityIdForRules = findFacilityIdStrict(
        lastUserText,
        allFacilities
      );

      if (!facilityIdForRules) {
        if (facilityNames.length === 0) {
          dynamicContext =
            "The user is asking about rules or penalties, but there are no active facilities configured in the system yet.";
        } else {
          dynamicContext = `The user is asking about rules or policies, but did not clearly mention which facility.

Active facilities:
${facilityNames.join("\n")}

In your reply:
- Ask the user to choose exactly one facility from the list above.
- Do not guess which facility they mean.
- Do not describe very specific rules or punishments that might be wrong for a particular facility.`;
        }
      } else {
        const facilityRow = await prisma.facility.findUnique({
          where: { id: facilityIdForRules },
        });

        if (!facilityRow) {
          dynamicContext =
            "The user is asking about rules for a facility that no longer exists in the system.";
        } else {
          dynamicContext = `The user is asking about rules or policies for "${facilityRow.name}".

There is no separate rules table in the live data. You must answer using:
- The general guidance from the FAQ.
- The fact that the user is interested in "${facilityRow.name}".

In your reply:
- Mention the facility name "${facilityRow.name}" clearly.
- Explain general booking and usage rules that apply at APU.
- Do not invent detailed punishments, money fines, or disciplinary actions that are not stated in the FAQ or system guidance.
- If something is not clearly specified, say students should follow the posted rules at the sports centre or ask staff for the most accurate information.`;
        }
      }
    }

    /* 3.9 Availability menu choice, ask for date only */
    const availabilityMenuRegex =
      /^(check availability|availability|check available times)$/i;

    if (!dynamicContext && availabilityMenuRegex.test(lastUserText)) {
      dynamicContext = `
The user wants availability only.

In your reply:
- Ask for the date only (today, tomorrow, or DD-MM-YYYY).
- Do NOT ask for time.
- Do NOT ask for duration.
- Do NOT ask about equipment.
      `.trim();
    }

    /* 3.95 Date-only follow up after facility already chosen: go straight into booking flow */
    if (!dynamicContext && isDateOnlyMessage(lastUserText)) {
      console.log("[DEBUG] Date-only message detected:", lastUserText);
      const lastFacilityId = getLastFacilityIdFromConversation(
        uiMessages,
        allFacilities
      );
      console.log("[DEBUG] Found facility ID from conversation:", lastFacilityId);
      const lastFacility = lastFacilityId
        ? allFacilities.find((f) => f.id === lastFacilityId)
        : null;
      console.log("[DEBUG] Matched facility:", lastFacility?.name);

      if (lastFacility) {
        const requestedDateIso = getRequestedDateFromConversation(
          uiMessages,
          lastUserText,
          todayIso
        );
        console.log("[DEBUG] Requested date ISO:", requestedDateIso);
        const data = await getFacilityAvailabilityById(
          lastFacility.id,
          requestedDateIso
        );

        if (!data) {
          dynamicContext = `The system has no availability data for "${
            lastFacility.name
          }" on ${formatDateDMY(requestedDateIso)}.`;
        } else {
          const { facility, courts, bookings, date } = data;
          console.log("[DEBUG] Facility data:", { name: facility.name, openTime: facility.openTime, closeTime: facility.closeTime });
          console.log("[DEBUG] Courts:", courts.map(c => c.name));
          console.log("[DEBUG] Date:", date);
          const dateDmy = formatDateDMY(date);
          const nowMy = getMalaysiaNow();
          console.log("[DEBUG] Now (MY):", nowMy.toISOString());

          const lines: string[] = [];

          for (const court of courts) {
            const courtBookings = bookings.filter(
              (b) => b.courtId === court.id
            );

            const openTime = facility.openTime ?? "08:00";
            const closeTime = facility.closeTime ?? "22:00";
            console.log("[DEBUG] Computing free hours for", court.name, "with openTime:", openTime, "closeTime:", closeTime);

            // List 1-hour start times for display
            const free = computeFreeHours(
              openTime,
              closeTime,
              date,
              courtBookings,
              nowMy,
              1
            );
            console.log("[DEBUG] Free slots for", court.name, ":", free);

            if (free.length === 0) continue;

            lines.push(
              `${court.name}:\n${free.map((t) => `- ${t}`).join("\n")}`
            );
          }

          if (lines.length === 0) {
            dynamicContext = `
Availability for "${facility.name}" on ${dateDmy}:

No available slots remaining for today.

In your reply:
- Say there are no remaining slots.
- Ask the user to choose another date.
            `.trim();
          } else {
            const equipmentRows = await prisma.equipment.findMany({
              where: { facilityId: facility.id },
            });
            const equipmentNames = equipmentRows.map((e) => e.name);

            const equipmentList =
              equipmentNames.length > 0
                ? [...equipmentNames, "No equipment"]
                    .map((e, i) => `${i + 1}. ${e}`)
                    .join("\n")
                : "";

            const equipmentSection =
              equipmentList !== ""
                ? `**Equipment options:**\n${equipmentList}`
                : "No equipment available (bring your own if needed)";

            dynamicContext = `
${facility.name} on ${dateDmy}

**Available times:**
${lines.join("\n\n")}

${equipmentSection}

In your reply:
- Show the available times grouped by court.
- Show the equipment options as a numbered list.
- Ask the user to reply with: time, duration (1 or 2 hours), and equipment choice.
- Do not ask for the facility again.
- Do not ask for the date again.
            `.trim();
          }
        }
      }
    }

    /* 4. Availability flows (normal) */
    if (
      !dynamicContext &&
      !isFacilitiesQuestion &&
      (hasAvailabilityKeyword ||
        hasBookingIntent ||
        isFollowUpAvailability ||
        (chatMode === "availability" && isDateOnlyMessage(lastUserText))) &&
      !hasExplicitTime &&
      !isConfirm &&
      !isCancel
    ) {
      const requestedDateIso = getRequestedDateFromConversation(
        uiMessages,
        lastUserText,
        todayIso
      );
      const requestedDateDmy = formatDateDMY(requestedDateIso);

      const facilityQuestionText =
        resolveFacilityAwareQuestionText(
          uiMessages,
          facilityTokens,
          allFacilities,
          lastUserText
        ) ?? "";

      let facilityQuestionTextFinal = facilityQuestionText;

      if (
        chatMode === "availability" &&
        isDateOnlyMessage(lastUserText) &&
        (!facilityQuestionTextFinal ||
          !facilityTokens.some((t) =>
            facilityQuestionTextFinal.toLowerCase().includes(t)
          ))
      ) {
        const lastFacilityId = getLastFacilityIdFromConversation(
          uiMessages,
          allFacilities
        );
        const lastFacility = lastFacilityId
          ? allFacilities.find((f) => f.id === lastFacilityId)
          : null;

        if (lastFacility) {
          facilityQuestionTextFinal = `${lastFacility.name} availability ${lastUserText}`;
        }
      }

      const wantsBookingFlow =
        chatMode === "booking"
          ? true
          : chatMode === "availability"
          ? false
          : hasBookingIntent || isFollowUpAvailability || isBookingConversation;

      if (
        !facilityQuestionTextFinal ||
        !facilityTokens.some((t) =>
          facilityQuestionTextFinal.toLowerCase().includes(t)
        )
      ) {
        if (facilityNames.length === 0) {
          dynamicContext = wantsBookingFlow
            ? `You want to know what time you can book on ${requestedDateDmy}, but there are no active facilities in the system yet.`
            : `You asked about availability on ${requestedDateDmy}, but there are no active facilities in the database.`;
        } else {
          dynamicContext = wantsBookingFlow
            ? `I could not detect which facility you mean.

Active facilities:
${facilityNames.join("\n")}

Example:
- "What time can I book Tennis on ${requestedDateDmy}?"`
            : `I could not detect which facility you mean.

Active facilities:
${facilityNames.join("\n")}

Example:
- "What time is Tennis free on ${requestedDateDmy}?"`;
        }
      } else {
        const facilityId = findFacilityIdStrict(
          facilityQuestionTextFinal,
          allFacilities
        );

        if (!facilityId) {
          dynamicContext = `I could not find any active facility matching "${facilityQuestionTextFinal}".`;
        } else {
          const data = await getFacilityAvailabilityById(
            facilityId,
            requestedDateIso
          );

          if (!data) {
            dynamicContext = `The system has no availability data for that facility on ${requestedDateDmy}.`;
          } else {
            const { facility, courts, bookings, date } = data;
            const dateDmy = formatDateDMY(date);
            const nowMy = getMalaysiaNow();

            const lines: string[] = [];

            for (const court of courts) {
              const courtBookings = bookings.filter(
                (b) => b.courtId === court.id
              );

              const openTime = facility.openTime ?? "08:00";
              const closeTime = facility.closeTime ?? "22:00";

              // List 1-hour start times for display
              const free = computeFreeHours(
                openTime,
                closeTime,
                date,
                courtBookings,
                nowMy,
                1
              );

              if (free.length === 0) continue;

              lines.push(
                `${court.name}:\n${free.map((t) => `- ${t}`).join("\n")}`
              );
            }

            // Availability only mode
            if (!wantsBookingFlow) {
              dynamicContext = `
Availability for "${facility.name}" on ${dateDmy}:

${lines.length === 0 ? "No available slots remaining." : lines.join("\n\n")}
              `.trim();

              const result = streamText({
                model: groq(process.env.GROQ_MODEL ?? "llama-3.1-8b-instant"),
                system: buildSystemPrompt(dynamicContext),
                messages: convertToModelMessages(uiMessages),
                temperature: 0,
              });

              return result.toUIMessageStreamResponse();
            }

            // Booking flow mode
            const equipmentRows = await prisma.equipment.findMany({
              where: { facilityId: facility.id },
            });
            const equipmentNames = equipmentRows.map((e) => e.name);

            const equipmentList =
              equipmentNames.length > 0
                ? [...equipmentNames, "No equipment"]
                    .map((e, i) => `${i + 1}. ${e}`)
                    .join("\n")
                : "";

            const equipmentSection =
              equipmentList !== ""
                ? `**Equipment options:**\n${equipmentList}`
                : "No equipment available (bring your own if needed)";

            dynamicContext = `
${facility.name} on ${dateDmy}

**Available times:**
${lines.join("\n\n")}

${equipmentSection}

In your reply:
- Show the available times grouped by court.
- Show the equipment options as a numbered list.
- Ask the user to reply with: time, duration (1 or 2 hours), and equipment choice.
- Do not ask for the facility again.
- Do not ask for the date again.
            `.trim();
          }
        }
      }
    }

    /* 5. Booking intent with explicit time */
    const shouldHandleBookingWithTime =
      !dynamicContext &&
      !isFacilitiesQuestion &&
      (hasBookingIntent || isBookingConversation || isTimeChangeRequest) &&
      (hasExplicitTime ||
        explicitInLastBookingQuestion ||
        (hasBookingIntent && conversationHasTime)) &&
      !isConfirm &&
      !isCancel &&
      !isFollowUpAvailability;

    if (shouldHandleBookingWithTime) {
      const requestedDateIso = getRequestedDateFromConversation(
        uiMessages,
        lastUserText,
        todayIso
      );
      const requestedDateDmy = formatDateDMY(requestedDateIso);

      // For time change requests, build a fresh question using facility from context + new time
      let facilityQuestionText: string | undefined;
      
      if (isTimeChangeRequest) {
        // Get facility from conversation, but use ONLY the current message's time
        const lastFacilityId = getLastFacilityIdFromConversation(uiMessages, allFacilities);
        const lastFacility = lastFacilityId 
          ? allFacilities.find((f) => f.id === lastFacilityId) 
          : null;
        
        if (lastFacility) {
          // Build question text with facility name + current message (which has the new time)
          facilityQuestionText = `${lastFacility.name} ${lastUserText}`;
        }
      }
      
      // If not a time change request (or no facility found), use normal resolution
      if (!facilityQuestionText) {
        facilityQuestionText =
          facilityQuestionTextForBooking ??
          resolveFacilityAwareQuestionText(
            uiMessages,
            facilityTokens,
            allFacilities,
            lastUserText
          );
      }

      if (
        !facilityQuestionText ||
        !facilityTokens.some((t) =>
          facilityQuestionText.toLowerCase().includes(t)
        )
      ) {
        if (facilityNames.length === 0) {
          dynamicContext = `You want to make a booking on ${requestedDateDmy}, but there are no active facilities in the system yet.`;
        } else {
          dynamicContext = `I could not detect which facility you want.

Active facilities:
${facilityNames.join("\n")}

Example:
- "Book Tennis tomorrow at 6pm"`;
        }
      } else {
        const facilityId = findFacilityIdStrict(
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
            dynamicContext = "I could not load details for that facility.";
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
              /\b(1\s*hours?|one\s*hours?|2\s*hours?|two\s*hours?)\b/i.test(
                facilityQuestionText
              );

            // Check for invalid durations (3+ hours)
            const hasInvalidDuration =
              /\b([3-9]|[1-9]\d+)\s*(hours?|hrs?)\b/i.test(facilityQuestionText);

            let hasEquipmentDecision = false;
            if (facilityForPrompt.equipmentNames.length === 0) {
              hasEquipmentDecision = true;
            } else {
              // Check both facility question text AND current message for equipment decisions
              const textToCheck = `${qLower} ${lastUserText.toLowerCase()}`;
              
              const deniesEquipment =
                /\b(no equipment|no need equipment|do not need equipment|dont need equipment|with no equipment|without equipment|none\b|nothing\b)\b/i.test(
                  textToCheck
                );

              // Check if any equipment is mentioned (using word-based matching)
              const mentionsAnyEquipment = facilityForPrompt.equipmentNames.some(
                (name) => {
                  const nameLower = name.toLowerCase();
                  const nameWords = nameLower.split(/\s+/).filter((w) => w.length > 0);
                  const allWordsFound = nameWords.every((word) => textToCheck.includes(word));
                  return allWordsFound || textToCheck.includes(nameLower);
                }
              );

              hasEquipmentDecision = deniesEquipment || mentionsAnyEquipment;
            }

            const suggestion = await getBookingSuggestionFromQuestion({
              questionText: facilityQuestionText,
              requestedDate: requestedDateIso,
            });

            if (!suggestion) {
              dynamicContext = `I could not find any active facility matching "${facilityQuestionText}".`;
            } else if (suggestion.reason) {
              dynamicContext = `
${suggestion.reason}

In your reply:
- Explain there are no free slots for that facility on ${requestedDateDmy}.
- Do not create or confirm any booking.
- Ask the user to choose another date or time.
              `.trim();
            } else if (hasInvalidDuration) {
              dynamicContext = `
Bookings can only be made for **1 hour** or **2 hours**.

You requested a duration that is not allowed. Please specify either 1 hour or 2 hours for your booking.
              `.trim();
            } else if (!hasDuration) {
              // Only duration is missing - ask for it along with equipment choice
              const equipmentList =
                facilityForPrompt.equipmentNames.length > 0
                  ? [...facilityForPrompt.equipmentNames, "No equipment"]
                      .map((e, i) => `${i + 1}. ${e}`)
                      .join("\n")
                  : "";

              const equipmentSection =
                equipmentList !== ""
                  ? `**Choose equipment:**\n${equipmentList}`
                  : "No equipment available (bring your own if needed)";

              if (suggestion.isExactMatch) {
                dynamicContext = `
This is a NEW booking request. No booking has been created yet.

**Booking Details:**
- Facility: ${suggestion.facilityName}
- Date: ${formatDateDMY(suggestion.date)}
- Time: ${suggestion.suggestedTimeLabel}
- Court: ${suggestion.courtName}
- Duration: _Not selected yet_
- Equipment: _Not selected yet_

**Choose duration:** 1 hour or 2 hours

${equipmentSection}

In your reply:
- Do NOT say the user already has a booking or has booked.
- Show the Booking Details exactly as above using bullet points.
- Ask for duration and equipment selection clearly.
- Format the equipment choices as a numbered list.
                `.trim();
              } else {
                // Requested time is not available - show clear message with alternatives
                // We need to get the available times from the booking suggestion data
                const requestedTimeDisplay = suggestion.requestedTimeLabel ?? "the requested time";
                
                dynamicContext = `
The **${requestedTimeDisplay}** slot is already booked.

**Nearest available time:** ${suggestion.suggestedTimeLabel}

📋 **Suggested Booking:**
- Facility: ${suggestion.facilityName}
- Date: ${formatDateDMY(suggestion.date)}
- Time: ${suggestion.suggestedTimeLabel}
- Court: ${suggestion.courtName}

${equipmentSection}

If you want **${suggestion.suggestedTimeLabel}**, reply with your preferred duration (1 or 2 hours) and equipment choice.

If you want a **different time**, just tell me the time you prefer and I'll check if it's available.

In your reply:
- Clearly state that the requested time (${requestedTimeDisplay}) is already booked.
- Offer the suggested time ${suggestion.suggestedTimeLabel} as an alternative.
- Ask if they want the suggested time OR let them specify a different time.
- Do NOT create any booking yet.
                `.trim();
              }
            } else if (!hasEquipmentDecision && facilityForPrompt.equipmentNames.length > 0) {
              // Has duration but needs equipment choice - show summary and ask for equipment + confirm
              const durationLabel =
                suggestion.durationHours === 2 ? "2 hours" : "1 hour";

              const availableEquipInline = facilityForPrompt.equipmentNames.join(", ");

              dynamicContext = `
This is a NEW booking request. No booking has been created yet.

Proposed booking:
- **Facility:** ${suggestion.facilityName}
- **Date:** ${formatDateDMY(suggestion.date)}
- **Time:** ${suggestion.suggestedTimeLabel}
- **Court:** ${suggestion.courtName}
- **Duration:** ${durationLabel}
- **Available Equipment:** ${availableEquipInline}

In your reply:
- Do NOT say the user already has a booking or has already booked.
- Show the proposed booking details above.
- Ask which equipment they want from the list above, or "no equipment".
- Tell them to type **confirm** after choosing equipment to create the booking, or **cancel** to stop.
              `.trim();
            } else {
              const durationLabel =
                suggestion.durationHours === 2 ? "2 hours" : "1 hour";

              const chosenEquipInline =
                suggestion.chosenEquipmentNames &&
                suggestion.chosenEquipmentNames.length > 0
                  ? suggestion.chosenEquipmentNames.join(", ")
                  : "No equipment";

              dynamicContext = `
This is a NEW booking request. The slot IS available. No booking has been created yet.

**Booking Details:**
- **Facility:** ${suggestion.facilityName}
- **Date:** ${formatDateDMY(suggestion.date)}
- **Time:** ${suggestion.suggestedTimeLabel}
- **Court:** ${suggestion.courtName}
- **Duration:** ${durationLabel}
- **Equipment:** ${chosenEquipInline}

In your reply:
- Show ONLY the Booking Details above exactly as formatted.
- Say: "Type **confirm** to create this booking, or **cancel** to stop."
- Do NOT add any extra text about availability, other bookings, or suggestions.
- Do NOT say the slot is not available or that it was taken.
- Do NOT mention anything about booking again or re-booking.
              `.trim();
            }
          }
        }
      }
    }

    /* 5.5 Facility name only (e.g. user types "tennis") */
    if (
      !dynamicContext &&
      !isFacilitiesQuestion &&
      !hasAvailabilityKeyword &&
      !hasBookingIntent &&
      !hasExplicitTime &&
      !isConfirm &&
      !isCancel
    ) {
      const exactFacility = findFacilityExact(lastUserText, allFacilities);

      if (exactFacility) {
        dynamicContext = `
The user chose the facility "${exactFacility.name}" and wants to proceed.

In your reply:
- Confirm the facility name "${exactFacility.name}".
- Ask for the booking date only (today, tomorrow, or DD-MM-YYYY).
- Do not ask whether they want to check availability or make a booking.
        `.trim();
      }
    }

    /* 6. Safeguard for typos or unclear intent */
    if (!dynamicContext) {
      const guess = guessFacilityForClarification(lastUserText, allFacilities);

      if (guess) {
        dynamicContext = `
The last user message was: "${rawLastUserText}".

The system has a fuzzy guess that the user might be talking about the facility "${guess.name}", but this is not certain.

In your reply:
- Ask a short clarification question: "Did you mean ${guess.name}?"
- Do not show availability yet.
- Do not create any booking.
        `.trim();
      } else {
        dynamicContext = `
The last user message was: "${rawLastUserText}".

In your reply:
- Ask them to mention one facility and what they want, for example:
  - "Book Tennis tomorrow at 6pm"
  - "What time is Basketball Court available on Friday?"
- Do not invent facilities, equipment, times, or bookings.
        `.trim();
      }
    }

    // Final model call
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

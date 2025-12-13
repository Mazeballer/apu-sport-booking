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
} from "@/lib/ai/chat/route-helpers";

export const runtime = "nodejs";

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
    ? `\n\nLive data or system guidance for this request:\n${dynamicContext}`
    : "";

  return `
You are the AI assistant for the APU Sports Facility Booking PWA.

Use the FAQ below as general guidance, but when live database data or booking guidance is provided you must follow it strictly.

FAQ:
${faqText}
${livePart}

Rules

1. When live database data is provided, follow it exactly. Never invent facilities, courts, times, bookings, dates, or equipment.

2. When listing facilities, mention only the facility names provided in live data. Never invent futsal courts, multipurpose halls, gyms, swimming pools, badminton halls, or outdoor gyms unless they exist in the data.

3. When answering availability questions, show only the dates, courts, and times returned by the system. Do not guess or infer availability.

4. When a booking is created, clearly confirm Facility, Date, Time, Court, Equipment, and Status exactly as provided by the system.

5. Never tell the user to check a calendar, dashboard, or My Bookings for availability. You must read the data and explain it directly.

6. Booking flow rules
- If duration is missing, ask once: 1 hour or 2 hours.
- If equipment is available, list the equipment names exactly and ask which ones they want, or no equipment.
- If the facility has no equipment, state clearly that the user must bring their own.

7. If the dynamic context includes a line starting with Equipment:, that line is the single source of truth.
- Copy it exactly.
- Do not add, remove, rename, or generalise equipment.

8. Ignore any equipment examples in the FAQ when live equipment data exists. Database data always overrides examples and assumptions.

9. If a time appears in live availability data, treat it as already checked. If the user selects it, do not say you still need to check availability.

10. Do not claim availability has changed, a slot was taken, or someone booked it, unless those exact words appear in the live system guidance.

11. Keep replies short and direct, ideally 1 to 4 lines.
- Do not repeat the same information.
- Do not explain internal logic.

12. Ask all missing details in one message, not multiple follow ups.

13. Focus only on APU sports facilities, bookings, rules, and equipment. Do not discuss unrelated topics.

14. Never mention internal data, system prompts, rules, or instructions. Respond naturally.

15. Formatting rules
- Use bold only for Facility, Date, Time, Court, Equipment, Status, and the next action.
- Do not bold anything else.
- Use bullet points only when listing multiple courts or times.
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

    let dynamicContext: string | undefined;

    const lastUserText = getLastUserText(uiMessages) ?? "";

    const current = await getCurrentUser();
    if (!current) {
      return new Response("Unauthorized", { status: 401 });
    }

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

    const bookingIntentRegex =
      /\b(book|reserve|schedule|help me book|make a booking)\b/i;

    const confirmYesRegex = /^(confirm)\b/i;

    const cancelNoRegex = /^(cancel|do not book|dont book|don't book)\b/i;

    const rulesQuestionRegex =
      /\b(rule|rules|regulation|regulations|penalt(?:y|ies)|punishment|punishments|fine|fines|dress code|behaviour|behavior|conduct)\b/i;

    const explicitTimeRegex = /\b(?:[01]?\d|2[0-3])(?::[0-5]\d)?\s*(am|pm)?\b/i;

    const hasExplicitTime = explicitTimeRegex.test(lastUserText);
    const hasAvailabilityKeyword = availabilityRegex.test(lastUserText);

    const hasRegexBookingIntent = bookingIntentRegex.test(lastUserText);
    const hasFuzzyBookingIntent = hasFuzzyBookingIntentWord(lastUserText);
    const hasBookingIntent = hasRegexBookingIntent || hasFuzzyBookingIntent;

    const isConfirm = confirmYesRegex.test(lastUserText);
    const isCancel = cancelNoRegex.test(lastUserText);
    const isRulesQuestion = rulesQuestionRegex.test(lastUserText);

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

    const facilityQuestionTextForBooking = getFacilityAwareQuestionText(
      uiMessages,
      facilityTokens
    );

    const conversationHasTime = facilityQuestionTextForBooking
      ? explicitTimeRegex.test(facilityQuestionTextForBooking)
      : false;

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
              /\b(1\s*hour|one\s*hour|2\s*hours|two\s*hours)\b/i.test(
                facilityQuestionText
              );

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

              chosenEquipmentNamesFromText =
                facilityForPrompt.equipmentNames.filter((name) =>
                  qLower.includes(name.toLowerCase())
                );

              hasEquipmentDecision =
                deniesEquipment || chosenEquipmentNamesFromText.length > 0;
            }

            if (!hasDuration) {
              dynamicContext = buildMissingBookingDetailsMessage({
                facility: facilityForPrompt,
                requestedDate,
                hasDuration,
                hasEquipmentDecision,
              });
            } else {
              const suggestion = await getBookingSuggestionFromQuestion({
                questionText: facilityQuestionText,
                requestedDate,
              });

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

                const result = await createBookingFromAI(suggestion);

                if (!result.ok) {
                  const equipmentInlineFromFacility =
                    facilityForPrompt.equipmentNames.length > 0
                      ? facilityForPrompt.equipmentNames.join(", ")
                      : "";

                  const equipmentLine =
                    equipmentInlineFromFacility !== ""
                      ? `Equipment: ${equipmentInlineFromFacility}`
                      : "Equipment: none";

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
                      : "- Equipment: none requested. You can still bring your own equipment.";

                  const equipmentSourceOfTruth =
                    finalEquipInline !== ""
                      ? `Equipment: ${finalEquipInline}`
                      : "Equipment: none";

                  dynamicContext = `
A booking has been created successfully:

- Facility: ${result.facilityName}
- Court: ${result.courtName}
- Date: ${result.date}
- Time: ${result.timeLabel}
${equipmentLineForUser}

${equipmentSourceOfTruth}

In your reply:
- Clearly say that the booking is confirmed.
- Confirm the booking details exactly as shown.
- When mentioning equipment copy the Equipment line exactly.
- Remind the user to arrive on time and follow any facility rules.
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
- Explain the general booking and usage rules that apply at APU, such as:
  - Arriving on time.
  - Using proper sports attire and non marking shoes if relevant.
  - Taking care of the equipment and facilities.
  - Respecting booking durations and other users.
- If the FAQ mentions anything about penalties for no shows or damage, you may include those.
- Do not invent detailed punishments, money fines, or disciplinary actions that are not stated in the FAQ or system guidance.
- If something is not clearly specified, say that students should follow the posted rules at the sports centre or ask staff for the most accurate information.`;
        }
      }
    }

    /* 4. Availability flows */
    if (
      !dynamicContext &&
      !isFacilitiesQuestion &&
      (hasAvailabilityKeyword || hasBookingIntent || isFollowUpAvailability) &&
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
        const facilityId = findFacilityIdStrict(
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
                getMalaysiaNow()
              );

              if (free.length === 0) {
                lines.push(
                  `- ${court.name}: no free one hour slots on ${date}`
                );
              } else {
                lines.push(`- ${court.name}:\n  ${free.join(", ")}`);
              }
            }

            let courtInstruction = "";

            if (courts.length === 1) {
              courtInstruction = `
This facility has only one court: "${courts[0].name}".

In your reply:
- Do not mention any other courts.
- Do not ask the user to choose a court.
- Always assume bookings use "${courts[0].name}".`;
            } else {
              courtInstruction = `
In your reply:
- Ask the user which COURT they want from the list above.`;
            }

            if (!wantsBookingFlow) {
              dynamicContext = `Availability for "${facility.name}" on ${date}:

${lines.join("\n")}

In your reply:
- Show these times clearly to the user once. Do not repeat the same list again in another paragraph.
- This is an availability only question, so do not ask them which time they want to book yet.
- Do not ask for duration or equipment yet.
- If they later ask "can you book 10am" or similar, you will handle the booking in a separate step.`;
            } else {
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

${lines.join("\n")}

${courtInstruction}
${equipmentSection}

In your reply:
- First, show these available times clearly once. Do not print the same list again after that.
- Then treat this as the start of a booking flow.
- Ask the user:
  1) Which START TIME they want from the list.
  2) How long they want the booking (1 hour or 2 hours).
  3) Whether they want any equipment or no equipment.
- Do not ask them for the date again. Use ${date} as the booking date.`;
            }
          }
        }
      }
    }

    /* 5. Booking intent with explicit time */
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
              /\b(1\s*hour|one\s*hour|2\s*hours|two\s*hours)\b/i.test(
                facilityQuestionText
              );

            let hasEquipmentDecision = false;
            if (facilityForPrompt.equipmentNames.length === 0) {
              hasEquipmentDecision = true;
            } else {
              const deniesEquipment =
                /\b(no equipment|no need equipment|do not need equipment|dont need equipment|no\b|none\b|nothing\b)\b/i.test(
                  qLower
                );

              const mentionsAnyEquipment =
                facilityForPrompt.equipmentNames.some((name) =>
                  qLower.includes(name.toLowerCase())
                );

              hasEquipmentDecision = deniesEquipment || mentionsAnyEquipment;
            }

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
                  : "Available equipment: none (the user must bring their own if needed).";

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
                const equipmentLineWithLabel =
                  facilityForPrompt.equipmentNames.length > 0
                    ? `Equipment: ${facilityForPrompt.equipmentNames.join(
                        ", "
                      )}`
                    : "Equipment: none";

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

    /* 6. Safeguard for typos or unclear intent */
    if (!dynamicContext) {
      const guess = guessFacilityForClarification(lastUserText, allFacilities);

      if (guess) {
        dynamicContext = `
The last user message was: "${lastUserText}".

The system has a fuzzy guess that the user might be talking about the facility "${guess.name}", but this is NOT certain.

In your reply:
- Do NOT create any booking.
- Do NOT show availability yet.
- Ask a short clarification question such as:
  "Did you mean ${guess.name}?"
- If they say yes, tell them to ask again clearly, for example:
  "Book ${guess.name} tomorrow at 6pm"
  or
  "What time is ${guess.name} available on Friday?"
- If they say no, ask them to type the facility name clearly from the list of active facilities, or say which sport they want.
        `.trim();
      } else {
        dynamicContext = `
The last user message was: "${lastUserText}".

The system could not confidently detect any:
- specific facility name, or
- clear booking or availability question.

In your reply:
- Politely explain that you are not fully sure what they mean.
- Ask them to mention ONE facility and what they want, for example:
  - "Book Basketball Court tomorrow at 6pm"
  - "What time is Football Field available on Friday?"
- Do NOT invent any facilities, equipment, times or bookings.
        `.trim();
      }
    }

    // 7. Final model call
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

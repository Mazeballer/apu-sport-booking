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

// Fuzzy match helper
function findFacilityIdFromQuestion(
  question: string,
  facilities: { id: string; name: string; type: string }[]
) {
  const q = question.toLowerCase();

  // Try exact string includes first
  for (const f of facilities) {
    if (q.includes(f.name.toLowerCase()) || q.includes(f.type.toLowerCase())) {
      return f.id;
    }
  }

  // Fuzzy match tokens
  const tokens = q.split(/\s+/);
  for (const f of facilities) {
    const fWords = f.name.toLowerCase().split(/\s+/);
    for (const word of fWords) {
      if (tokens.some((t) => t.startsWith(word.slice(0, 3)))) {
        return f.id;
      }
    }
  }

  return null;
}

/* -----------------------------
   Helper: get last user text
------------------------------ */
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

/* -----------------------------
   Helper: extract date from text
   returns "yyyy-mm-dd" or null
------------------------------ */
function extractDate(text: string): string | null {
  const lower = text.toLowerCase();

  // Try chrono first
  const chronoResult = chrono.parseDate(text);
  if (chronoResult) {
    return chronoResult.toISOString().split("T")[0];
  }

  // Fuzzy relative words
  const alphaOnly = lower.replace(/[^a-z]/g, " ");

  const patterns: { keywords: string[]; offset: number }[] = [
    {
      keywords: [
        "tomorrow",
        "tommorow",
        "tommorrow",
        "tomorow",
        "tmr",
        "tmrw",
        "tomo",
      ],
      offset: 1,
    },
    { keywords: ["today", "2day", "tdy"], offset: 0 },
    { keywords: ["yesterday", "yday"], offset: -1 },
  ];

  for (const p of patterns) {
    const found = p.keywords.some((kw) =>
      alphaOnly.split(/\s+/).some((token) => token.includes(kw))
    );
    if (found) {
      const d = new Date();
      d.setDate(d.getDate() + p.offset);
      return d.toISOString().split("T")[0];
    }
  }

  return null;
}

/* -----------------------------
   Helper: facility aware question
------------------------------ */
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

  // look back
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
      return `${text} ${lastUser}`;
    }
  }

  return lastUser;
}

/* -----------------------------
   Helper: last booking intent question
------------------------------ */
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

/* -----------------------------
   System prompt builder
------------------------------ */
function buildSystemPrompt(dynamicContext?: string) {
  const faqText = FACILITY_FAQ.map(
    (item) => `Q: ${item.question}?\nA: ${item.answer}`
  ).join("\n\n");

  const livePart = dynamicContext
    ? `\n\nLive data from the system for this request:\n${dynamicContext}`
    : "";

  return `
You are the AI assistant for the APU Sports Facility Booking PWA.

Use the FAQ below as general guidance, but when live database data is provided you must follow it strictly.

FAQ:
${faqText}
${livePart}

Rules:
1. When live database data is provided, follow it exactly. Do not invent extra facilities, times, or bookings.
2. When listing facilities, only mention the facility names given in the live data. Never invent futsal, multipurpose halls, gyms, swimming pools, badminton halls or outdoor gyms unless they are in the live data.
3. When answering availability questions, use only the times and facilities from the live data.
4. When a booking has been created by the system, clearly confirm the facility name, date, time, and court.
5. Keep answers clear, friendly, and concise, and focus only on APU sports facilities, bookings, rules, and equipment.
6. Do not mention that you were given internal data. Answer naturally.
  `.trim();
}

/* -----------------------------
   Main handler
------------------------------ */
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

    const lastUserText = getLastUserText(uiMessages);

    if (lastUserText) {
      const facilitiesQuestionRegex =
        /\b(facility|facilities)\b[^?]*\b(available|there|exist|can i book|can book|today)\b/i;

      const listFacilitiesRegex = /list( all)? facilities/i;

      const availabilityRegex =
        /\b(available|free|slot|time|when can i book|what time|what about)\b/i;

      const bookingIntentRegex =
        /\b(book|reserve|schedule|help me book|make a booking)\b/i;

      const confirmYesRegex =
        /^(yes|yeah|yep|yup|ok|okay|sure|confirm|go ahead|can|please do it)\b/i;

      const cancelNoRegex =
        /^(no|nah|nope|cancel|do not book|dont book|don't book)\b/i;

      const isFacilitiesQuestion =
        facilitiesQuestionRegex.test(lastUserText) ||
        listFacilitiesRegex.test(lastUserText);

      const hasAvailabilityKeyword = availabilityRegex.test(lastUserText);
      const hasBookingIntent = bookingIntentRegex.test(lastUserText);
      const isConfirm = confirmYesRegex.test(lastUserText);
      const isCancel = cancelNoRegex.test(lastUserText);

      // Load active facilities once, now including id
      const allFacilities = await prisma.facility.findMany({
        where: { active: true },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      });

      const facilityNames = allFacilities.map((f) => f.name);
      const facilityTokens = allFacilities
        .flatMap((f) => [f.name.toLowerCase(), f.type.toLowerCase()])
        .filter(Boolean);

      const today = new Date().toISOString().split("T")[0];

      // 1. Handle explicit confirmation first
      // 1. Handle explicit confirmation first
      if (isConfirm) {
        const bookingQuestionText = getLastBookingIntentQuestion(
          uiMessages,
          bookingIntentRegex
        );

        // also consider the latest user message (like "yes basketball court")
        const confirmText = lastUserText;

        // combine both so the suggestion logic sees all context
        let combinedText = "";
        if (bookingQuestionText) {
          combinedText = bookingQuestionText;
        }
        if (confirmText && confirmText !== bookingQuestionText) {
          combinedText = combinedText
            ? `${combinedText} ${confirmText}`
            : confirmText;
        }

        if (!combinedText) {
          dynamicContext =
            'You said yes, but I do not know which facility and time you want to book. Please say something like: "Book tennis tomorrow at 6pm".';
        } else {
          const requestedDate = extractDate(combinedText) ?? today;

          const suggestion = await getBookingSuggestionFromQuestion({
            questionText: combinedText,
            requestedDate,
          });

          if (!suggestion) {
            dynamicContext = `I could not find any active facility matching your request: "${combinedText}".`;
          } else if (suggestion.reason) {
            dynamicContext = suggestion.reason;
          } else {
            const result = await createBookingFromAI(suggestion);

            if (!result.ok) {
              dynamicContext = result.message;
            } else {
              dynamicContext = `A booking has been created successfully:

- Facility: ${result.facilityName}
- Court: ${result.courtName}
- Date: ${result.date}
- Time: ${result.timeLabel}

You can view this in the My Bookings section of the app.`;
            }
          }
        }
      }

      // 2. Handle cancellation replies
      if (!dynamicContext && isCancel) {
        dynamicContext = "Okay, I will not create any booking.";
      }

      // 3. List facilities questions
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

      // 4. Availability questions
      if (
        !dynamicContext &&
        !isFacilitiesQuestion &&
        hasAvailabilityKeyword &&
        !hasBookingIntent
      ) {
        const requestedDate = extractDate(lastUserText) ?? today;

        const facilityQuestionText = getFacilityAwareQuestionText(
          uiMessages,
          facilityTokens
        );

        if (
          !facilityQuestionText ||
          !facilityTokens.some((t) =>
            facilityQuestionText.toLowerCase().includes(t)
          )
        ) {
          if (facilityNames.length === 0) {
            dynamicContext = `You asked about availability on ${requestedDate}, but there are no active facilities in the database. Ask the sports admin for help.`;
          } else {
            dynamicContext = `You asked about availability on ${requestedDate}, but did not specify a facility.

These are the active facilities in the system:
${facilityNames.join("\n")}

Ask about one facility at a time, for example:
- "What time is Tennis free on ${requestedDate}?"
- "Show me free slots for Basketball Court on ${requestedDate}".`;
          }
        } else {
          // Use fuzzy matcher to get facility id
          const facilityId = findFacilityIdFromQuestion(
            facilityQuestionText,
            allFacilities
          );

          if (!facilityId) {
            dynamicContext = `The system has no active facility that matches "${facilityQuestionText}".`;
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
                    `${court.name}: no free one hour slots on ${date}`
                  );
                } else {
                  lines.push(
                    `${court.name}: free at ${free.join(", ")} on ${date}`
                  );
                }
              }

              dynamicContext = `Availability for "${
                facility.name
              }" on ${date}:\n${lines.join("\n")}`;
            }
          }
        }
      }

      // 5. Booking intent questions (not simple yes or no)
      if (
        !dynamicContext &&
        !isFacilitiesQuestion &&
        hasBookingIntent &&
        !isConfirm &&
        !isCancel
      ) {
        const requestedDate = extractDate(lastUserText) ?? today;

        const facilityQuestionText = getFacilityAwareQuestionText(
          uiMessages,
          facilityTokens
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
            dynamicContext = `You want to make a booking on ${requestedDate}, but you did not specify which facility.

Active facilities:
${facilityNames.join("\n")}

Please say something like:
- "Book Tennis tomorrow at 6pm"
- "Help me book Basketball Court on Friday at 5pm"`;
          }
        } else {
          const suggestion = await getBookingSuggestionFromQuestion({
            questionText: facilityQuestionText,
            requestedDate,
          });

          if (!suggestion) {
            dynamicContext = `I could not find any active facility matching "${facilityQuestionText}".`;
          } else if (suggestion.reason) {
            dynamicContext = suggestion.reason;
          } else if (suggestion.isExactMatch) {
            dynamicContext = `The requested time ${suggestion.requestedTimeLabel} is available for "${suggestion.facilityName}" on ${suggestion.date}.

Ask the user to confirm by saying "yes" if they want to book this:
- Facility: ${suggestion.facilityName}
- Court: ${suggestion.courtName}
- Date: ${suggestion.date}
- Time: ${suggestion.requestedTimeLabel}`;
          } else {
            dynamicContext = `The requested time ${suggestion.requestedTimeLabel} is not free for "${suggestion.facilityName}" on ${suggestion.date}.

Nearest available slot:
- Facility: ${suggestion.facilityName}
- Court: ${suggestion.courtName}
- Date: ${suggestion.date}
- Time: ${suggestion.suggestedTimeLabel}

Ask the user to confirm by saying "yes" if they want to book this suggested time, or ask for another time.`;
          }
        }
      }
    }

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

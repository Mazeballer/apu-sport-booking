// src/lib/ai/book-facility.ts

import * as chrono from "chrono-node";
import { prisma } from "@/lib/prisma";
import { getFacilityAvailabilityById } from "@/lib/ai/get-availability";
import { computeFreeHours } from "@/lib/ai/free-slots";
import { getCurrentUser } from "@/lib/authz";
import {
  findBestMatchingFacility,
  type FacilityForMatch,
} from "@/lib/ai/facility-fuzzy";

export type BookingSuggestion = {
  facilityId: string;
  facilityName: string;
  courtId: string;
  courtName: string;
  date: string; // yyyy-mm-dd
  requestedTimeLabel: string | null; // "18:00" from text
  suggestedTimeLabel: string; // final chosen start time, for example "18:00"
  isExactMatch: boolean;
  durationHours: number; // 1 or 2
  reason?: string;
  chosenEquipmentIds?: string[];
  chosenEquipmentNames?: string[];
};

type SuggestionInput = {
  questionText: string;
  requestedDate: string; // yyyy-mm-dd
};

/**
 * Read a natural language question like:
 *   "Can you book basketball tomorrow at 6pm"
 *   "Book Tennis court 2 at 5pm"
 *
 * Return a concrete suggestion including facility, court, date, time,
 * duration and any equipment names that appear in the text.
 */
export async function getBookingSuggestionFromQuestion(
  input: SuggestionInput
): Promise<BookingSuggestion | null> {
  const { questionText, requestedDate } = input;

  // 1) Load all active facilities for fuzzy match
  const facilities = await prisma.facility.findMany({
    where: { active: true },
    select: { id: true, name: true, type: true },
  });

  if (facilities.length === 0) {
    return {
      facilityId: "",
      facilityName: "",
      courtId: "",
      courtName: "",
      date: requestedDate,
      requestedTimeLabel: null,
      suggestedTimeLabel: "",
      isExactMatch: false,
      durationHours: 1,
      reason:
        "There are no active facilities configured in the system, ask the sports admin to add them first.",
    };
  }

  // 2) Pick the best matching facility from the question text
  const facilityMatch = findBestMatchingFacility(
    questionText,
    facilities as FacilityForMatch[]
  );

  if (!facilityMatch) {
    return {
      facilityId: "",
      facilityName: "",
      courtId: "",
      courtName: "",
      date: requestedDate,
      requestedTimeLabel: null,
      suggestedTimeLabel: "",
      isExactMatch: false,
      durationHours: 1,
      reason:
        'I could not match your question to any active facility, please mention the facility name clearly, for example "Basketball Court" or "Tennis".',
    };
  }

  // 3) Use real facility id to fetch availability
  const data = await getFacilityAvailabilityById(
    facilityMatch.id,
    requestedDate
  );

  if (!data) {
    return {
      facilityId: facilityMatch.id,
      facilityName: facilityMatch.name,
      courtId: "",
      courtName: "",
      date: requestedDate,
      requestedTimeLabel: null,
      suggestedTimeLabel: "",
      isExactMatch: false,
      durationHours: 1,
      reason: `The system has no availability data for "${facilityMatch.name}" on ${requestedDate}.`,
    };
  }

  const { facility, courts, bookings, date } = data;

  if (courts.length === 0) {
    return {
      facilityId: facility.id,
      facilityName: facility.name,
      courtId: "",
      courtName: "",
      date,
      requestedTimeLabel: null,
      suggestedTimeLabel: "",
      isExactMatch: false,
      durationHours: 1,
      reason: `The facility "${facility.name}" does not have any active courts configured.`,
    };
  }

  // 4) Try to respect court preference from the question, fall back to first court
  let court = courts[0];
  const qLower = questionText.toLowerCase();

  if (courts.length > 1) {
    // Exact court name match
    for (const c of courts) {
      if (qLower.includes(c.name.toLowerCase())) {
        court = c;
        break;
      }
    }

    // Pattern "court 2" etc
    const courtNumberMatch = qLower.match(/\bcourt\s*(\d+)\b/);
    if (courtNumberMatch) {
      const wantedNumber = courtNumberMatch[1];
      const byNumber = courts.find((c) =>
        c.name.toLowerCase().includes(wantedNumber)
      );
      if (byNumber) {
        court = byNumber;
      }
    }
  }

  const courtBookings = bookings.filter((b) => b.courtId === court.id);

  const openTime = facility.openTime ?? "08:00";
  const closeTime = facility.closeTime ?? "22:00";

  // Free one hour slots for that court on that date
  const freeSlots = computeFreeHours(
    openTime,
    closeTime,
    date,
    courtBookings,
    new Date()
  );

  if (freeSlots.length === 0) {
    return {
      facilityId: facility.id,
      facilityName: facility.name,
      courtId: court.id,
      courtName: court.name,
      date,
      requestedTimeLabel: null,
      suggestedTimeLabel: "",
      isExactMatch: false,
      durationHours: 1,
      reason: `There are no free one hour slots for "${facility.name}" on ${date}.`,
    };
  }

  // 5) Time and duration
  let requestedTimeLabel: string | null = null;
  let suggestedTimeLabel = freeSlots[0];
  let isExactMatch = false;

  // default duration is 1 hour
  let durationHours = 1;
  const durationLower = questionText.toLowerCase();

  if (/\b(2\s*hours|two\s*hours|2hr|2-hr|2 hour)\b/.test(durationLower)) {
    durationHours = 2;
  } else if (/\b(1\s*hour|one\s*hour|1hr|1-hr|1 hour)\b/.test(durationLower)) {
    durationHours = 1;
  }

  // First, prefer explicit times with am/pm like "8am", "8 pm", "10:30am"
  let hour: number | null = null;

  const timeWithAmPmMatch = questionText.match(
    /\b(?:at\s*)?((?:[01]?\d|2[0-3])(?::([0-5]\d))?)\s*(am|pm)\b/i
  );

  if (timeWithAmPmMatch) {
    const rawHour = parseInt(timeWithAmPmMatch[1].split(":")[0].trim(), 10);
    const minutesPart = timeWithAmPmMatch[2];
    const ampm = timeWithAmPmMatch[3].toLowerCase();

    let h = rawHour;
    const m = minutesPart ? parseInt(minutesPart, 10) : 0;

    if (ampm === "pm" && h < 12) h += 12;
    if (ampm === "am" && h === 12) h = 0;

    hour = h;

    const roundedLabel = `${h.toString().padStart(2, "0")}:00`;
    requestedTimeLabel = roundedLabel;

    if (freeSlots.includes(roundedLabel)) {
      suggestedTimeLabel = roundedLabel;
      isExactMatch = true;
    } else {
      let best = freeSlots[0];
      let bestDiff = Number.POSITIVE_INFINITY;

      for (const slot of freeSlots) {
        const slotHour = parseInt(slot.slice(0, 2), 10);
        const diff = Math.abs(slotHour - h);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = slot;
        }
      }

      suggestedTimeLabel = best;
      isExactMatch = false;
    }
  } else {
    // If no am/pm, try a time after the word "at", like "at 8" or "at 18:00"
    const atTimeMatch = questionText.match(
      /\bat\s+((?:[01]?\d|2[0-3])(?::([0-5]\d))?)\b/i
    );

    if (atTimeMatch) {
      const rawHour = parseInt(atTimeMatch[1].split(":")[0].trim(), 10);
      const minutesPart = atTimeMatch[2];

      let h = rawHour;
      const m = minutesPart ? parseInt(minutesPart, 10) : 0;

      hour = h;

      const roundedLabel = `${h.toString().padStart(2, "0")}:00`;
      requestedTimeLabel = roundedLabel;

      if (freeSlots.includes(roundedLabel)) {
        suggestedTimeLabel = roundedLabel;
        isExactMatch = true;
      } else {
        let best = freeSlots[0];
        let bestDiff = Number.POSITIVE_INFINITY;

        for (const slot of freeSlots) {
          const slotHour = parseInt(slot.slice(0, 2), 10);
          const diff = Math.abs(slotHour - h);
          if (diff < bestDiff) {
            bestDiff = diff;
            best = slot;
          }
        }

        suggestedTimeLabel = best;
        isExactMatch = false;
      }
    } else {
      // Fallback to chrono only if we did not find any explicit time
      const parsedDate = chrono.parseDate(
        questionText,
        new Date(requestedDate + "T12:00")
      );

      if (parsedDate) {
        const h = parsedDate.getHours();
        const label = `${h.toString().padStart(2, "0")}:00`;
        requestedTimeLabel = label;

        if (freeSlots.includes(label)) {
          suggestedTimeLabel = label;
          isExactMatch = true;
        } else {
          let best = freeSlots[0];
          let bestDiff = Number.POSITIVE_INFINITY;

          for (const slot of freeSlots) {
            const slotHour = parseInt(slot.slice(0, 2), 10);
            const diff = Math.abs(slotHour - h);
            if (diff < bestDiff) {
              bestDiff = diff;
              best = slot;
            }
          }

          suggestedTimeLabel = best;
          isExactMatch = false;
        }
      }
    }
  }

  // 6) Figure out which equipment names were mentioned
  const equipmentRows = await prisma.equipment.findMany({
    where: {
      facilityId: facility.id,
      qtyAvailable: { gt: 0 },
    },
  });

  const questionLower = questionText.toLowerCase();
  const chosenEquipmentIds: string[] = [];
  const chosenEquipmentNames: string[] = [];

  for (const eq of equipmentRows) {
    if (questionLower.includes(eq.name.toLowerCase())) {
      chosenEquipmentIds.push(eq.id);
      chosenEquipmentNames.push(eq.name);
    }
  }

  return {
    facilityId: facility.id,
    facilityName: facility.name,
    courtId: court.id,
    courtName: court.name,
    date,
    requestedTimeLabel,
    suggestedTimeLabel,
    isExactMatch,
    durationHours,
    chosenEquipmentIds,
    chosenEquipmentNames,
  };
}

type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      facilityName: string;
      courtName: string;
      date: string;
      timeLabel: string;
      equipmentNames: string[];
    }
  | {
      ok: false;
      message: string;
    };

/**
 * Writes the booking into your database and, if requested,
 * creates an equipmentRequest with items.
 *
 * This mirrors app/(protected)/facility/[id]/book/page.tsx createBooking.
 */
export async function createBookingFromAI(
  suggestion: BookingSuggestion
): Promise<CreateBookingResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      message: "You need to be logged in to make a booking.",
    };
  }

  if (!suggestion.suggestedTimeLabel) {
    return { ok: false, message: "No time slot was selected." };
  }

  if (!suggestion.courtId) {
    return {
      ok: false,
      message: "No valid court found for this facility.",
    };
  }

  const startISO = `${suggestion.date}T${suggestion.suggestedTimeLabel}:00`;
  const start = new Date(startISO);

  const durationHours = suggestion.durationHours ?? 1;
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  const equipmentNamesFromSuggestion = suggestion.chosenEquipmentNames ?? [];

  // 0) Guard against creating the exact same booking twice
  const existing = await prisma.booking.findFirst({
    where: {
      userId: user.id,
      facilityId: suggestion.facilityId,
      courtId: suggestion.courtId,
      start,
      status: { in: ["confirmed", "rescheduled"] },
    },
    select: {
      id: true,
      facility: { select: { name: true } },
      court: { select: { name: true } },
    },
  });

  if (existing) {
    return {
      ok: true,
      bookingId: existing.id,
      facilityName: existing.facility.name,
      courtName: existing.court.name,
      date: suggestion.date,
      timeLabel: suggestion.suggestedTimeLabel,
      equipmentNames: equipmentNamesFromSuggestion,
    };
  }

  // 1) Verify court belongs to facility and is active
  const belongs = await prisma.court.findFirst({
    where: {
      id: suggestion.courtId,
      facilityId: suggestion.facilityId,
      active: true,
    },
    select: { id: true },
  });

  if (!belongs) {
    return {
      ok: false,
      message: "That court is no longer available for booking.",
    };
  }

  // 2) Check for overlap, same as BookingFlow server action
  const clash = await prisma.booking.findFirst({
    where: {
      courtId: suggestion.courtId,
      status: { in: ["confirmed", "rescheduled"] },
      AND: [{ start: { lt: end } }, { end: { gt: start } }],
    },
    select: { id: true },
  });

  if (clash) {
    return {
      ok: false,
      message: "Sorry, that time slot has just been taken by someone else.",
    };
  }

  // 3) Create booking
  const booking = await prisma.booking.create({
    data: {
      userId: user.id,
      facilityId: suggestion.facilityId,
      courtId: suggestion.courtId,
      start,
      end,
      status: "confirmed",
    },
  });

  // 4) Optional equipment request, same shape as page.tsx createBooking
  if (
    suggestion.chosenEquipmentIds &&
    suggestion.chosenEquipmentIds.length > 0
  ) {
    await prisma.equipmentRequest.create({
      data: {
        bookingId: booking.id,
        status: "pending",
        note: null,
        items: {
          create: suggestion.chosenEquipmentIds.map((equipmentId) => ({
            equipmentId,
            qty: 1,
          })),
        },
      },
    });
  }

  return {
    ok: true,
    bookingId: booking.id,
    facilityName: suggestion.facilityName,
    courtName: suggestion.courtName,
    date: suggestion.date,
    timeLabel: suggestion.suggestedTimeLabel,
    equipmentNames: equipmentNamesFromSuggestion,
  };
}

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
  date: string;
  requestedTimeLabel: string | null;
  suggestedTimeLabel: string;
  isExactMatch: boolean;
  reason?: string;
};

type SuggestionInput = {
  questionText: string;
  requestedDate: string; // yyyy-mm-dd
};

/**
 * Read a natural language question like:
 *  - "Can you book basketball tomorrow at 6pm"
 *  - "Book tennis at 5pm on 25 November"
 *
 * and turn it into a structured suggestion:
 *  - which facility
 *  - which court
 *  - which date
 *  - which one hour slot (nearest to requested time)
 */
export async function getBookingSuggestionFromQuestion(
  input: SuggestionInput
): Promise<BookingSuggestion | null> {
  const { questionText, requestedDate } = input;

  // 1) load all active facilities for fuzzy match
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
      reason:
        "There are no active facilities configured in the system, ask the sports admin to add them first.",
    };
  }

  // 2) pick the best matching facility from the question text
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
      reason:
        'I could not match your question to any active facility, please mention the facility name clearly, for example "Basketball Court" or "Tennis".',
    };
  }

  // 3) now use the real facility id to fetch availability
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
      reason: `The facility "${facility.name}" does not have any active courts configured.`,
    };
  }

  // For now, pick the first court
  const court = courts[0];
  const courtBookings = bookings.filter((b) => b.courtId === court.id);

  const openTime = facility.openTime ?? "08:00";
  const closeTime = facility.closeTime ?? "22:00";

  // Compute free one hour slots for that court on that date
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
      reason: `There are no free one hour slots for "${facility.name}" on ${date}.`,
    };
  }

  // Try to parse requested time from the question
  let requestedTimeLabel: string | null = null;
  let suggestedTimeLabel = freeSlots[0];
  let isExactMatch = false;

  const parsedDate = chrono.parseDate(
    questionText,
    new Date(requestedDate + "T12:00")
  );

  if (parsedDate) {
    const hour = parsedDate.getHours();
    const label = `${hour.toString().padStart(2, "0")}:00`;
    requestedTimeLabel = label;

    if (freeSlots.includes(label)) {
      // Requested time is free
      suggestedTimeLabel = label;
      isExactMatch = true;
    } else {
      // Find nearest free slot by hour difference
      let best = freeSlots[0];
      let bestDiff = Number.POSITIVE_INFINITY;

      for (const slot of freeSlots) {
        const slotHour = parseInt(slot.slice(0, 2), 10);
        const diff = Math.abs(slotHour - hour);
        if (diff < bestDiff) {
          bestDiff = diff;
          best = slot;
        }
      }

      suggestedTimeLabel = best;
      isExactMatch = false;
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
    }
  | {
      ok: false;
      message: string;
    };

/**
 * Actually writes the booking into your database using the suggestion.
 * Mirrors the logic from your BookingFlow createBooking action.
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
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  // 1) verify court belongs to facility and is active
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

  // 2) check for overlap
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

  // 3) create booking
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

  return {
    ok: true,
    bookingId: booking.id,
    facilityName: suggestion.facilityName,
    courtName: suggestion.courtName,
    date: suggestion.date,
    timeLabel: suggestion.suggestedTimeLabel,
  };
}

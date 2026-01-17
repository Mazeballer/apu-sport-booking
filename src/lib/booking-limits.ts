import { prisma } from "@/lib/prisma";

export class BookingLimitError extends Error {
  code = "BOOKING_LIMIT_REACHED";
}

// RULES
const MAX_PER_DAY = 2;
const MAX_PER_WEEK = 7;

/**
 * Get Malaysia date components from a Date object.
 * Uses Intl.DateTimeFormat which is reliable in all environments.
 */
function getMalaysiaDateParts(d: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // Returns YYYY-MM-DD format
  const parts = formatter.formatToParts(d);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  return { year, month, day };
}

/**
 * Get the day of week (0 = Sunday, 1 = Monday, etc.) in Malaysia timezone.
 */
function getMalaysiaDayOfWeek(d: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
  });
  const weekdayStr = formatter.format(d);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[weekdayStr] ?? 0;
}

/**
 * Create a Date object for start of Malaysia day (00:00:00.000 MYT).
 * Returns a Date in UTC that represents midnight Malaysia time.
 */
function startOfMalaysiaDay(d: Date): Date {
  const { year, month, day } = getMalaysiaDateParts(d);
  // Create date string in Malaysia timezone format, then parse as Malaysia time
  // Malaysia is UTC+8, so midnight MYT = 16:00 UTC previous day
  const utcDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  // Subtract 8 hours to convert MYT to UTC
  utcDate.setUTCHours(utcDate.getUTCHours() - 8);
  return utcDate;
}

/**
 * Create a Date object for end of Malaysia day (23:59:59.999 MYT).
 */
function endOfMalaysiaDay(d: Date): Date {
  const { year, month, day } = getMalaysiaDateParts(d);
  // 23:59:59.999 MYT = 15:59:59.999 UTC
  const utcDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
  utcDate.setUTCHours(utcDate.getUTCHours() - 8);
  return utcDate;
}

/**
 * Create a Date object for start of Malaysia week (Monday 00:00:00.000 MYT).
 */
function startOfMalaysiaWeek(d: Date): Date {
  const { year, month, day } = getMalaysiaDateParts(d);
  const dayOfWeek = getMalaysiaDayOfWeek(d);
  // Calculate days to subtract to get to Monday
  // Sunday = 0, so we go back 6 days. Monday = 1, so we go back 0 days, etc.
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const mondayDate = new Date(Date.UTC(year, month - 1, day + diff, 0, 0, 0, 0));
  mondayDate.setUTCHours(mondayDate.getUTCHours() - 8);
  return mondayDate;
}

/**
 * Create a Date object for end of Malaysia week (Sunday 23:59:59.999 MYT).
 */
function endOfMalaysiaWeek(d: Date): Date {
  const start = startOfMalaysiaWeek(d);
  // Add 6 days to get to Sunday, then set to end of day
  const sundayDate = new Date(start.getTime());
  sundayDate.setUTCDate(sundayDate.getUTCDate() + 6);
  sundayDate.setUTCHours(23 - 8, 59, 59, 999); // 23:59:59.999 MYT = 15:59:59.999 UTC
  return sundayDate;
}

export type BookingLimitResult = 
  | { ok: true }
  | { ok: false; message: string };

/**
 * Check if a user has reached their booking limits.
 * Returns a result object instead of throwing to prevent SSR errors.
 */
export async function checkBookingLimit(args: {
  userId: string;
  start: Date;
}): Promise<BookingLimitResult> {
  try {
    const { userId, start } = args;

    const dayStart = startOfMalaysiaDay(start);
    const dayEnd = endOfMalaysiaDay(start);

    const weekStart = startOfMalaysiaWeek(start);
    const weekEnd = endOfMalaysiaWeek(start);

    // Per-day limit
    const dayCount = await prisma.booking.count({
      where: {
        userId,
        status: { in: ["confirmed", "rescheduled"] },
        start: { gte: dayStart, lte: dayEnd },
      },
    });

    if (dayCount >= MAX_PER_DAY) {
      return {
        ok: false,
        message: "You have reached the maximum of 2 bookings for this day.",
      };
    }

    // Per-week limit
    const weekCount = await prisma.booking.count({
      where: {
        userId,
        status: { in: ["confirmed", "rescheduled"] },
        start: { gte: weekStart, lte: weekEnd },
      },
    });

    if (weekCount >= MAX_PER_WEEK) {
      return {
        ok: false,
        message: "You have reached the maximum of 7 active bookings for this week.",
      };
    }

    return { ok: true };
  } catch (error) {
    console.error("[checkBookingLimit] Error:", error);
    return {
      ok: false,
      message: "Unable to verify booking limits. Please try again.",
    };
  }
}

/**
 * @deprecated Use checkBookingLimit instead for better error handling.
 * Kept for backward compatibility with page.tsx.
 */
export async function assertBookingLimit(args: {
  userId: string;
  start: Date;
}) {
  const result = await checkBookingLimit(args);
  if (!result.ok) {
    throw new BookingLimitError(result.message);
  }
}

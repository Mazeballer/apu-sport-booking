import { prisma } from "@/lib/prisma";

export class BookingLimitError extends Error {
  code = "BOOKING_LIMIT_REACHED";
}

// RULES
const MAX_PER_DAY = 2;
const MAX_PER_WEEK = 7;
const MY_TZ = "Asia/Kuala_Lumpur";

function startOfMalaysiaDay(d: Date) {
  const my = new Date(d.toLocaleString("en-US", { timeZone: MY_TZ }));
  my.setHours(0, 0, 0, 0);
  return my;
}

function endOfMalaysiaDay(d: Date) {
  const my = startOfMalaysiaDay(d);
  my.setHours(23, 59, 59, 999);
  return my;
}

function startOfMalaysiaWeek(d: Date) {
  const my = new Date(d.toLocaleString("en-US", { timeZone: MY_TZ }));
  const day = my.getDay(); // Sunday = 0
  const diff = day === 0 ? -6 : 1 - day; // week starts Monday
  my.setDate(my.getDate() + diff);
  my.setHours(0, 0, 0, 0);
  return my;
}

function endOfMalaysiaWeek(d: Date) {
  const start = startOfMalaysiaWeek(d);
  start.setDate(start.getDate() + 6);
  start.setHours(23, 59, 59, 999);
  return start;
}

export async function assertBookingLimit(args: {
  userId: string;
  start: Date;
}) {
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
    throw new BookingLimitError(
      "You have reached the maximum of 2 bookings for this day."
    );
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
    throw new BookingLimitError(
      "You have reached the maximum of 7 active bookings for this week."
    );
  }
}

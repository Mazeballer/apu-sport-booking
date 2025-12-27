// src/lib/ai/free-slots.ts
import { format, eachHourOfInterval } from "date-fns";

function toMY(date: string, timeHHmm: string): Date {
  // Force Malaysia time to avoid server timezone issues
  return new Date(`${date}T${timeHHmm}:00+08:00`);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  // overlap if aStart < bEnd AND aEnd > bStart
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export function computeFreeHours(
  openTime: string,
  closeTime: string,
  date: string,
  courtBookings: { start: Date; end: Date }[],
  now: Date = new Date(),
  durationHours: number = 1
) {
  const start = toMY(date, openTime);
  const end = toMY(date, closeTime);

  // Candidate start times (hourly)
  const hours = eachHourOfInterval({ start, end }).filter(
    (slot) => slot.getTime() < end.getTime()
  );

  const todayString = format(now, "yyyy-MM-dd");
  const isToday = date === todayString;

  return hours
    .filter((slotStart) => {
      // Today: only allow slots that start after "now"
      if (isToday && slotStart.getTime() <= now.getTime()) return false;

      const slotEnd = new Date(
        slotStart.getTime() + durationHours * 60 * 60 * 1000
      );

      // Must fit fully within operating hours
      if (slotEnd.getTime() > end.getTime()) return false;

      // Must not overlap any booking (regardless of duration)
      for (const b of courtBookings) {
        if (overlaps(slotStart, slotEnd, b.start, b.end)) return false;
      }

      return true;
    })
    .map((slotStart) => format(slotStart, "HH:mm"));
}

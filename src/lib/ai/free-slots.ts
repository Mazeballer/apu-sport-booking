// src/lib/ai/free-slots.ts
import { format, eachHourOfInterval } from "date-fns";

export function computeFreeHours(
  openTime: string,
  closeTime: string,
  date: string,
  courtBookings: { start: Date; end: Date }[],
  now: Date = new Date()
) {
  const start = new Date(`${date}T${openTime}`);
  const end = new Date(`${date}T${closeTime}`);

  // Build all hour ticks, then drop the one at the closing time
  const hours = eachHourOfInterval({ start, end }).filter(
    (slot) => slot.getTime() < end.getTime()
  );

  const booked = new Set(courtBookings.map((b) => b.start.getHours()));

  const todayString = format(now, "yyyy-MM-dd");
  const isToday = date === todayString;

  return hours
    .filter((slot) => {
      if (!isToday) return true;
      // For today, only allow slots that start strictly after "now"
      return slot.getTime() > now.getTime();
    })
    .map((slot) => {
      const label = format(slot, "HH:mm");
      return { slot, label };
    })
    .filter(({ slot }) => !booked.has(slot.getHours()))
    .map(({ label }) => label);
}

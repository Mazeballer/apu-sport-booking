// src/lib/ai/get-availability.ts
import { prisma } from "@/lib/prisma";

export async function getFacilityAvailabilityById(
  facilityId: string,
  date: string // yyyy-mm-dd
) {
  // 1) Load the main facility
  const row = await prisma.facility.findFirst({
    where: { id: facilityId, active: true },
    include: {
      courts: {
        where: { active: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!row) return null;

  // 2) Find facilities that share availability with this one
  const orConditions: any[] = [{ id: row.id }];

  // facilities whose sharedSports contains this facility type
  orConditions.push({ sharedSports: { has: row.type } });

  // facilities whose type is in this facility sharedSports
  if (row.sharedSports.length > 0) {
    orConditions.push({
      type: { in: row.sharedSports },
    });
  }

  const relatedFacilities = await prisma.facility.findMany({
    where: {
      OR: orConditions,
      active: true,
    },
    select: { id: true },
  });

  const sharedFacilityIds = relatedFacilities.map((f) => f.id);

  // 3) Load all courts from shared facilities
  const allCourts = await prisma.court.findMany({
    where: {
      facilityId: { in: sharedFacilityIds },
      active: true,
    },
    orderBy: { name: "asc" },
  });

  const currentFacilityCourts = allCourts.filter(
    (c) => c.facilityId === row.id
  );

  // Map shared courts to this facility's courts by name
  const sharedCourtIdToCurrentCourtId: Record<string, string> = {};

  currentFacilityCourts.forEach((currentCourt) => {
    const sameNameCourts = allCourts.filter(
      (c) => c.name === currentCourt.name
    );
    sameNameCourts.forEach((c) => {
      sharedCourtIdToCurrentCourtId[c.id] = currentCourt.id;
    });
  });

  // 4) Fetch bookings for the requested date
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(`${date}T23:59:59`);

  const bookings = await prisma.booking.findMany({
    where: {
      facilityId: { in: sharedFacilityIds },
      status: { in: ["confirmed", "rescheduled"] },
      start: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
    orderBy: { start: "asc" },
  });

  // Remap bookings to the main facility courts
  const existingBookings = bookings.map((b) => ({
    courtId: sharedCourtIdToCurrentCourtId[b.courtId] ?? b.courtId,
    start: b.start,
    end: b.end,
  }));

  return {
    facility: row,
    courts: currentFacilityCourts,
    bookings: existingBookings,
    date,
  };
}

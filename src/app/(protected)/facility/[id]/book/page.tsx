// app/(protected)/facility/[id]/book/page.tsx
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { BookingFlow } from "@/components/booking-flow";
import { getCurrentUser } from "@/lib/authz";
import { assertBookingLimit } from "@/lib/booking-limits";

export const revalidate = 0;

const MY_TZ = "Asia/Kuala_Lumpur";

function malaysiaDateTimeToUtcDate(dateYYYYMMDD: string, timeHHmm: string) {
  const [y, m, d] = dateYYYYMMDD.split("-").map(Number);
  const [hh, mm] = timeHHmm.split(":").map(Number);

  // Create a Date that represents the Malaysia wall clock time,
  // using Intl to compute the equivalent UTC instant.
  const approxUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0, 0));

  // Figure out the timezone offset between MY and UTC at that instant
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: MY_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(approxUtc)
    .reduce<Record<string, string>>((acc, p) => {
      if (p.type !== "literal") acc[p.type] = p.value;
      return acc;
    }, {});

  const myAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  // Adjust so that “MY wall time” maps to the correct UTC instant
  const diffMs = myAsUtc - approxUtc.getTime();
  return new Date(approxUtc.getTime() - diffMs);
}

function addHoursUtc(d: Date, hours: number) {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

export default async function BookFacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Base facility
  const row = await prisma.facility.findUnique({
    where: { id },
    include: {
      courts: { where: { active: true }, orderBy: { name: "asc" } },
      equipment: true,
    },
  });

  if (!row) notFound();

  // 1) Find all facilities that share availability with this one
  // - this facility itself
  // - facilities whose sharedSports contains this facility type
  // - facilities whose type is in this facility sharedSports
  const orConditions: any[] = [{ id: row.id }];

  orConditions.push({
    sharedSports: { has: row.type },
  });

  if (row.sharedSports.length > 0) {
    orConditions.push({
      type: { in: row.sharedSports },
    });
  }

  const relatedFacilities = await prisma.facility.findMany({
    where: {
      OR: orConditions,
    },
    select: { id: true },
  });

  const sharedFacilityIds = relatedFacilities.map((f) => f.id);

  // 2) Load courts for all related facilities
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

  // Build a mapping from any shared court id to this facility's court id
  // Match by name and assume shared facilities have same court naming
  const sharedCourtIdToCurrentCourtId: Record<string, string> = {};

  currentFacilityCourts.forEach((currentCourt) => {
    const sameNameCourts = allCourts.filter(
      (c) => c.name === currentCourt.name
    );

    sameNameCourts.forEach((c) => {
      sharedCourtIdToCurrentCourtId[c.id] = currentCourt.id;
    });
  });

  // 3) Fetch bookings for all shared facilities
  const bookings = await prisma.booking.findMany({
    where: {
      facilityId: { in: sharedFacilityIds },
      status: { in: ["confirmed", "rescheduled"] },
    },
    orderBy: { start: "asc" },
  });

  // 4) Remap bookings so that courts from other facilities
  // map to this facility's court ids, by name
  const existingBookings = bookings.map((b) => ({
    id: b.id,
    facilityId: b.facilityId,
    courtId: sharedCourtIdToCurrentCourtId[b.courtId] ?? b.courtId,
    start: b.start,
    end: b.end,
    status: b.status,
  }));

  const facility = {
    id: row.id,
    name: row.name,
    type: row.type,
    location: row.location,
    locationType: row.locationType,
    description: row.description,
    capacity: row.capacity,
    photos: row.photos ?? [],
    openTime: row.openTime,
    closeTime: row.closeTime,
    rules: row.rules,
    courts: row.courts.map((c) => ({
      id: c.id,
      name: c.name,
    })),
  };

  const equipment = row.equipment.map((e) => ({
    id: e.id,
    name: e.name,
    qtyAvailable: e.qtyAvailable,
    qtyTotal: e.qtyTotal,
  }));

  // server action that matches BookingFlow onCreateBooking
  async function createBooking(payload: {
    facilityId: string;
    courtId: string;
    date: string; // "YYYY-MM-DD" in Malaysia date
    time: string; // "HH:mm"
    durationHours: 1 | 2;
    equipmentIds: string[];
    notes?: string;
  }) {
    "use server";

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    // build dates in Malaysia timezone (then store as UTC Date)
    const start = malaysiaDateTimeToUtcDate(payload.date, payload.time);
    const end = addHoursUtc(start, payload.durationHours);

    await assertBookingLimit({
      userId: user.id,
      start,
    });

    // 1) verify court belongs to this facility and is active
    const belongs = await prisma.court.findFirst({
      where: {
        id: payload.courtId,
        facilityId: payload.facilityId,
        active: true,
      },
      select: { id: true },
    });
    if (!belongs) throw new Error("Invalid court");

    // 2) check for overlap on that court
    const clash = await prisma.booking.findFirst({
      where: {
        courtId: payload.courtId,
        status: { in: ["confirmed", "rescheduled"] },
        AND: [{ start: { lt: end } }, { end: { gt: start } }],
      },
      select: { id: true },
    });
    if (clash) throw new Error("This court is already booked for that time");

    // 3) create booking
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        facilityId: payload.facilityId,
        courtId: payload.courtId,
        start,
        end,
        status: "confirmed",
      },
    });

    // 4) optional equipment request
    if (payload.equipmentIds.length > 0) {
      await prisma.equipmentRequest.create({
        data: {
          bookingId: booking.id,
          status: "pending",
          note: payload.notes,
          items: {
            create: payload.equipmentIds.map((eid) => ({
              equipmentId: eid,
              qty: 1,
            })),
          },
        },
      });
    }

    revalidatePath(`/facility/${payload.facilityId}/book`);
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <BookingFlow
            facility={facility}
            equipment={equipment}
            existingBookings={existingBookings}
            onCreateBooking={createBooking}
          />
        </main>
      </div>
    </AuthGuard>
  );
}

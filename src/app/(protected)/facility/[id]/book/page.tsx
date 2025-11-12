// app/facilities/[id]/book/page.tsx
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { AuthGuard } from "@/components/auth-guard";
import { BookingFlow } from "@/components/booking-flow";
import { getCurrentUser } from "@/lib/authz";

export const revalidate = 0;

export default async function BookFacilityPage({
  params,
}: {
  params: { id: string };
}) {
  const row = await prisma.facility.findUnique({
    where: { id: params.id },
    include: {
      courts: { where: { active: true }, orderBy: { name: "asc" } },
      equipment: true,
      bookings: { where: { facilityId: params.id }, orderBy: { start: "asc" } },
    },
  });
  if (!row) notFound();

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
    courts: row.courts.map((c) => ({ id: c.id, name: c.name })),
  };

  const equipment = row.equipment.map((e) => ({
    id: e.id,
    name: e.name,
    qtyAvailable: e.qtyAvailable,
    qtyTotal: e.qtyTotal,
  }));

  const existingBookings = row.bookings.map((b) => ({
    id: b.id,
    facilityId: b.facilityId,
    courtId: b.courtId,
    start: b.start,
    end: b.end,
    status: b.status,
  }));

  async function createBooking(payload: {
    facilityId: string;
    courtId: string;
    startISO: string;
    endISO: string;
    equipmentIds: string[];
    notes?: string;
  }) {
    "use server";
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const start = new Date(payload.startISO);
    const end = new Date(payload.endISO);

    // verify the court belongs to the facility and is free
    const belongs = await prisma.court.findFirst({
      where: {
        id: payload.courtId,
        facilityId: payload.facilityId,
        active: true,
      },
      select: { id: true },
    });
    if (!belongs) throw new Error("Invalid court");

    const clash = await prisma.booking.findFirst({
      where: {
        courtId: payload.courtId,
        status: { in: ["confirmed", "rescheduled"] },
        AND: [{ start: { lt: end } }, { end: { gt: start } }],
      },
      select: { id: true },
    });
    if (clash) throw new Error("This court is already booked for that time");

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

    if (payload.equipmentIds.length > 0) {
      await prisma.equipmentRequest.create({
        data: {
          bookingId: booking.id,
          status: "pending",
          items: {
            create: payload.equipmentIds.map((eid) => ({
              equipmentId: eid,
              qty: 1,
            })),
          },
        },
      });
    }

    revalidatePath(`/facilities/${payload.facilityId}/book`);
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

// app/bookings/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authz";
import { BookingsClient } from "@/components/bookings-client";
import { revalidatePath } from "next/cache";
import { BookingStatus } from "@prisma/client";

export const revalidate = 0;

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const dbBookings = await prisma.booking.findMany({
    where: {
      userId: user.id,
      status: { in: ["confirmed", "rescheduled", "cancelled"] },
    },
    orderBy: { start: "asc" },
    include: {
      facility: true,
      equipmentRequests: {
        include: {
          items: {
            include: {
              equipment: true,
            },
          },
        },
      },
    },
  });

  type BookingForUI = {
    id: string;
    facilityId: string;
    facilityName: string;
    facilityLocation: string;
    facilityOpenTime: string | null;
    facilityCloseTime: string | null;
    start: string;
    end: string;
    durationHours: number;
    status: BookingStatus;
    equipmentNames: string[];
  };

  const bookings: BookingForUI[] = dbBookings.map((b) => ({
    id: b.id,
    facilityId: b.facilityId,
    facilityName: b.facility.name,
    facilityLocation: b.facility.location,
    facilityOpenTime: b.facility.openTime ?? null,
    facilityCloseTime: b.facility.closeTime ?? null,
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    durationHours: (b.end.getTime() - b.start.getTime()) / (1000 * 60 * 60),
    status: b.status,
    equipmentNames: b.equipmentRequests.flatMap((req) =>
      req.items.map((item) => item.equipment.name)
    ),
  }));

  // SERVER ACTION: reschedule booking
  async function rescheduleBookingAction(payload: {
    bookingId: string;
    newStartISO: string;
  }) {
    "use server";

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        facility: true,
        court: true,
      },
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== user.id) throw new Error("Forbidden");

    const now = new Date();
    const minutesUntilBooking =
      (booking.start.getTime() - now.getTime()) / (1000 * 60);

    if (minutesUntilBooking <= 30) {
      throw new Error(
        "Rescheduling is not allowed within 30 minutes of start time"
      );
    }

    const newStart = new Date(payload.newStartISO);
    const durationMs = booking.end.getTime() - booking.start.getTime();
    const newEnd = new Date(newStart.getTime() + durationMs);

    const facility = booking.facility;

    const orConditions: any[] = [{ id: facility.id }];

    orConditions.push({
      sharedSports: { has: facility.type },
    });

    if (facility.sharedSports.length > 0) {
      orConditions.push({
        type: { in: facility.sharedSports },
      });
    }

    const relatedFacilities = await prisma.facility.findMany({
      where: {
        OR: orConditions,
      },
      select: { id: true },
    });

    const sharedFacilityIds = relatedFacilities.map((f) => f.id);

    const relatedCourts = await prisma.court.findMany({
      where: {
        facilityId: { in: sharedFacilityIds },
        name: booking.court.name,
        active: true,
      },
      select: { id: true },
    });

    const relatedCourtIds = relatedCourts.map((c) => c.id);

    const clash = await prisma.booking.findFirst({
      where: {
        id: { not: booking.id },
        courtId: { in: relatedCourtIds },
        status: { in: ["confirmed", "rescheduled"] },
        AND: [{ start: { lt: newEnd } }, { end: { gt: newStart } }],
      },
      select: { id: true },
    });

    if (clash) {
      throw new Error("Time slot is already taken");
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        start: newStart,
        end: newEnd,
        status: "rescheduled",
        reminderEmailSentAt: null,
      },
    });

    revalidatePath("/bookings");
  }

  // SERVER ACTION: load existing bookings for reschedule dialog
  async function loadExistingBookingsForReschedule(payload: {
    bookingId: string;
  }) {
    "use server";

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: {
        facility: true,
        court: true,
      },
    });

    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== user.id) throw new Error("Forbidden");

    const facility = booking.facility;

    const orConditions: any[] = [{ id: facility.id }];

    orConditions.push({
      sharedSports: { has: facility.type },
    });

    if (facility.sharedSports.length > 0) {
      orConditions.push({
        type: { in: facility.sharedSports },
      });
    }

    const relatedFacilities = await prisma.facility.findMany({
      where: {
        OR: orConditions,
      },
      select: { id: true },
    });

    const sharedFacilityIds = relatedFacilities.map((f) => f.id);

    const relatedCourts = await prisma.court.findMany({
      where: {
        facilityId: { in: sharedFacilityIds },
        name: booking.court.name,
        active: true,
      },
      select: { id: true },
    });

    const relatedCourtIds = relatedCourts.map((c) => c.id);

    const existing = await prisma.booking.findMany({
      where: {
        courtId: { in: relatedCourtIds },
        status: { in: ["confirmed", "rescheduled"] },
        id: { not: booking.id },
      },
      select: {
        id: true,
        start: true,
        end: true,
        status: true,
      },
      orderBy: { start: "asc" },
    });

    return existing.map((b) => ({
      id: b.id,
      startISO: b.start.toISOString(),
      endISO: b.end.toISOString(),
      status: b.status,
    }));
  }

  // SERVER ACTION: cancel booking
  async function cancelBookingAction(payload: { bookingId: string }) {
    "use server";

    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
    });
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== user.id) throw new Error("Forbidden");

    const now = new Date();
    const minutesUntilBooking =
      (booking.start.getTime() - now.getTime()) / (1000 * 60);

    if (minutesUntilBooking <= 30) {
      throw new Error(
        "Cancellations are not allowed within 30 minutes of start time"
      );
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "cancelled" },
    });

    await prisma.equipmentRequest.updateMany({
      where: {
        bookingId: booking.id,
        status: { in: ["pending", "approved"] },
      },
      data: {
        status: "done",
      },
    });

    revalidatePath("/bookings");
  }

  return (
    <BookingsClient
      bookings={bookings}
      onReschedule={rescheduleBookingAction}
      onCancel={cancelBookingAction}
      loadExistingBookings={loadExistingBookingsForReschedule}
    />
  );
}

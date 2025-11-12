// app/api/bookings/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authz";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const { facilityId, startISO, endISO, durationHours, equipmentIds } = body;
    const user = await getCurrentUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const facilityRow = await prisma.facility.findUnique({
      where: { id: facilityId },
      include: { courts: { where: { active: true } } },
    });
    if (!facilityRow)
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );

    const start = new Date(startISO);
    const end = new Date(endISO);

    // find a free court
    const courtIds = facilityRow.courts.map((c) => c.id);
    const overlapping = await prisma.booking.findMany({
      where: {
        courtId: { in: courtIds },
        AND: [{ start: { lt: end } }, { end: { gt: start } }],
        status: { in: ["confirmed", "rescheduled"] },
      },
      select: { courtId: true },
    });

    const busy = new Set(overlapping.map((b) => b.courtId));
    const freeCourt = facilityRow.courts.find((c) => !busy.has(c.id));
    if (!freeCourt)
      return NextResponse.json(
        { error: "No court available" },
        { status: 409 }
      );

    // create booking
    const booking = await prisma.booking.create({
      data: {
        userId: user.id,
        facilityId,
        courtId: freeCourt.id,
        start,
        end,
        status: "confirmed",
      },
    });

    if (equipmentIds?.length) {
      await prisma.equipmentRequest.create({
        data: {
          bookingId: booking.id,
          status: "pending",
          items: {
            create: equipmentIds.map((eid: string) => ({
              equipmentId: eid,
              qty: 1,
            })),
          },
        },
      });
    }

    return NextResponse.json({ success: true, bookingId: booking.id });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

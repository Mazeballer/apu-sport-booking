// app/(protected)/equipment-request/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/authz";
import { EquipmentRequestsClient } from "@/components/view-equipment-status";
import type { EquipReqStatus } from "@prisma/client";

export const revalidate = 0;

export type EquipmentRequestForUI = {
  id: string;
  facilityName: string;
  bookingDateISO: string; // booking.start
  createdAtISO: string; // request.createdAt
  status: EquipReqStatus;
  notes: string | null;
  equipmentNames: string[];
};

export default async function EquipmentRequestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const MAX_REQUESTS = 30;

  const dbRequests = await prisma.equipmentRequest.findMany({
    where: {
      // only requests for this user
      booking: {
        userId: user.id,
        // and only for bookings that are still active
        status: { in: ["confirmed", "rescheduled"] },
      },
      // and only requests that still need action
      status: { in: ["pending", "approved", "denied", "done"] },
    },
    include: {
      booking: {
        include: {
          facility: true,
        },
      },
      items: {
        include: {
          equipment: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: MAX_REQUESTS,
  });

  const requests: EquipmentRequestForUI[] = dbRequests.map((req) => ({
    id: req.id,
    facilityName: req.booking.facility.name,
    bookingDateISO: req.booking.start.toISOString(),
    createdAtISO: req.createdAt.toISOString(),
    status: req.status,
    notes: req.note ?? null,
    equipmentNames: req.items.map((item) => item.equipment.name),
  }));

  return <EquipmentRequestsClient requests={requests} />;
}

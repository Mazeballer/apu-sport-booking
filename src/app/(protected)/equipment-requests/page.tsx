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

  // Fetch all equipment requests for bookings made by this user
  const dbRequests = await prisma.equipmentRequest.findMany({
    where: {
      booking: {
        userId: user.id,
      },
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

"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin, getCurrentUser } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function approveEquipmentRequest(id: string) {
  // Security layer, guaranteed server only
  await requireStaffOrAdmin();

  // Identify which staff/admin clicked approve
  const current = await getCurrentUser();
  if (!current) throw new Error("Unauthorized");

  await prisma.equipmentRequest.update({
    where: { id },
    data: {
      status: "approved",
      decidedAt: new Date(),
      decidedBy: current.id, // ← important
    },
  });
  revalidatePath("/staff");
}

export async function denyEquipmentRequest(id: string) {
  await requireStaffOrAdmin();

  const current = await getCurrentUser();
  if (!current) throw new Error("Unauthorized");

  await prisma.equipmentRequest.update({
    where: { id },
    data: {
      status: "denied",
      decidedAt: new Date(),
      decidedBy: current.id, // ← important
    },
  });
  revalidatePath("/staff");
}

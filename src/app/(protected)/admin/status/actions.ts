"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";

export async function dismissEquipmentStatusItem(itemId: string) {
  await requireStaffOrAdmin();

  await prisma.equipmentRequestItem.update({
    where: { id: itemId },
    data: {
      dismissed: true,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/staff");
}

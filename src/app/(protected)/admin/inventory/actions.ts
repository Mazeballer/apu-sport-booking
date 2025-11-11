"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import {
  upsertEquipmentSchema,
  deleteSchema,
} from "@/lib/validators/equipment";

export type ActionResult = { ok: boolean; message?: string };

export async function upsertEquipment(
  _prev: unknown,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = upsertEquipmentSchema.safeParse({
    id: fd.get("id")?.toString(),
    name: fd.get("name")?.toString(),
    facilityId: fd.get("facilityId")?.toString(),
    qtyTotal: fd.get("qtyTotal"),
    qtyAvailable: fd.get("qtyAvailable"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { id, name, facilityId, qtyTotal, qtyAvailable } = parsed.data;
  if (qtyAvailable > qtyTotal) {
    return {
      ok: false,
      message: "Available quantity cannot exceed total quantity",
    };
  }

  try {
    if (!id) {
      await prisma.$transaction(async (tx) => {
        const exists = await tx.equipment.findFirst({
          where: { facilityId, name },
          select: { id: true },
        });
        if (exists)
          throw new Error(
            "An item with this name already exists in this facility."
          );
        await tx.equipment.create({
          data: { name, facilityId, qtyTotal, qtyAvailable },
        });
      });
    } else {
      await prisma.equipment.update({
        where: { id },
        data: { name, facilityId, qtyTotal, qtyAvailable },
      });
    }
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to save equipment" };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

export async function deleteEquipmentAction(
  _prev: unknown,
  fd: FormData
): Promise<ActionResult> {
  await requireAdmin();

  const parsed = deleteSchema.safeParse({ id: fd.get("id")?.toString() });
  if (!parsed.success) return { ok: false, message: "Invalid equipment id" };

  try {
    await prisma.$transaction(async (tx) => {
      const used = await tx.equipmentRequestItem.count({
        where: { equipmentId: parsed.data.id },
      });
      if (used > 0)
        throw new Error("Cannot delete: equipment is referenced by requests.");
      await tx.equipment.delete({ where: { id: parsed.data.id } });
    });
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to delete equipment" };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  return { ok: true };
}

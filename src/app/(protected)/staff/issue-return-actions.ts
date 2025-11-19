"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { EquipReturnCondition, EquipReqStatus } from "@prisma/client";

// Staff issues items that were previously approved
export async function issueEquipmentFromCounter(input: {
  equipmentRequestId: string;
  items: { equipmentId: string; qty: number }[];
}) {
  const staff = await requireStaffOrAdmin();

  if (!input.items.length) {
    throw new Error("No items to issue");
  }

  await prisma.$transaction(async (tx) => {
    const req = await tx.equipmentRequest.findUnique({
      where: { id: input.equipmentRequestId },
      include: { booking: true },
    });

    if (!req) {
      throw new Error("Equipment request not found");
    }

    // For each selected equipment, decrement inventory and create or update request items
    for (const item of input.items) {
      if (item.qty <= 0) continue;

      const eq = await tx.equipment.findUnique({
        where: { id: item.equipmentId },
      });

      if (!eq) {
        throw new Error("Equipment not found");
      }

      if (eq.qtyAvailable < item.qty) {
        throw new Error(`Not enough ${eq.name} available`);
      }

      await tx.equipment.update({
        where: { id: eq.id },
        data: {
          qtyAvailable: {
            decrement: item.qty,
          },
        },
      });

      const existing = await tx.equipmentRequestItem.findUnique({
        where: {
          requestId_equipmentId: {
            requestId: req.id,
            equipmentId: eq.id,
          },
        },
      });

      if (existing) {
        await tx.equipmentRequestItem.update({
          where: { id: existing.id },
          data: {
            qty: item.qty,
            issuedAt: existing.issuedAt ?? new Date(),
            dismissed: false,
          },
        });
      } else {
        await tx.equipmentRequestItem.create({
          data: {
            requestId: req.id,
            equipmentId: eq.id,
            qty: item.qty,
            qtyReturned: 0,
            issuedAt: new Date(),
          },
        });
      }
    }

    // Keep status approved while items are out, set decider info
    await tx.equipmentRequest.update({
      where: { id: req.id },
      data: {
        status: EquipReqStatus.approved,
        decidedBy: staff.id,
        decidedAt: req.decidedAt ?? new Date(),
      },
    });
  });

  // Revalidate the staff page, adjust this path to your actual route
  revalidatePath("/staff");
  revalidatePath("/admin");
}

// Staff processes a return for one issued item row
export async function returnEquipmentFromCounter(input: {
  requestItemId: string;
  quantity: number;
  condition: EquipReturnCondition;
  damageNotes?: string;
}) {
  await requireStaffOrAdmin();

  await prisma.$transaction(async (tx) => {
    const item = await tx.equipmentRequestItem.findUnique({
      where: { id: input.requestItemId },
      include: {
        equipment: true,
        request: {
          include: { items: true },
        },
      },
    });

    if (!item) {
      throw new Error("Request item not found");
    }

    const outstanding = item.qty - item.qtyReturned;
    if (input.quantity < 1 || input.quantity > outstanding) {
      throw new Error(`Invalid quantity, outstanding: ${outstanding}`);
    }

    // Inventory updates
    if (input.condition === "good") {
      await tx.equipment.update({
        where: { id: item.equipmentId },
        data: {
          qtyAvailable: {
            increment: input.quantity,
          },
        },
      });
    } else if (input.condition === "lost") {
      await tx.equipment.update({
        where: { id: item.equipmentId },
        data: {
          qtyTotal: {
            decrement: input.quantity,
          },
        },
      });
    }

    const newQtyReturned = item.qtyReturned + input.quantity;

    await tx.equipmentRequestItem.update({
      where: { id: item.id },
      data: {
        qtyReturned: newQtyReturned,
        condition: input.condition,
        damageNotes: input.damageNotes || null,
      },
    });

    // If every item in this request is resolved, mark request as done
    const allItems = await tx.equipmentRequestItem.findMany({
      where: { requestId: item.requestId },
    });

    const allResolved = allItems.every(
      (i) => i.qtyReturned >= i.qty || i.condition === "lost"
    );

    if (allResolved) {
      await tx.equipmentRequest.update({
        where: { id: item.requestId },
        data: {
          status: EquipReqStatus.done,
          returnedAt: new Date(),
        },
      });
    }
  });

  revalidatePath("/staff");
  revalidatePath("/admin");
}

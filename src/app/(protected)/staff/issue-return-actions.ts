"use server";

import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/authz";
import { revalidatePath } from "next/cache";
import { EquipReturnCondition, EquipReqStatus } from "@prisma/client";

// Staff issues items that were previously approved (idempotent, safe for double-click / retry)
export async function issueEquipmentFromCounter(input: {
  equipmentRequestId: string;
  items: { equipmentId: string; qty: number }[];
}) {
  const staff = await requireStaffOrAdmin();

  if (!input.equipmentRequestId) {
    throw new Error("Missing equipmentRequestId");
  }

  if (!input.items?.length) {
    throw new Error("No items to issue");
  }

  // Clean and merge duplicates by equipmentId, keep max qty (prevents weird double entries)
  const merged = new Map<string, number>();
  for (const it of input.items) {
    const qty = Number.isFinite(it.qty) ? Math.floor(it.qty) : 0;
    if (!it.equipmentId || qty <= 0) continue;
    const prev = merged.get(it.equipmentId) ?? 0;
    merged.set(it.equipmentId, Math.max(prev, qty));
  }

  const items = Array.from(merged.entries()).map(([equipmentId, qty]) => ({
    equipmentId,
    qty,
  }));

  if (!items.length) {
    throw new Error("No valid items to issue");
  }

  await prisma.$transaction(async (tx) => {
    const req = await tx.equipmentRequest.findUnique({
      where: { id: input.equipmentRequestId },
      include: {
        booking: true,
        items: true, // important for validation / status decisions
      },
    });

    if (!req) {
      throw new Error("Equipment request not found");
    }

    // Optional guard, keep if your flow expects only approved requests can be issued
    if (req.status !== EquipReqStatus.approved) {
      throw new Error("Request is not approved for issuing");
    }

    for (const item of items) {
      const eq = await tx.equipment.findUnique({
        where: { id: item.equipmentId },
      });

      if (!eq) {
        throw new Error("Equipment not found");
      }

      const existing = await tx.equipmentRequestItem.findUnique({
        where: {
          requestId_equipmentId: {
            requestId: req.id,
            equipmentId: eq.id,
          },
        },
      });

      const prevQty = existing?.qty ?? 0;
      const nextQty = item.qty;

      // This makes it safe on retries: same qty again = delta 0, no second deduction.
      const delta = nextQty - prevQty;

      if (delta < 0) {
        // Safer to block reductions here, returns should handle reductions
        throw new Error(
          `Cannot reduce issued quantity for ${eq.name}. Use return processing instead.`
        );
      }

      if (delta === 0) {
        // Same quantity, but we still need to set issuedAt if not already set
        if (existing && !existing.issuedAt) {
          await tx.equipmentRequestItem.update({
            where: { id: existing.id },
            data: {
              issuedAt: new Date(),
              dismissed: false,
            },
          });
        }
        continue;
      }

      if (eq.qtyAvailable < delta) {
        throw new Error(`Not enough ${eq.name} available`);
      }

      // Deduct only the delta (prevents double-issue bug)
      await tx.equipment.update({
        where: { id: eq.id },
        data: { qtyAvailable: { decrement: delta } },
      });

      if (existing) {
        await tx.equipmentRequestItem.update({
          where: { id: existing.id },
          data: {
            qty: nextQty,
            issuedAt: existing.issuedAt ?? new Date(),
            dismissed: false,
          },
        });
      } else {
        await tx.equipmentRequestItem.create({
          data: {
            requestId: req.id,
            equipmentId: eq.id,
            qty: nextQty,
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

  if (!input.requestItemId) {
    throw new Error("Missing requestItemId");
  }

  const qty = Number.isFinite(input.quantity) ? Math.floor(input.quantity) : 0;
  if (qty < 1) {
    throw new Error("Invalid quantity");
  }

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
    if (qty < 1 || qty > outstanding) {
      throw new Error(`Invalid quantity, outstanding: ${outstanding}`);
    }

    // Inventory updates
    if (input.condition === "good") {
      await tx.equipment.update({
        where: { id: item.equipmentId },
        data: {
          qtyAvailable: { increment: qty },
        },
      });
    } else if (input.condition === "lost") {
      await tx.equipment.update({
        where: { id: item.equipmentId },
        data: {
          qtyTotal: { decrement: qty },
        },
      });
    } else {
      // damaged / not_returned -> no inventory change here
      // (if you want damaged to reduce qtyTotal, add that rule explicitly)
    }

    const newQtyReturned = item.qtyReturned + qty;

    await tx.equipmentRequestItem.update({
      where: { id: item.id },
      data: {
        qtyReturned: newQtyReturned,
        condition: input.condition,
        damageNotes: input.damageNotes?.trim()
          ? input.damageNotes.trim()
          : null,
      },
    });

    const allItems = await tx.equipmentRequestItem.findMany({
      where: { requestId: item.requestId },
    });

    // Consider an item resolved if fully returned, or marked lost.
    // If you also want "not_returned" to keep request open, this already does.
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

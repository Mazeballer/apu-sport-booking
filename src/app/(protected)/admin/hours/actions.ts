// src/app/(protected)/admin/hours/action.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { z } from "zod";
import { notifyFacilityChange } from "@/lib/notify/facilityNotify";

export type HoursActionResult = { ok: boolean; message?: string };

const updateHoursSchema = z.object({
  facilityId: z.string().uuid(),
  openTime: z.string().min(1),
  closeTime: z.string().min(1),
});

export async function updateFacilityHours(
  _prevState: HoursActionResult | null,
  fd: FormData
): Promise<HoursActionResult> {
  await requireAdmin();

  const parsed = updateHoursSchema.safeParse({
    facilityId: fd.get("facilityId"),
    openTime: fd.get("openTime"),
    closeTime: fd.get("closeTime"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues.map((i) => i.message).join(", "),
    };
  }

  const { facilityId, openTime, closeTime } = parsed.data;

  try {
    const before = await prisma.facility.findUnique({
      where: { id: facilityId },
    });
    if (!before) {
      return { ok: false, message: "Facility not found" };
    }

    const after = await prisma.facility.update({
      where: { id: facilityId },
      data: { openTime, closeTime },
    });

    const timesChanged =
      before.openTime !== after.openTime ||
      before.closeTime !== after.closeTime;

    if (timesChanged) {
      await notifyFacilityChange({
        kind: "hours_changed",
        facility: after,
      });
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to update hours" };
  }
}

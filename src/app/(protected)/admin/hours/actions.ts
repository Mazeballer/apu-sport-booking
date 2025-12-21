// src/app/(protected)/admin/hours/action.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/authz";
import { z } from "zod";
import { notifyFacilityChange } from "@/lib/notify/facilityNotify";

export type HoursActionResult = { ok: boolean; message?: string };

// helper: "HH:mm" -> minutes since midnight (returns NaN if invalid)
function timeToMinutes(t: string): number {
  const [hh, mm] = t.split(":").map((x) => Number.parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return Number.NaN;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return Number.NaN;
  return hh * 60 + mm;
}

const updateHoursSchema = z
  .object({
    facilityId: z.string().uuid(),
    openTime: z.string().regex(/^\d{2}:\d{2}$/, "Opening time must be HH:mm"),
    closeTime: z.string().regex(/^\d{2}:\d{2}$/, "Closing time must be HH:mm"),
  })
  .superRefine((val, ctx) => {
    const openM = timeToMinutes(val.openTime);
    const closeM = timeToMinutes(val.closeTime);

    if (!Number.isFinite(openM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["openTime"],
        message: "Invalid opening time",
      });
      return;
    }

    if (!Number.isFinite(closeM)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closeTime"],
        message: "Invalid closing time",
      });
      return;
    }

    // strict: close must be after open, same time not allowed
    if (closeM <= openM) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["closeTime"],
        message: "Closing time must be later than opening time",
      });
    }
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

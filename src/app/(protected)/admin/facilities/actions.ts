// src/app/(protected)/admin/facilities/actions.ts
"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/server";
import { notifyFacilityChange } from "@/lib/notify/facilityNotify";

const BUCKET = "facility-photos";
const FACILITY_TAG = "facilities";

const facilityInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  type: z.string().min(1),
  location: z.string().min(1),
  locationType: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().nonnegative().optional(),
  openTime: z.string().optional(),
  closeTime: z.string().optional(),
  isMultiSport: z.boolean().optional(),
  sharedSports: z.array(z.string()).optional(),
  numberOfCourts: z.number().int().positive().optional(),
  rules: z.array(z.string()).optional(),
  photos: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export type FacilityInput = z.infer<typeof facilityInputSchema>;
export type ActionResult = { ok: boolean; message?: string };

// keep Court rows in sync with facility.numberOfCourts
async function syncFacilityCourts(
  db: { court: typeof prisma.court },
  facilityId: string,
  desiredCount: number | undefined
) {
  const target = desiredCount && desiredCount > 0 ? desiredCount : 1;

  const existing = await db.court.findMany({
    where: { facilityId },
    orderBy: { name: "asc" },
  });

  if (existing.length === target) return;

  // Not enough courts, create more
  if (existing.length < target) {
    const toCreate = target - existing.length;

    const data = Array.from({ length: toCreate }).map((_, index) => ({
      facilityId,
      name: `Court ${existing.length + index + 1}`,
      active: true,
    }));

    await db.court.createMany({ data });
    return;
  }

  // Too many courts, mark the extra ones inactive instead of deleting
  const extra = existing.slice(target); // keep first "target" courts active
  if (extra.length > 0) {
    await db.court.updateMany({
      where: { id: { in: extra.map((c) => c.id) } },
      data: { active: false },
    });
  }
}

function safeName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function uploadOne(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  folder: string,
  file: File | null
): Promise<string | null> {
  if (!file) return null;
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const key = `${folder}/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(key, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw new Error(error.message);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
  return pub.publicUrl;
}

/* ------------------------
   Existing JSON actions
   ------------------------ */

export async function createFacilityAction(raw: FacilityInput) {
  const data = facilityInputSchema.parse(raw);

  await prisma.$transaction(async (tx) => {
    const facility = await tx.facility.create({
      data: {
        name: data.name,
        type: data.type,
        location: data.location,
        locationType: data.locationType,
        description: data.description ?? null,
        capacity: data.capacity ?? 0,
        openTime: data.openTime ?? null,
        closeTime: data.closeTime ?? null,
        rules:
          data.rules && data.rules.length > 0 ? data.rules.join("\n") : null,
        photos: data.photos ?? [],
        active: data.active ?? true,
        isMultiSport: data.isMultiSport ?? false,
        sharedSports: data.sharedSports ?? [],
        numberOfCourts: data.numberOfCourts ?? 1,
      },
    });

    await syncFacilityCourts(tx, facility.id, data.numberOfCourts ?? 1);
  });

  revalidateTag(FACILITY_TAG);
  revalidatePath("/admin");
}

export async function updateFacilityAction(raw: FacilityInput) {
  if (!raw.id) {
    throw new Error("Facility id is required for update");
  }
  const data = facilityInputSchema.parse(raw);

  await prisma.$transaction(async (tx) => {
    // we may need the existing value if numberOfCourts is not sent
    const existing = await tx.facility.findUnique({
      where: { id: data.id },
      select: { numberOfCourts: true },
    });
    if (!existing) {
      throw new Error("Facility not found");
    }

    const effectiveCourts =
      data.numberOfCourts && data.numberOfCourts > 0
        ? data.numberOfCourts
        : existing.numberOfCourts ?? 1;

    const facility = await tx.facility.update({
      where: { id: data.id },
      data: {
        name: data.name,
        type: data.type,
        location: data.location,
        locationType: data.locationType,
        description: data.description ?? null,
        capacity: data.capacity ?? 0,
        openTime: data.openTime ?? null,
        closeTime: data.closeTime ?? null,
        rules:
          data.rules && data.rules.length > 0 ? data.rules.join("\n") : null,
        photos: data.photos ?? [],
        active: data.active ?? true,
        isMultiSport: data.isMultiSport ?? false,
        sharedSports: data.sharedSports ?? [],
        numberOfCourts: effectiveCourts,
      },
    });

    await syncFacilityCourts(tx, facility.id, effectiveCourts);
  });

  revalidateTag(FACILITY_TAG);
  revalidatePath("/admin");
}

export async function deleteFacilityAction(id: string) {
  await prisma.facility.delete({ where: { id } });
  revalidatePath("/admin");
}

export async function toggleFacilityActiveAction(id: string, active: boolean) {
  const before = await prisma.facility.findUnique({
    where: { id },
  });
  if (!before) throw new Error("Facility not found");

  const after = await prisma.facility.update({
    where: { id },
    data: { active },
  });

  // Queue notification instead of sending immediately
  await notifyFacilityChange({
    kind: active ? "reopened" : "closed",
    facility: after,
  });

  revalidatePath("/admin");
}

// fetch the freshest copy of a facility for the Edit dialog
export async function getFacilityByIdAction(id: string) {
  const f = await prisma.facility.findUnique({
    where: { id },
  });

  if (!f) return null;

  // DB stores rules as a newline string. Normalize to string[]
  const rulesArray =
    typeof f.rules === "string"
      ? f.rules.split("\n").filter(Boolean)
      : Array.isArray(f.rules)
      ? f.rules
      : [];

  return {
    id: f.id,
    name: f.name,
    type: f.type as any, // SportType on client
    location: f.location,
    locationType: f.locationType as any, // LocationType on client
    description: f.description,
    capacity: f.capacity ?? 0,
    openTime: f.openTime ?? "08:00",
    closeTime: f.closeTime ?? "22:00",
    isMultiSport: !!f.isMultiSport,
    // your schema uses sharedSports + numberOfCourts, not a courts table
    courts:
      f.isMultiSport && Array.isArray(f.sharedSports)
        ? [{ supportedSports: f.sharedSports as any[] }]
        : [],
    numberOfCourts: f.numberOfCourts ?? 1,

    // images
    image: Array.isArray(f.photos) ? f.photos[0] : undefined,
    layoutImage: Array.isArray(f.photos) ? f.photos[1] : undefined,
    photos: (f.photos ?? []) as string[],

    // equipment if you add it later
    availableEquipment: [],

    // map boolean to the UI status field
    status: f.active ? "active" : "inactive",

    // normalized rules
    rules: rulesArray,
  };
}

export async function createFacilityFromForm(
  _prev: unknown,
  fd: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();

    const name = String(fd.get("name") ?? "");
    const type = String(fd.get("type") ?? "");
    const location = String(fd.get("location") ?? "");
    const locationType = String(fd.get("locationType") ?? "Indoor");
    const description = String(fd.get("description") ?? "");
    const capacity = Number(fd.get("capacity") ?? 0);
    const openTime = String(fd.get("openTime") ?? "08:00");
    const closeTime = String(fd.get("closeTime") ?? "22:00");
    const isMultiSport = String(fd.get("isMultiSport") ?? "false") === "true";
    const sharedSports = JSON.parse(
      String(fd.get("sharedSports") ?? "[]")
    ) as string[];
    const numberOfCourtsRaw = Number(fd.get("numberOfCourts") ?? 1);
    const numberOfCourts =
      numberOfCourtsRaw && numberOfCourtsRaw > 0 ? numberOfCourtsRaw : 1;
    const rules = JSON.parse(String(fd.get("rules") ?? "[]")) as string[];

    const facilityImage = fd.get("facilityImage") as File | null;
    const layoutImage = fd.get("layoutImage") as File | null;

    if (!name || !type || !location)
      return { ok: false, message: "Missing required fields" };

    const folder = `facilities/${safeName(name)}`;
    const [mainUrl, layoutUrl] = await Promise.all([
      uploadOne(supabase, `${folder}/main`, facilityImage),
      uploadOne(supabase, `${folder}/layout`, layoutImage),
    ]);

    await prisma.$transaction(async (tx) => {
      const facility = await tx.facility.create({
        data: {
          name,
          type,
          location,
          locationType,
          description: description || null,
          capacity,
          openTime,
          closeTime,
          isMultiSport,
          sharedSports,
          numberOfCourts,
          rules: rules.length ? rules.join("\n") : null,
          photos: [mainUrl, layoutUrl].filter(Boolean) as string[],
          active: true,
        },
      });

      await syncFacilityCourts(tx, facility.id, numberOfCourts);
    });

    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to create facility" };
  }
}

export async function updateFacilityFromForm(
  _prev: unknown,
  fd: FormData
): Promise<ActionResult> {
  try {
    const supabase = await createServerSupabase();

    const id = String(fd.get("id") ?? "");
    if (!id) return { ok: false, message: "Missing facility id" };

    const existing = await prisma.facility.findUnique({
      where: { id },
      select: {
        name: true,
        photos: true,
        numberOfCourts: true,
        openTime: true,
        closeTime: true,
        active: true,
      },
    });

    if (!existing) return { ok: false, message: "Facility not found" };

    const name = fd.get("name")?.toString();
    const type = fd.get("type")?.toString();
    const location = fd.get("location")?.toString();
    const locationType = fd.get("locationType")?.toString();
    const description = fd.get("description")?.toString();
    const capacity = fd.get("capacity")
      ? Number(fd.get("capacity"))
      : undefined;
    const openTime = fd.get("openTime")?.toString();
    const closeTime = fd.get("closeTime")?.toString();
    const isMultiSport = fd.get("isMultiSport")
      ? String(fd.get("isMultiSport")) === "true"
      : undefined;
    const sharedSports = fd.get("sharedSports")
      ? (JSON.parse(String(fd.get("sharedSports"))) as string[])
      : undefined;
    const numberOfCourtsRaw = fd.get("numberOfCourts")
      ? Number(fd.get("numberOfCourts"))
      : undefined;
    const rules = fd.get("rules")
      ? (JSON.parse(String(fd.get("rules"))) as string[])
      : undefined;

    const facilityImage = fd.get("facilityImage") as File | null;
    const layoutImage = fd.get("layoutImage") as File | null;

    const folder = `facilities/${safeName(name ?? existing.name)}`;
    const newMain = await uploadOne(supabase, `${folder}/main`, facilityImage);
    const newLayout = await uploadOne(
      supabase,
      `${folder}/layout`,
      layoutImage
    );

    const photos = [...(existing.photos ?? [])];
    if (newMain) photos[0] = newMain;
    if (newLayout) photos[1] = newLayout;

    const effectiveCourts =
      numberOfCourtsRaw && numberOfCourtsRaw > 0
        ? numberOfCourtsRaw
        : existing.numberOfCourts ?? 1;

    await prisma.$transaction(async (tx) => {
      await tx.facility.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(type ? { type } : {}),
          ...(location ? { location } : {}),
          ...(locationType ? { locationType } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(capacity !== undefined ? { capacity } : {}),
          ...(openTime ? { openTime } : {}),
          ...(closeTime ? { closeTime } : {}),
          ...(isMultiSport !== undefined ? { isMultiSport } : {}),
          ...(sharedSports ? { sharedSports } : {}),
          ...(effectiveCourts ? { numberOfCourts: effectiveCourts } : {}),
          ...(rules ? { rules: rules.length ? rules.join("\n") : null } : {}),
          photos,
        },
      });

      await syncFacilityCourts(tx, id, effectiveCourts);
    });

    // After update, load the fresh facility snapshot
    const updated = await prisma.facility.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        openTime: true,
        closeTime: true,
        active: true,
      },
    });

    if (updated) {
      const hoursChanged =
        updated.openTime !== existing.openTime ||
        updated.closeTime !== existing.closeTime;

      if (hoursChanged) {
        await notifyFacilityChange({
          kind: "hours_changed",
          facility: updated,
          before: {
            id,
            name: existing.name,
            openTime: existing.openTime,
            closeTime: existing.closeTime,
            active: existing.active,
          },
          after: updated,
        });
      }
    }

    revalidatePath("/admin");
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Failed to update facility" };
  }
}

"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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

// All auth protection stays on the page via <AuthGuard>

export async function createFacilityAction(raw: FacilityInput) {
  const data = facilityInputSchema.parse(raw);

  await prisma.facility.create({
    data: {
      name: data.name,
      type: data.type,
      location: data.location,
      locationType: data.locationType,
      description: data.description ?? null,
      capacity: data.capacity ?? 0,
      openTime: data.openTime ?? null,
      closeTime: data.closeTime ?? null,
      rules: data.rules && data.rules.length > 0 ? data.rules.join("\n") : null,
      photos: data.photos ?? [],
      active: data.active ?? true,
      isMultiSport: data.isMultiSport ?? false,
      sharedSports: data.sharedSports ?? [],
      numberOfCourts: data.numberOfCourts ?? 1,
    },
  });

  revalidatePath("/admin");
}

export async function updateFacilityAction(raw: FacilityInput) {
  if (!raw.id) {
    throw new Error("Facility id is required for update");
  }

  const data = facilityInputSchema.parse(raw);

  await prisma.facility.update({
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
      rules: data.rules && data.rules.length > 0 ? data.rules.join("\n") : null,
      photos: data.photos ?? [],
      active: data.active ?? true,
      isMultiSport: data.isMultiSport ?? false,
      sharedSports: data.sharedSports ?? [],
      numberOfCourts: data.numberOfCourts ?? 1,
    },
  });

  revalidatePath("/admin");
}

export async function deleteFacilityAction(id: string) {
  await prisma.facility.delete({
    where: { id },
  });

  revalidatePath("/admin");
}

export async function toggleFacilityActiveAction(id: string, active: boolean) {
  await prisma.facility.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/admin");
}

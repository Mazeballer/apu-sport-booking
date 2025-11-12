// lib/mappers/facility.ts
import type { FacilityCardData } from "@/lib/facility-types";
import type { Facility as DbFacility } from "@prisma/client";

export function toFacilityCardData(f: DbFacility): FacilityCardData {
  return {
    id: f.id,
    name: f.name,
    type: f.type as FacilityCardData["type"],
    location: f.location,
    locationType:
      (f.locationType as FacilityCardData["locationType"]) ?? "Indoor",
    description: f.description,
    capacity: f.capacity,
    photos: f.photos ?? [],
    openTime: f.openTime ?? null,
    closeTime: f.closeTime ?? null,
    active: f.active,
    isMultiSport: f.isMultiSport,
    sharedSports: f.sharedSports ?? [],
    numberOfCourts: f.numberOfCourts ?? 1,
    // if rules is newline string in DB and you have not normalized yet, keep as is
    rules: f.rules as any,
  };
}

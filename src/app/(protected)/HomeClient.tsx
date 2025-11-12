// src/app/(protected)/HomeClient.tsx
"use client";

import { Navbar } from "@/components/navbar";
import { FacilityCard } from "@/components/facility-card";
import { FacilityFilters } from "@/components/facility-filters";
import type {
  FacilityCardData,
  SportType,
  LocationType,
} from "@/lib/facility-types";
import { useEffect, useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { createBrowserClient } from "@/lib/supabase/client";

export default function HomeClient({
  facilities,
}: {
  facilities: FacilityCardData[];
}) {
  const [rows, setRows] = useState<FacilityCardData[]>(facilities);
  const [sportType, setSportType] = useState<"all" | SportType>("all");
  const [locationType, setLocationType] = useState<"all" | LocationType>("all");
  const [isLoading] = useState(false);

  // Map a DB row into the card shape when realtime events arrive
  function mapDbToCard(db: any): FacilityCardData {
    return {
      id: db.id,
      name: db.name,
      type: db.type,
      location: db.location,
      locationType: db.locationType ?? "Indoor",
      description: db.description ?? "",
      capacity: db.capacity ?? 0,
      photos: Array.isArray(db.photos) ? db.photos : [],
      openTime: db.openTime ?? null,
      closeTime: db.closeTime ?? null,
      active: db.active ?? true,
      isMultiSport: db.isMultiSport ?? false,
      sharedSports: db.sharedSports ?? [],
      numberOfCourts: db.numberOfCourts ?? 1,
      rules: db.rules ?? null,
    };
  }

  useEffect(() => {
    setRows(facilities);
  }, [facilities]);

  useEffect(() => {
    const supabase = createBrowserClient();

    const ch = supabase
      .channel("rt-facilities")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "Facility" }, // Prisma model table name is usually "Facility"
        (payload) => {
          const next = payload.new as any;
          const prevRow = payload.old as any;

          setRows((prev) => {
            let arr = [...prev];
            if (payload.eventType === "INSERT") {
              const card = mapDbToCard(next);
              // avoid duplicates if we already have it
              if (!arr.find((f) => f.id === card.id)) arr.unshift(card);
              return arr;
            }
            if (payload.eventType === "UPDATE") {
              const card = mapDbToCard(next);
              return arr.map((f) => (f.id === card.id ? card : f));
            }
            if (payload.eventType === "DELETE") {
              return arr.filter((f) => f.id !== prevRow.id);
            }
            return arr;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((f) => {
      if (sportType !== "all" && f.type !== sportType) return false;
      if (locationType !== "all" && f.locationType !== locationType)
        return false;
      return true;
    });
  }, [rows, sportType, locationType]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-balance">
            Sports Facilities
          </h1>
          <p className="text-muted-foreground text-lg">
            Browse and book available sports facilities at APU
          </p>
        </div>

        <FacilityFilters
          sportType={sportType}
          locationType={locationType}
          onSportTypeChange={setSportType}
          onLocationTypeChange={setLocationType}
        />

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full rounded-2xl" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">{/* empty state */}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((facility) => (
              <FacilityCard key={facility.id} facility={facility} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

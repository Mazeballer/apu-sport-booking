"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ClockIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  updateFacilityHours,
  type HoursActionResult,
} from "@/app/(protected)/admin/hours/actions";
import { notify } from "@/lib/toast";

type Facility = {
  id: string;
  name: string;
  location: string;
  openTime: string | null;
  closeTime: string | null;
};

export function OperatingHoursManagement({
  facilities = [],
}: {
  facilities: Facility[];
}) {
  const router = useRouter();
  
  // one state object for all facilities
  const [hours, setHours] = useState<
    Record<string, { openTime: string; closeTime: string }>
  >(() =>
    Object.fromEntries(
      facilities.map((f) => [
        f.id,
        {
          openTime: f.openTime ?? "08:00",
          closeTime: f.closeTime ?? "22:00",
        },
      ])
    )
  );

  const [actionState, formAction, pending] = useActionState<
    HoursActionResult | null,
    FormData
  >(updateFacilityHours, null);

  useEffect(() => {
    if (!actionState) return;

    if (actionState.ok) {
      notify.success("Operating hours saved successfully");
      router.refresh();
    } else {
      notify.error("An error occurred while saving changes.");
    }
  }, [actionState, router]);

  return (
    <div className="space-y-4">
      {facilities.map((facility) => {
        const current = hours[facility.id];

        return (
          <Card key={facility.id} className="p-6">
            <form action={formAction} className="space-y-4">
              <input type="hidden" name="facilityId" value={facility.id} />

              {/* header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <ClockIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold">{facility.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {facility.location}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0">
                <div className="space-y-2">
                  <Label htmlFor={`start-${facility.id}`}>Opening Time</Label>
                  <Input
                    id={`start-${facility.id}`}
                    type="time"
                    name="openTime"
                    value={current.openTime}
                    onChange={(e) =>
                      setHours((prev) => ({
                        ...prev,
                        [facility.id]: {
                          ...prev[facility.id],
                          openTime: e.target.value,
                        },
                      }))
                    }
                    className="border-3 border-primary/20 focus:border-primary shadow-sm w-full max-w-md"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`end-${facility.id}`}>Closing Time</Label>
                  <Input
                    id={`end-${facility.id}`}
                    type="time"
                    name="closeTime"
                    value={current.closeTime}
                    onChange={(e) =>
                      setHours((prev) => ({
                        ...prev,
                        [facility.id]: {
                          ...prev[facility.id],
                          closeTime: e.target.value,
                        },
                      }))
                    }
                    className="border-3 border-primary/20 focus:border-primary shadow-sm w-full max-w-md"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Saving..." : "Save Changes"}
              </Button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}

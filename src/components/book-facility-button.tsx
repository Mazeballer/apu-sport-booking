"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function BookFacilityButton({ facilityId }: { facilityId: string }) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleBookFacility = () => {
    setIsNavigating(true);
    router.push(`/facility/${facilityId}/book`);
    // Reset after navigation starts
    setTimeout(() => setIsNavigating(false), 1000);
  };

  return (
    <Button
      onClick={handleBookFacility}
      disabled={isNavigating}
      className="w-full text-white py-6 bg-primary hover:bg-blue-600 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
    >
      {isNavigating ? "Loading..." : "Book This Facility"}
    </Button>
  );
}

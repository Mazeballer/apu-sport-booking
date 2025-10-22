"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export function BookFacilityButton({ facilityId }: { facilityId: string }) {
  const router = useRouter()

  const handleBookFacility = () => {
    router.push(`/facility/${facilityId}/book`)
  }

  return (
    <Button onClick={handleBookFacility} className="w-full hover:bg-blue-600 text-white py-6 bg-primary">
      Book This Facility
    </Button>
  )
}

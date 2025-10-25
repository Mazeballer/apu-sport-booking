"use client"

import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { FacilityCard } from "@/components/facility-card"
import { FacilityFilters } from "@/components/facility-filters"
import { facilities, type SportType, type LocationType } from "@/lib/data"
import { getUserRole } from "@/lib/auth"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  const router = useRouter()
  const [sportType, setSportType] = useState<SportType | "all">("all")
  const [locationType, setLocationType] = useState<LocationType | "all">("all")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const role = getUserRole()
    if (role === "admin") {
      router.push("/admin")
    }
  }, [router])

  const filteredFacilities = facilities.filter((facility) => {
    if (sportType !== "all" && facility.type !== sportType) return false
    if (locationType !== "all" && facility.locationType !== locationType) return false
    return true
  })

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 text-balance">Sports Facilities</h1>
            <p className="text-muted-foreground text-lg">Browse and book available sports facilities at APU</p>
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
          ) : filteredFacilities.length === 0 ? (
            <div className="text-center py-16">
              <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                <svg className="w-12 h-12 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">No facilities found</h3>
              <p className="text-muted-foreground">Try adjusting your filters to see more results</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFacilities.map((facility) => (
                <FacilityCard key={facility.id} facility={facility} />
              ))}
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  )
}


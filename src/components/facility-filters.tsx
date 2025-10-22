"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import type { SportType, LocationType } from "@/lib/data"
import { FilterIcon } from "lucide-react"

interface FacilityFiltersProps {
  sportType: SportType | "all"
  locationType: LocationType | "all"
  onSportTypeChange: (type: SportType | "all") => void
  onLocationTypeChange: (type: LocationType | "all") => void
}

export function FacilityFilters({
  sportType,
  locationType,
  onSportTypeChange,
  onLocationTypeChange,
}: FacilityFiltersProps) {
  const handleReset = () => {
    onSportTypeChange("all")
    onLocationTypeChange("all")
  }

  const hasActiveFilters = sportType !== "all" || locationType !== "all"

  return (
    <Card className="sticky top-20 z-40 mb-8 p-4 shadow-md bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FilterIcon className="h-4 w-4 text-primary" />
          <span>Filters</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          <Select value={sportType} onValueChange={(value) => onSportTypeChange(value as SportType | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sport Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sports</SelectItem>
              <SelectItem value="Basketball">Basketball</SelectItem>
              <SelectItem value="Badminton">Badminton</SelectItem>
              <SelectItem value="Tennis">Tennis</SelectItem>
              <SelectItem value="Football">Football</SelectItem>
              <SelectItem value="Volleyball">Volleyball</SelectItem>
              <SelectItem value="Swimming">Swimming</SelectItem>
            </SelectContent>
          </Select>

          <Select value={locationType} onValueChange={(value) => onLocationTypeChange(value as LocationType | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="Indoor">Indoor</SelectItem>
              <SelectItem value="Outdoor">Outdoor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Clear Filters
          </Button>
        )}
      </div>
    </Card>
  )
}

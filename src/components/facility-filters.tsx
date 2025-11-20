"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import type { SportType, LocationType } from "@/lib/facility-types";
import { FilterIcon } from "lucide-react";

interface FacilityFiltersProps {
  sportType: "all" | SportType;
  locationType: "all" | LocationType;
  sportOptions: SportType[]; // new
  locationOptions: LocationType[]; // new
  onSportTypeChange: (type: "all" | SportType) => void;
  onLocationTypeChange: (type: "all" | LocationType) => void;
}

export function FacilityFilters({
  sportType,
  locationType,
  sportOptions,
  locationOptions,
  onSportTypeChange,
  onLocationTypeChange,
}: FacilityFiltersProps) {
  const handleReset = () => {
    onSportTypeChange("all");
    onLocationTypeChange("all");
  };

  const hasActiveFilters = sportType !== "all" || locationType !== "all";

  return (
    <Card className="mb-8 p-4 shadow-md bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium">
          <FilterIcon className="h-4 w-4 text-primary" />
          <span>Filters</span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
          {/* Sport type */}
          <Select
            value={sportType}
            onValueChange={(value) =>
              onSportTypeChange(value as "all" | SportType)
            }
          >
            <SelectTrigger className="w-full sm:w-[200px] border-3 border-primary/20 focus:border-primary shadow-sm">
              <SelectValue placeholder="Sport type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sports</SelectItem>
              {sportOptions.map((sport) => (
                <SelectItem key={sport} value={sport}>
                  {sport}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Location type */}
          <Select
            value={locationType}
            onValueChange={(value) =>
              onLocationTypeChange(value as "all" | LocationType)
            }
          >
            <SelectTrigger className="w-full sm:w-[200px] border-3 border-primary/20 focus:border-primary shadow-sm">
              <SelectValue placeholder="Location type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locationOptions.map((loc) => (
                <SelectItem key={loc} value={loc}>
                  {loc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Clear filters
          </Button>
        )}
      </div>
    </Card>
  );
}

"use client";

import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPinIcon, UsersIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { FacilityCardData } from "@/lib/facility-types";

interface FacilityCardProps {
  facility: FacilityCardData;
}

export function FacilityCard({ facility }: FacilityCardProps) {
  const router = useRouter();

  const cover = facility.photos?.[0] ?? "/images/placeholders/facility.jpg"; // ensure this file exists

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-shadow duration-300 rounded-2xl flex flex-col h-full">
      <div className="relative h-48 w-full overflow-hidden">
        <Image
          src={cover}
          alt={facility.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority={false}
        />
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-card/90 backdrop-blur">
            {facility.type}
          </Badge>
        </div>
      </div>

      <CardContent className="p-5 flex-1">
        <h3 className="text-xl font-bold mb-2 text-balance">{facility.name}</h3>

        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <MapPinIcon className="h-4 w-4 text-primary" />
            <span>{facility.location}</span>
            <Badge variant="outline" className="ml-auto">
              {facility.locationType}
            </Badge>
          </div>

          {typeof facility.capacity === "number" ? (
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-primary" />
              <span>Capacity: {facility.capacity} people</span>
            </div>
          ) : null}
        </div>

        {facility.description ? (
          <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
            {facility.description}
          </p>
        ) : null}
      </CardContent>

      <CardFooter className="p-5 pt-0">
        <Button
          className="w-full"
          onClick={() => router.push(`/facility/${facility.id}`)} // change to your actual route
        >
          View & Book 
        </Button>
      </CardFooter>
    </Card>
  );
}

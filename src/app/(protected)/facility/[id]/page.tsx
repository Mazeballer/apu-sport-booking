// app/facilities/[id]/page.tsx
import { notFound } from "next/navigation";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsersIcon, ClockIcon, CheckCircle2Icon } from "lucide-react";
import { BookFacilityButton } from "@/components/book-facility-button";
import { AuthGuard } from "@/components/auth-guard";

export const revalidate = 0;

export default async function FacilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const facility = await prisma.facility.findUnique({
    where: { id },
    include: {
      equipment: true,
    },
  });

  if (!facility) notFound();

  const rules =
    Array.isArray(facility.rules) && facility.rules.length > 0
      ? facility.rules
      : typeof facility.rules === "string"
      ? facility.rules.split("\n").filter(Boolean)
      : [];

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          {/* Hero */}
          <div className="relative h-[240px] w-full rounded-2xl overflow-hidden mb-8 shadow-lg">
            <Image
              src={facility.photos?.[0] ?? "/images/placeholders/facility.jpg"}
              alt={facility.name}
              fill
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute top-4 left-4">
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white uppercase text-xs font-bold px-3 py-1">
                {facility.type}
              </Badge>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-3xl md:text-4xl font-bold">
                {facility.name}
              </h1>
              <p className="text-white/90 flex items-center gap-2">
                {facility.location}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">About This Facility</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {facility.description}
                  </p>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Facility Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {rules.map((r, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2Icon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{r}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Available Equipment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {facility.equipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold">{eq.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Equipment
                          </p>
                        </div>
                        <Badge
                          variant={
                            eq.qtyAvailable > 0 ? "default" : "secondary"
                          }
                          className={
                            eq.qtyAvailable > 0
                              ? "bg-green-500 hover:bg-green-600 text-white"
                              : "bg-gray-200 text-gray-600"
                          }
                        >
                          {eq.qtyAvailable} available
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right */}
            <div className="lg:col-span-1">
              <Card className="rounded-2xl shadow-sm sticky top-8">
                <CardHeader>
                  <CardTitle className="text-xl">Facility Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <UsersIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">Capacity</p>
                      <p className="text-muted-foreground">
                        {facility.capacity} people
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ClockIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">
                        Opening Hours
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {facility.openTime || "07:00"} -{" "}
                        {facility.closeTime || "22:00"}
                      </p>
                    </div>
                  </div>

                  <BookFacilityButton facilityId={facility.id} />
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}

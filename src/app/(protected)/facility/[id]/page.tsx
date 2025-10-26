import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { facilities, equipment } from "@/lib/data"
import { notFound } from "next/navigation"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { UsersIcon, ClockIcon, CheckCircle2Icon } from "lucide-react"
import { BookFacilityButton } from "@/components/book-facility-button"

export default async function FacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const facility = facilities.find((f) => f.id === id)

  if (!facility) {
    notFound()
  }

  const facilityEquipment = equipment.filter((eq) => eq.facilityId === facility.id)

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          {/* Hero Section */}
          <div className="relative h-[240px] w-full rounded-2xl overflow-hidden mb-8 shadow-lg">
            <Image src={facility.image || "/placeholder.svg"} alt={facility.name} fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="absolute top-4 left-4">
              <Badge className="bg-orange-500 hover:bg-orange-600 text-white uppercase text-xs font-bold px-3 py-1">
                {facility.type}
              </Badge>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <h1 className="text-3xl md:text-4xl font-bold text-balance mb-2">{facility.name}</h1>
              <p className="text-white/90 flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {facility.location}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* About This Facility */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">About This Facility</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{facility.description}</p>
                </CardContent>
              </Card>

              {/* Facility Rules */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Facility Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {facility.rules.map((rule, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2Icon className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Available Equipment */}
              <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                  <CardTitle className="text-xl">Available Equipment</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {facilityEquipment.map((eq) => (
                      <div
                        key={eq.id}
                        className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/50 transition-colors"
                      >
                        <div>
                          <p className="font-semibold">{eq.name}</p>
                          <p className="text-sm text-muted-foreground">Equipment</p>
                        </div>
                        <Badge
                          variant={eq.qtyAvailable > 0 ? "default" : "secondary"}
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

            {/* Right Column - Facility Info Sidebar */}
            <div className="lg:col-span-1">
              <Card className="rounded-2xl shadow-sm sticky top-8">
                <CardHeader>
                  <CardTitle className="text-xl">Facility Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Capacity */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <UsersIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">Capacity</p>
                      <p className="text-muted-foreground">{facility.capacity} people</p>
                    </div>
                  </div>

                  {/* Opening Hours */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <ClockIcon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm mb-1">Opening Hours</p>
                      <p className="text-muted-foreground text-sm">
                        Weekdays: {facility.operatingHours.weekdays || "7:00 AM - 10:00 PM"}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        Weekends: {facility.operatingHours.weekends || "8:00 AM - 8:00 PM"}
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
  )
}

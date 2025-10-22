import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { facilities } from "@/lib/data"
import { notFound } from "next/navigation"
import { BookingFlow } from "@/components/booking-flow"

export default async function BookFacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const facility = facilities.find((f) => f.id === id)

  if (!facility) {
    notFound()
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          <BookingFlow facility={facility} />
        </main>
      </div>
    </AuthGuard>
  )
}

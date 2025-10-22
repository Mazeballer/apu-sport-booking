"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import type { Facility, Equipment, Booking } from "@/lib/data"
import { getUserEmail } from "@/lib/auth"
import { ClockIcon, PackageIcon } from "lucide-react"
import { Separator } from "@/components/ui/separator"

interface AvailabilityGridProps {
  facility: Facility
  equipment: Equipment[]
  existingBookings: Booking[]
}

export function AvailabilityGrid({ facility, equipment, existingBookings }: AvailabilityGridProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [duration, setDuration] = useState<1 | 2>(1)
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
  const [isBookingOpen, setIsBookingOpen] = useState(false)
  const { toast } = useToast()

  // Generate time slots based on operating hours
  const generateTimeSlots = () => {
    const slots: string[] = []
    const [startHour] = facility.operatingHours.start.split(":").map(Number)
    const [endHour] = facility.operatingHours.end.split(":").map(Number)

    for (let hour = startHour; hour < endHour; hour++) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`)
      slots.push(`${hour.toString().padStart(2, "0")}:30`)
    }

    return slots
  }

  const timeSlots = generateTimeSlots()

  const isSlotBooked = (slot: string) => {
    if (!selectedDate) return false

    const dateStr = selectedDate.toISOString().split("T")[0]
    return existingBookings.some((booking) => {
      if (booking.date !== dateStr || booking.status === "cancelled") return false

      const bookingStart = booking.startTime
      const bookingEnd = booking.endTime

      return slot >= bookingStart && slot < bookingEnd
    })
  }

  const handleSlotClick = (slot: string) => {
    if (isSlotBooked(slot)) return

    setSelectedSlot(slot)
    setIsBookingOpen(true)
  }

  const handleBooking = () => {
    if (!selectedDate || !selectedSlot) return

    const userEmail = getUserEmail()
    const dateStr = selectedDate.toISOString().split("T")[0]

    // Calculate end time
    const [hour, minute] = selectedSlot.split(":").map(Number)
    const endHour = hour + duration
    const endTime = `${endHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`

    // Create booking (in real app, this would call an API)
    const newBooking: Booking = {
      id: `b${Date.now()}`,
      facilityId: facility.id,
      userId: "user1",
      userEmail: userEmail || "",
      date: dateStr,
      startTime: selectedSlot,
      endTime,
      duration,
      equipment: selectedEquipment,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    }

    // Add to bookings (in real app, this would be persisted)
    existingBookings.push(newBooking)

    toast({
      title: "Booking Confirmed!",
      description: (
        <div className="mt-2 space-y-1">
          <p className="font-semibold">{facility.name}</p>
          <p className="text-sm">
            {dateStr} at {selectedSlot} ({duration}h)
          </p>
          {selectedEquipment.length > 0 && (
            <p className="text-sm text-muted-foreground">Equipment: {selectedEquipment.join(", ")}</p>
          )}
        </div>
      ),
    })

    setIsBookingOpen(false)
    setSelectedSlot(null)
    setSelectedEquipment([])
    setDuration(1)
  }

  const toggleEquipment = (equipmentName: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentName) ? prev.filter((e) => e !== equipmentName) : [...prev, equipmentName],
    )
  }

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="flex justify-center">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
          className="rounded-xl border shadow-sm"
        />
      </div>

      {selectedDate && (
        <>
          <Separator />

          {/* Time Slots Grid */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="h-5 w-5 text-primary" />
              Available Time Slots
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {timeSlots.map((slot) => {
                const booked = isSlotBooked(slot)
                return (
                  <Button
                    key={slot}
                    variant={selectedSlot === slot ? "default" : booked ? "secondary" : "outline"}
                    className="h-auto py-3"
                    disabled={booked}
                    onClick={() => handleSlotClick(slot)}
                  >
                    {slot}
                  </Button>
                )
              })}
            </div>

            <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-primary bg-primary" />
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border-2 border-input" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-secondary" />
                <span>Booked</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Booking Sheet */}
      <Sheet open={isBookingOpen} onOpenChange={setIsBookingOpen}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Complete Your Booking</SheetTitle>
            <SheetDescription>
              {facility.name} on {selectedDate?.toLocaleDateString()} at {selectedSlot}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Duration Selection */}
            <div>
              <Label className="text-base font-semibold mb-3 block">Duration</Label>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant={duration === 1 ? "default" : "outline"}
                  className="h-auto py-4"
                  onClick={() => setDuration(1)}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">1 Hour</div>
                    <div className="text-xs opacity-80">
                      {selectedSlot} -{" "}
                      {selectedSlot &&
                        `${(Number.parseInt(selectedSlot.split(":")[0]) + 1).toString().padStart(2, "0")}:${selectedSlot.split(":")[1]}`}
                    </div>
                  </div>
                </Button>
                <Button
                  variant={duration === 2 ? "default" : "outline"}
                  className="h-auto py-4"
                  onClick={() => setDuration(2)}
                >
                  <div className="text-center">
                    <div className="text-lg font-bold">2 Hours</div>
                    <div className="text-xs opacity-80">
                      {selectedSlot} -{" "}
                      {selectedSlot &&
                        `${(Number.parseInt(selectedSlot.split(":")[0]) + 2).toString().padStart(2, "0")}:${selectedSlot.split(":")[1]}`}
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            <Separator />

            {/* Equipment Selection */}
            {equipment.length > 0 && (
              <div>
                <Label className="text-base font-semibold mb-3 flex items-center gap-2">
                  <PackageIcon className="h-5 w-5 text-primary" />
                  Optional Equipment
                </Label>
                <div className="space-y-3">
                  {equipment.map((eq) => (
                    <div
                      key={eq.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={eq.id}
                          checked={selectedEquipment.includes(eq.name)}
                          onCheckedChange={() => toggleEquipment(eq.name)}
                          disabled={eq.qtyAvailable === 0}
                        />
                        <Label htmlFor={eq.id} className="cursor-pointer">
                          <div>
                            <p className="font-medium">{eq.name}</p>
                            {eq.qtyAvailable === 0 ? (
                              <p className="text-xs text-destructive">Not available</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {eq.qtyAvailable} of {eq.qtyTotal} available
                              </p>
                            )}
                          </div>
                        </Label>
                      </div>
                      {eq.qtyAvailable > 0 ? (
                        <Badge variant="secondary">{eq.qtyAvailable} left</Badge>
                      ) : (
                        <Badge variant="destructive">Out of stock</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Booking Summary */}
            <div className="bg-muted/50 rounded-xl p-4 space-y-2">
              <h4 className="font-semibold">Booking Summary</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facility</span>
                  <span className="font-medium">{facility.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{selectedDate?.toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Time</span>
                  <span className="font-medium">
                    {selectedSlot} ({duration}h)
                  </span>
                </div>
                {selectedEquipment.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Equipment</span>
                    <span className="font-medium">{selectedEquipment.length} items</span>
                  </div>
                )}
              </div>
            </div>

            {/* Confirm Button */}
            <Button onClick={handleBooking} className="w-full h-12 text-base" size="lg">
              Confirm Booking
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

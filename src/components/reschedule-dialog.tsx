"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { bookings, facilities } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"
import { Separator } from "@/components/ui/separator"

interface RescheduleDialogProps {
  bookingId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RescheduleDialog({ bookingId, open, onOpenChange }: RescheduleDialogProps) {
  const booking = bookings.find((b) => b.id === bookingId)
  const facility = booking ? facilities.find((f) => f.id === booking.facilityId) : null
  const [newDate, setNewDate] = useState<Date | undefined>(booking ? new Date(booking.date) : undefined)
  const [newTime, setNewTime] = useState(booking?.startTime || "")
  const { toast } = useToast()

  if (!booking || !facility) return null

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

  const handleReschedule = () => {
    if (!newDate || !newTime) return

    // Update booking (in real app, this would call an API)
    booking.date = newDate.toISOString().split("T")[0]
    booking.startTime = newTime

    const [hour, minute] = newTime.split(":").map(Number)
    const endHour = hour + booking.duration
    booking.endTime = `${endHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`

    toast({
      title: "Booking Rescheduled!",
      description: (
        <div className="mt-2 space-y-1">
          <p className="font-semibold">{facility.name}</p>
          <p className="text-sm">
            New time: {booking.date} at {booking.startTime}
          </p>
        </div>
      ),
    })

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Booking</DialogTitle>
          <DialogDescription>{facility.name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <label className="text-sm font-medium mb-3 block">Select New Date</label>
            <Calendar
              mode="single"
              selected={newDate}
              onSelect={setNewDate}
              disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              className="rounded-xl border"
            />
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium mb-3 block">Select New Time</label>
            <Select value={newTime} onValueChange={setNewTime}>
              <SelectTrigger>
                <SelectValue placeholder="Choose time slot" />
              </SelectTrigger>
              <SelectContent>
                {generateTimeSlots().map((slot) => (
                  <SelectItem key={slot} value={slot}>
                    {slot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-sm">Current Booking</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">{new Date(booking.date).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">
                  {booking.startTime} ({booking.duration}h)
                </span>
              </div>
            </div>
          </div>

          <Button onClick={handleReschedule} className="w-full" disabled={!newDate || !newTime}>
            Confirm Reschedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

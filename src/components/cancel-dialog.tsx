"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { bookings, facilities } from "@/lib/data"
import { useToast } from "@/hooks/use-toast"

interface CancelDialogProps {
  bookingId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CancelDialog({ bookingId, open, onOpenChange }: CancelDialogProps) {
  const booking = bookings.find((b) => b.id === bookingId)
  const facility = booking ? facilities.find((f) => f.id === booking.facilityId) : null
  const { toast } = useToast()

  if (!booking || !facility) return null

  const handleCancel = () => {
    // Update booking status (in real app, this would call an API)
    booking.status = "cancelled"

    toast({
      title: "Booking Cancelled",
      description: (
        <div className="mt-2 space-y-1">
          <p className="font-semibold">{facility.name}</p>
          <p className="text-sm">
            {booking.date} at {booking.startTime}
          </p>
        </div>
      ),
      variant: "destructive",
    })

    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel your booking for <strong>{facility.name}</strong> on{" "}
            <strong>{new Date(booking.date).toLocaleDateString()}</strong> at <strong>{booking.startTime}</strong>?
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, Cancel Booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

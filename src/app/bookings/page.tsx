"use client"

import { AuthGuard } from "@/components/auth-guard"
import { Navbar } from "@/components/navbar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { bookings, facilities } from "@/lib/data"
import { getUserEmail } from "@/lib/auth"
import { CalendarIcon, ClockIcon, MapPinIcon, EditIcon, XIcon, BellIcon } from "lucide-react"
import { useState } from "react"
import { RescheduleDialog } from "@/components/reschedule-dialog"
import { CancelDialog } from "@/components/cancel-dialog"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function BookingsPage() {
  const userEmail = getUserEmail()
  const userBookings = bookings.filter((b) => b.userEmail === userEmail && b.status === "confirmed")
  const [selectedBooking, setSelectedBooking] = useState<string | null>(null)
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false)
  const [isCancelOpen, setIsCancelOpen] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)

  const handleReschedule = (bookingId: string) => {
    setSelectedBooking(bookingId)
    setIsRescheduleOpen(true)
  }

  const handleCancel = (bookingId: string) => {
    setSelectedBooking(bookingId)
    setIsCancelOpen(true)
  }

  const canCancelBooking = (booking: (typeof bookings)[0]) => {
    const bookingDateTime = new Date(`${booking.date}T${booking.startTime}`)
    const now = new Date()
    const minutesUntilBooking = (bookingDateTime.getTime() - now.getTime()) / (1000 * 60)
    return minutesUntilBooking > 30 // 30 minutes cancellation window
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Bookings</h1>
            <p className="text-muted-foreground text-lg">View and manage your facility bookings</p>
          </div>

          {/* Push Notifications Toggle */}
          <Card className="mb-6 rounded-2xl shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BellIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label htmlFor="push-notifications" className="text-base font-semibold cursor-pointer">
                      Push Reminders
                    </Label>
                    <p className="text-sm text-muted-foreground">Get a reminder 2 hours before your booking</p>
                  </div>
                </div>
                <Switch id="push-notifications" checked={pushEnabled} onCheckedChange={setPushEnabled} />
              </div>
            </CardContent>
          </Card>

          {userBookings.length === 0 ? (
            <Card className="rounded-2xl shadow-md">
              <CardContent className="py-16 text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
                <p className="text-muted-foreground mb-6">Start by browsing available facilities</p>
                <Button asChild>
                  <a href="/">Browse Facilities</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <Card className="hidden md:block rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Upcoming Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Facility</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Equipment</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userBookings.map((booking) => {
                        const facility = facilities.find((f) => f.id === booking.facilityId)
                        const canCancel = canCancelBooking(booking)

                        return (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{facility?.name}</p>
                                <p className="text-sm text-muted-foreground">{facility?.location}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                {new Date(booking.date).toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-muted-foreground" />
                                {booking.startTime}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">{booking.duration}h</Badge>
                            </TableCell>
                            <TableCell>
                              {booking.equipment.length > 0 ? (
                                <div className="text-sm">{booking.equipment.join(", ")}</div>
                              ) : (
                                <span className="text-muted-foreground text-sm">None</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => handleReschedule(booking.id)}>
                                  <EditIcon className="h-4 w-4 mr-1" />
                                  Reschedule
                                </Button>
                                {canCancel ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleCancel(booking.id)}
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <XIcon className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled
                                    title="Cancellations are closed within 30 minutes of your booking start time"
                                  >
                                    <XIcon className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {userBookings.map((booking) => {
                  const facility = facilities.find((f) => f.id === booking.facilityId)
                  const canCancel = canCancelBooking(booking)

                  return (
                    <Card key={booking.id} className="rounded-2xl shadow-md">
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-bold text-lg mb-1">{facility?.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPinIcon className="h-4 w-4" />
                              {facility?.location}
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Date</p>
                              <div className="flex items-center gap-2 font-medium">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {new Date(booking.date).toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Time</p>
                              <div className="flex items-center gap-2 font-medium">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {booking.startTime}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Duration</p>
                              <Badge variant="secondary">{booking.duration} hours</Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Equipment</p>
                              <p className="font-medium">
                                {booking.equipment.length > 0 ? booking.equipment.length : "None"}
                              </p>
                            </div>
                          </div>

                          {booking.equipment.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Equipment Items</p>
                                <div className="flex flex-wrap gap-2">
                                  {booking.equipment.map((eq, idx) => (
                                    <Badge key={idx} variant="outline">
                                      {eq}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}

                          <Separator />

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              className="flex-1 bg-transparent"
                              onClick={() => handleReschedule(booking.id)}
                            >
                              <EditIcon className="h-4 w-4 mr-2" />
                              Reschedule
                            </Button>
                            {canCancel ? (
                              <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive bg-transparent"
                                onClick={() => handleCancel(booking.id)}
                              >
                                <XIcon className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            ) : (
                              <div className="flex-1">
                                <Button variant="outline" className="w-full bg-transparent" disabled>
                                  <XIcon className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1 text-center">Cancellations closed</p>
                              </div>
                            )}
                          </div>

                          {!canCancel && (
                            <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                              <AlertDescription className="text-xs">
                                Cancellations are closed within 30 minutes of your booking start time.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </main>

        {selectedBooking && (
          <>
            <RescheduleDialog bookingId={selectedBooking} open={isRescheduleOpen} onOpenChange={setIsRescheduleOpen} />
            <CancelDialog bookingId={selectedBooking} open={isCancelOpen} onOpenChange={setIsCancelOpen} />
          </>
        )}
      </div>
    </AuthGuard>
  )
}

// components/bookings-client.tsx
"use client";

import { useMemo, useState } from "react";
import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  EditIcon,
  XIcon,
  BellIcon,
} from "lucide-react";
import { RescheduleDialog } from "@/components/reschedule-dialog";
import { CancelDialog } from "@/components/cancel-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { BookingStatus } from "@prisma/client";
import { notify } from "@/lib/toast";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

type BookingForUI = {
  id: string;
  facilityId: string;
  facilityName: string;
  facilityLocation: string;
  facilityOpenTime: string | null;
  facilityCloseTime: string | null;
  start: string; // ISO
  end: string; // ISO
  durationHours: number;
  status: BookingStatus;
  equipmentNames: string[];
};

type ExistingBookingForDialog = {
  id: string;
  startISO: string;
  endISO: string;
  status: BookingStatus;
};

interface BookingsClientProps {
  bookings: BookingForUI[];
  onReschedule: (payload: {
    bookingId: string;
    newStartISO: string;
  }) => Promise<void>;
  onCancel: (payload: { bookingId: string }) => Promise<void>;
  loadExistingBookings: (payload: {
    bookingId: string;
  }) => Promise<ExistingBookingForDialog[]>;
}

export function BookingsClient({
  bookings,
  onReschedule,
  onCancel,
  loadExistingBookings,
}: BookingsClientProps) {
  const now = new Date();

  // Upcoming = future bookings that are not cancelled
  const upcomingBookings = bookings.filter((b) => {
    const startDate = new Date(b.start);
    return startDate >= now && b.status !== "cancelled";
  });

  // History = completed or cancelled
  const MAX_HISTORY = 100;

  const allPast = bookings
    .filter((b) => {
      const startDate = new Date(b.start);
      // show in history when booking is over or cancelled
      return startDate < now || b.status === "cancelled";
    })
    .sort((a, b) => {
      return new Date(b.start).getTime() - new Date(a.start).getTime();
    });

  const pastBookings =
    allPast.length > MAX_HISTORY ? allPast.slice(0, MAX_HISTORY) : allPast;

  // default show latest 5 in UI, with a Show all button
  const [historyLimit, setHistoryLimit] = useState(5);
  const visiblePastBookings =
    pastBookings.length > historyLimit
      ? pastBookings.slice(0, historyLimit)
      : pastBookings;

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    null
  );
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [existingForDialog, setExistingForDialog] = useState<
    ExistingBookingForDialog[]
  >([]);
  const [isLoadingExisting, setIsLoadingExisting] = useState(false);

  const selectedBookingObj = useMemo(
    () => bookings.find((b) => b.id === selectedBookingId) ?? null,
    [bookings, selectedBookingId]
  );

  // Shared 30 minute rule for both cancel and reschedule
  const canModifyBooking = (booking: BookingForUI) => {
    const bookingDateTime = new Date(booking.start);
    const now = new Date();
    const minutesUntilBooking =
      (bookingDateTime.getTime() - now.getTime()) / (1000 * 60);

    return minutesUntilBooking > 30;
  };

  const handleOpenReschedule = async (booking: BookingForUI) => {
    try {
      setIsLoadingExisting(true);
      const existing = await loadExistingBookings({ bookingId: booking.id });
      setExistingForDialog(existing);
      setSelectedBookingId(booking.id);
      setIsRescheduleOpen(true);
    } catch (err) {
      console.error(err);
      notify.error("Unable to load availability for reschedule.");
    } finally {
      setIsLoadingExisting(false);
    }
  };

  const handleConfirmReschedule = async (newStartISO: string) => {
    if (!selectedBookingObj) return;
    await onReschedule({
      bookingId: selectedBookingObj.id,
      newStartISO,
    });
  };

  const handleOpenCancel = (bookingId: string) => {
    setSelectedBookingId(bookingId);
    setIsCancelOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!selectedBookingObj) return;
    await onCancel({ bookingId: selectedBookingObj.id });
    notify.success("Booking cancelled");
  };

  const toggleHistoryLimit = () => {
    if (historyLimit === 5) {
      setHistoryLimit(50);
    } else {
      setHistoryLimit(5);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">My Bookings</h1>
            <p className="text-muted-foreground text-lg">
              View and manage your facility bookings
            </p>
          </div>

          {/* Push reminders card */}
          <Card className="mb-6 rounded-2xl shadow-md">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BellIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label
                      htmlFor="push-notifications"
                      className="text-base font-semibold cursor-pointer"
                    >
                      Push Reminders
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Get a reminder 2 hours before your booking
                    </p>
                  </div>
                </div>
                <Switch
                  id="push-notifications"
                  checked={pushEnabled}
                  onCheckedChange={setPushEnabled}
                />
              </div>
            </CardContent>
          </Card>

          {upcomingBookings.length === 0 ? (
            <Card className="rounded-2xl shadow-md">
              <CardContent className="py-16 text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <CalendarIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No bookings yet</h3>
                <p className="text-muted-foreground mb-6">
                  Start by browsing available facilities
                </p>
                <Button asChild>
                  <a href="/">Browse Facilities</a>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Upcoming desktop table */}
              <Card className="hidden md:block rounded-2xl shadow-md mb-8 overflow-x-auto">
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
                      {upcomingBookings.map((booking) => {
                        const start = new Date(booking.start);
                        const canModify = canModifyBooking(booking);

                        return (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {booking.facilityName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {booking.facilityLocation}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20 font-semibold"
                              >
                                {booking.durationHours}h
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {booking.equipmentNames.length > 0 ? (
                                <div className="text-sm">
                                  {booking.equipmentNames.join(", ")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenReschedule(booking)}
                                  disabled={isLoadingExisting || !canModify}
                                  title={
                                    !canModify
                                      ? "Changes are not allowed within 30 minutes of start time"
                                      : undefined
                                  }
                                >
                                  <EditIcon className="h-4 w-4 mr-1" />
                                  Reschedule
                                </Button>
                                {canModify ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCancel(booking.id)}
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
                                    title="Cancellations are not allowed within 30 minutes of start time"
                                  >
                                    <XIcon className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Upcoming mobile card view */}
              <div className="md:hidden space-y-4 mb-8">
                {upcomingBookings.map((booking) => {
                  const start = new Date(booking.start);
                  const canModify = canModifyBooking(booking);

                  return (
                    <Card
                      key={booking.id}
                      className="rounded-2xl shadow-md bg-card"
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div>
                            <h3 className="font-bold text-lg mb-1">
                              {booking.facilityName}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPinIcon className="h-4 w-4" />
                              {booking.facilityLocation}
                            </div>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Date</p>
                              <div className="flex items-center gap-2 font-medium">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Time</p>
                              <div className="flex items-center gap-2 font-medium">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Duration
                              </p>
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20 font-semibold"
                              >
                                {booking.durationHours}h
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Equipment
                              </p>
                              <p className="font-medium">
                                {booking.equipmentNames.length > 0
                                  ? booking.equipmentNames.join(", ")
                                  : "None"}
                              </p>
                            </div>
                          </div>

                          {booking.equipmentNames.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Equipment Items
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {booking.equipmentNames.map((eq, idx) => (
                                    <Badge
                                      key={idx}
                                      className="bg-primary/10 text-primary border-primary/20 font-medium"
                                    >
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
                              onClick={() => handleOpenReschedule(booking)}
                              disabled={isLoadingExisting || !canModify}
                            >
                              <EditIcon className="h-4 w-4 mr-2" />
                              Reschedule
                            </Button>
                            {canModify ? (
                              <Button
                                variant="outline"
                                className="flex-1 text-destructive hover:text-destructive bg-transparent"
                                onClick={() => handleOpenCancel(booking.id)}
                              >
                                <XIcon className="h-4 w-4 mr-2" />
                                Cancel
                              </Button>
                            ) : (
                              <div className="flex-1">
                                <Button
                                  variant="outline"
                                  className="w-full bg-transparent"
                                  disabled
                                >
                                  <XIcon className="h-4 w-4 mr-2" />
                                  Cancel
                                </Button>
                                <p className="text-xs text-muted-foreground mt-1 text-center">
                                  Changes closed
                                </p>
                              </div>
                            )}
                          </div>

                          {!canModify && (
                            <Alert className="bg-destructive/10 border-destructive/20 mt-2">
                              <AlertDescription className="text-xs">
                                You cannot reschedule or cancel within 30
                                minutes of your booking start time.
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* separation before history */}
          {pastBookings.length > 0 && (
            <div className="mt-10 mb-4 border-t border-border/60" />
          )}

          {/* Booking history */}
          {pastBookings.length > 0 && (
            <section className="space-y-4">
              {/* Desktop history table */}
              <Card className="hidden md:block rounded-2xl shadow-md overflow-x-auto">
                <CardHeader className="flex items-center justify-between">
                  <CardTitle>Booking History</CardTitle>
                  {pastBookings.length > 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleHistoryLimit}
                    >
                      {historyLimit === 5 ? "Show all history" : "Show less"}
                    </Button>
                  )}
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
                        <TableHead className="text-right">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visiblePastBookings.map((booking) => {
                        const start = new Date(booking.start);

                        const statusLabel =
                          booking.status === "cancelled"
                            ? "Cancelled"
                            : "Completed";

                        const statusClass =
                          booking.status === "cancelled"
                            ? "bg-red-500/10 text-red-500 border-red-500/20"
                            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

                        return (
                          <TableRow key={booking.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">
                                  {booking.facilityName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {booking.facilityLocation}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20 font-semibold"
                              >
                                {booking.durationHours}h
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {booking.equipmentNames.length > 0 ? (
                                <div className="text-sm">
                                  {booking.equipmentNames.join(", ")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  None
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                variant="secondary"
                                className={statusClass}
                              >
                                {statusLabel}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile history header and cards */}
              {/* Mobile only header */}
              <h2 className="md:hidden text-xl font-semibold mt-2 mb-1">
                History
              </h2>

              <div className="md:hidden space-y-4">
                {visiblePastBookings.map((booking) => {
                  const start = new Date(booking.start);

                  const statusLabel =
                    booking.status === "cancelled" ? "Cancelled" : "Completed";

                  const statusClass =
                    booking.status === "cancelled"
                      ? "bg-red-500/10 text-red-500 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";

                  return (
                    <Card
                      key={booking.id}
                      className="rounded-2xl shadow-md bg-card"
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-bold text-lg mb-1">
                                {booking.facilityName}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPinIcon className="h-4 w-4" />
                                {booking.facilityLocation}
                              </div>
                            </div>
                            <Badge variant="secondary" className={statusClass}>
                              {statusLabel}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">Date</p>
                              <div className="flex items-center gap-2 font-medium">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Time</p>
                              <div className="flex items-center gap-2 font-medium">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {start.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Duration
                              </p>
                              <Badge
                                variant="secondary"
                                className="bg-primary/10 text-primary border-primary/20 font-semibold"
                              >
                                {booking.durationHours}h
                              </Badge>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Equipment
                              </p>
                              <p className="font-medium">
                                {booking.equipmentNames.length > 0
                                  ? booking.equipmentNames.join(", ")
                                  : "None"}
                              </p>
                            </div>
                          </div>

                          {booking.equipmentNames.length > 0 && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground mb-2">
                                  Equipment Items
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {booking.equipmentNames.map((eq, idx) => (
                                    <Badge
                                      key={idx}
                                      className="bg-primary/10 text-primary border-primary/20 font-medium"
                                    >
                                      {eq}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {pastBookings.length > 5 && (
                  <div className="flex justify-center mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={toggleHistoryLimit}
                    >
                      {historyLimit === 5
                        ? "Show all history"
                        : "Show less history"}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          )}
        </main>

        {/* Dialogs */}
        {selectedBookingObj && (
          <>
            <RescheduleDialog
              booking={{
                id: selectedBookingObj.id,
                facilityId: selectedBookingObj.facilityId,
                facilityName: selectedBookingObj.facilityName,
                startISO: selectedBookingObj.start,
                endISO: selectedBookingObj.end,
                durationHours: selectedBookingObj.durationHours,
                facilityOpenTime: selectedBookingObj.facilityOpenTime,
                facilityCloseTime: selectedBookingObj.facilityCloseTime,
              }}
              existingBookings={existingForDialog}
              open={isRescheduleOpen}
              onOpenChange={(open) => {
                setIsRescheduleOpen(open);
                if (!open) {
                  setSelectedBookingId(null);
                  setExistingForDialog([]);
                }
              }}
              onConfirm={handleConfirmReschedule}
            />

            <CancelDialog
              booking={{
                id: selectedBookingObj.id,
                facilityName: selectedBookingObj.facilityName,
                startISO: selectedBookingObj.start,
              }}
              open={isCancelOpen}
              onOpenChange={(open) => {
                setIsCancelOpen(open);
                if (!open) {
                  setSelectedBookingId(null);
                }
              }}
              onConfirm={handleConfirmCancel}
            />
          </>
        )}
      </div>
    </AuthGuard>
  );
}

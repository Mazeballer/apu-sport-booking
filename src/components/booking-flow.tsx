// components/booking-flow.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeftIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  PackageIcon,
} from "lucide-react";
import Image from "next/image";
import { notify } from "@/lib/toast";

type BookingUI = {
  id: string;
  facilityId: string;
  courtId: string;
  start: string | Date;
  end: string | Date;
  status: "confirmed" | "cancelled" | "rescheduled";
};

interface BookingFlowProps {
  facility: {
    id: string;
    name: string;
    type: string;
    location: string;
    locationType: string;
    description?: string | null;
    capacity?: number | null;
    photos?: string[];
    openTime?: string | null;
    closeTime?: string | null;
    rules?: string[] | string | null;
    courts: { id: string; name: string }[];
  };
  equipment: {
    id: string;
    name: string;
    qtyAvailable: number;
    qtyTotal: number;
  }[];
  existingBookings: BookingUI[];
  onCreateBooking: (payload: {
    facilityId: string;
    courtId: string;
    date: string; // "YYYY-MM-DD" Malaysia date
    time: string; // "HH:mm"
    durationHours: 1 | 2;
    equipmentIds: string[];
    notes?: string;
  }) => Promise<void>;
}

export function BookingFlow({
  facility,
  equipment,
  existingBookings,
  onCreateBooking,
}: BookingFlowProps) {
  const router = useRouter();

  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedDuration, setSelectedDuration] = useState<1 | 2>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [selectedCourt, setSelectedCourt] = useState<string>();
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [equipmentNotes, setEquipmentNotes] = useState("");
  const [showLayoutDialog, setShowLayoutDialog] = useState(false);
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [layoutImage, setLayoutImage] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);

  const facilityEquipment = equipment;

  const getCurrentStep = () => {
    if (!selectedDate) return 1;
    if (!selectedDuration) return 2;
    if (!selectedTime) return 3;
    if (!selectedCourt) return 4;
    return 5;
  };
  const currentStep = getCurrentStep();

  const baseTimeSlots = useMemo(() => {
    const slots: string[] = [];
    const startH = Number((facility.openTime ?? "07:00").split(":")[0]);
    const endH = Number((facility.closeTime ?? "22:00").split(":")[0]);
    for (let h = startH; h < endH; h += 1) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
    return slots;
  }, [facility.openTime, facility.closeTime]);

  const selectableTimeSlots = useMemo(() => {
    if (!selectedDuration) return baseTimeSlots;

    const endH = Number((facility.closeTime ?? "22:00").split(":")[0]);
    const latestStartHour = endH - selectedDuration;

    return baseTimeSlots.filter((time) => {
      const hour = Number(time.split(":")[0]);
      return hour <= latestStartHour;
    });
  }, [baseTimeSlots, selectedDuration, facility.closeTime]);

  const buildDateAtTime = (date: Date, hhmm: string) => {
    const [hh, mm] = hhmm.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const addHours = (d: Date, hours: number) => {
    const x = new Date(d);
    x.setHours(x.getHours() + hours);
    return x;
  };

  const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
    aStart < bEnd && aEnd > bStart;

  const dayBookings = useMemo(() => {
    if (!selectedDate) return [];
    const y = selectedDate.getFullYear();
    const m = selectedDate.getMonth();
    const d = selectedDate.getDate();
    return existingBookings.filter((b) => {
      if (b.status === "cancelled") return false;
      const s = new Date(b.start);
      return s.getFullYear() === y && s.getMonth() === m && s.getDate() === d;
    });
  }, [existingBookings, selectedDate]);

  const isSlotFullyBooked = (slot: string) => {
    if (!selectedDate || !selectedDuration) return false;
    const slotStart = buildDateAtTime(selectedDate, slot);
    const slotEnd = addHours(slotStart, selectedDuration);

    const freeCourtExists = facility.courts.some((c) => {
      const clashes = dayBookings.some(
        (b) =>
          b.courtId === c.id &&
          overlaps(slotStart, slotEnd, new Date(b.start), new Date(b.end))
      );
      return !clashes;
    });
    return !freeCourtExists;
  };

  const courtStatusForSelectedTime = useMemo(() => {
    if (!selectedDate || !selectedDuration || !selectedTime) return {};
    const slotStart = buildDateAtTime(selectedDate, selectedTime);
    const slotEnd = addHours(slotStart, selectedDuration);
    const currentHour = new Date().getHours();
    const isToday = selectedDate.toDateString() === new Date().toDateString();

    const status: Record<string, "available" | "unavailable"> = {};

    facility.courts.forEach((c) => {
      if (isToday && slotStart.getHours() < currentHour) {
        status[c.id] = "unavailable";
        return;
      }
      const clash = dayBookings.some(
        (b) =>
          b.courtId === c.id &&
          overlaps(slotStart, slotEnd, new Date(b.start), new Date(b.end))
      );
      status[c.id] = clash ? "unavailable" : "available";
    });
    return status;
  }, [
    facility.courts,
    dayBookings,
    selectedDate,
    selectedDuration,
    selectedTime,
  ]);

  const generateAvailabilityData = () => {
    if (!selectedDate) return [];

    const effectiveDuration = selectedDuration ?? 1;

    return facility.courts.map((court) => {
      const availability: Record<string, "available" | "unavailable"> = {};
      const now = new Date();
      const isToday = selectedDate.toDateString() === now.toDateString();
      const nowHour = now.getHours();

      baseTimeSlots.forEach((slot) => {
        const start = buildDateAtTime(selectedDate, slot);
        const end = addHours(start, effectiveDuration);

        const clash = dayBookings.some(
          (b) =>
            b.courtId === court.id &&
            overlaps(start, end, new Date(b.start), new Date(b.end))
        );

        if (isToday && start.getHours() < nowHour) {
          availability[slot] = "unavailable";
        } else {
          availability[slot] = clash ? "unavailable" : "available";
        }
      });

      return {
        courtId: court.id,
        courtName: court.name,
        availability,
      };
    });
  };

  const handleConfirmBooking = async () => {
    if (!selectedDate || !selectedDuration || !selectedTime || !selectedCourt)
      return;

    setIsConfirming(true);
    try {
      const date = selectedDate.toLocaleDateString("en-CA"); // YYYY-MM-DD
      const time = selectedTime; // already "HH:mm"

      await onCreateBooking({
        facilityId: facility.id,
        courtId: selectedCourt,
        date,
        time,
        durationHours: selectedDuration,
        equipmentIds: selectedEquipment,
        notes: equipmentNotes || undefined,
      });

      notify.success(
        `Booking confirmed for ${
          facility.name
        } on ${selectedDate.toLocaleDateString()} at ${selectedTime}`
      );

      router.push("/");
    } catch (err: any) {
      const msg =
        typeof err?.message === "string" && err.message.trim().length > 0
          ? err.message
          : "Booking failed. Please try again.";

      notify.error(msg);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleViewLayout = () => {
    const layout = facility.photos?.[1] ?? facility.photos?.[0] ?? "";
    setLayoutImage(layout);
    setShowLayoutDialog(true);
  };

  const toggleEquipment = (equipmentId: string) => {
    setSelectedEquipment((prev) =>
      prev.includes(equipmentId)
        ? prev.filter((id) => id !== equipmentId)
        : [...prev, equipmentId]
    );
  };

  const steps = [
    { number: 1, label: "Select Date", icon: CalendarIcon },
    { number: 2, label: "Choose Duration", icon: ClockIcon },
    { number: 3, label: "Pick Time Slot", icon: ClockIcon },
    { number: 4, label: "Select Court", icon: MapPinIcon },
    { number: 5, label: "Add Equipment", icon: PackageIcon },
  ];

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="mb-6 transition-all duration-200 hover:scale-105 active:scale-95"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-2" />
        Back to Facility
      </Button>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Steps rail */}
        <div className="hidden lg:block lg:w-64 flex-shrink-0">
          <Card className="rounded-2xl shadow-lg sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Booking Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {steps.map((step, index) => {
                  const isCompleted = currentStep > step.number;
                  const isCurrent = currentStep === step.number;
                  const Icon = step.icon;
                  return (
                    <div key={step.number} className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                            isCompleted
                              ? "bg-primary border-primary text-primary-foreground"
                              : isCurrent
                              ? "border-primary text-primary bg-primary/10"
                              : "border-muted-foreground/30 text-muted-foreground"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckIcon className="h-5 w-5" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`w-0.5 h-12 mt-2 ${
                              isCompleted
                                ? "bg-primary"
                                : "bg-muted-foreground/20"
                            }`}
                          />
                        )}
                      </div>
                      <div className="pt-2">
                        <p
                          className={`text-sm font-medium ${
                            isCurrent
                              ? "text-foreground"
                              : isCompleted
                              ? "text-muted-foreground"
                              : "text-muted-foreground/60"
                          }`}
                        >
                          {step.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex-1 space-y-6">
          {/* Step 1: date */}
          <Card
            className={`rounded-2xl shadow-lg transition-all ${
              currentStep === 1 ? "ring-2 ring-primary" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Pick a date</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose a date for your booking
                    </p>
                  </div>
                </div>
                {selectedDate && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setShowAvailabilityDialog(true)}
                    className="text-primary transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    View Live Availability
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {selectedDate ? (
                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Selected Date
                    </p>
                    <p className="font-semibold">
                      {selectedDate.toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(undefined)}
                    className="transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={(date) =>
                      date < new Date(new Date().setHours(0, 0, 0, 0))
                    }
                    className="rounded-md border"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: duration */}
          <Card
            className={`rounded-2xl shadow-lg transition-all ${
              currentStep === 2
                ? "ring-2 ring-primary"
                : currentStep < 2
                ? "opacity-60"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClockIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Select Duration</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    How long do you need the facility
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[1, 2].map((h) => (
                  <Button
                    key={h}
                    variant={selectedDuration === h ? "default" : "outline"}
                    onClick={() => setSelectedDuration(h as 1 | 2)}
                    disabled={currentStep < 2}
                    className="h-20 transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                  >
                    <div className="text-center">
                      <div className="text-2xl font-bold">{h}</div>
                      <div className="text-xs">
                        {h === 1 ? "hour" : "hours"}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: time */}
          <Card
            className={`rounded-2xl shadow-lg transition-all ${
              currentStep === 3
                ? "ring-2 ring-primary"
                : currentStep < 3
                ? "opacity-60"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <ClockIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Select Time Slot</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Choose your preferred start time
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                {selectableTimeSlots.map((time) => {
                  const booked = selectedDuration
                    ? isSlotFullyBooked(time)
                    : false;
                  return (
                    <Button
                      key={time}
                      variant={selectedTime === time ? "default" : "outline"}
                      onClick={() => !booked && setSelectedTime(time)}
                      disabled={booked || currentStep < 3}
                      className="h-16 transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                    >
                      <div className="text-center">
                        <div className="font-semibold">{time}</div>
                        {booked && (
                          <div className="text-xs text-muted-foreground">
                            Fully booked
                          </div>
                        )}
                      </div>
                    </Button>
                  );
                })}
              </div>

              {currentStep === 3 &&
                selectedDuration &&
                selectableTimeSlots.length === 0 && (
                  <p className="mt-3 text-sm text-muted-foreground">
                    No valid start times available for this duration. Please
                    choose another day or a shorter duration.
                  </p>
                )}
            </CardContent>
          </Card>

          {/* Step 4: court */}
          <Card
            className={`rounded-2xl shadow-lg transition-all ${
              currentStep === 4
                ? "ring-2 ring-primary"
                : currentStep < 4
                ? "opacity-60"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <MapPinIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Select Court</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose an available court
                    </p>
                  </div>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  onClick={handleViewLayout}
                  disabled={currentStep < 4}
                  className="text-primary transition-all duration-200 hover:scale-105 active:scale-95 disabled:hover:scale-100"
                >
                  View Layout
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
                {facility.courts.map((court) => {
                  const status =
                    courtStatusForSelectedTime[court.id] ?? "unavailable";
                  const isAvailable = status === "available";
                  return (
                    <div
                      key={court.id}
                      className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 ${
                        selectedCourt === court.id
                          ? "border-primary bg-primary/5 scale-[1.02]"
                          : isAvailable && currentStep >= 4
                          ? "border-border hover:border-primary/50 hover:scale-[1.02]"
                          : "border-border opacity-50 cursor-not-allowed"
                      } active:scale-95`}
                      onClick={() =>
                        isAvailable &&
                        currentStep >= 4 &&
                        setSelectedCourt(court.id)
                      }
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{court.name}</h4>
                        <Badge
                          variant={isAvailable ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {isAvailable ? "Available" : "Unavailable"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Step 5: equipment */}
          <Card
            className={`rounded-2xl shadow-lg transition-all ${
              currentStep === 5
                ? "ring-2 ring-primary"
                : currentStep < 5
                ? "opacity-60"
                : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <PackageIcon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">Optional Equipment</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Select any equipment you need
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                {facilityEquipment.map((eq) => (
                  <div
                    key={eq.id}
                    className="flex items-center justify-between p-4 border rounded-xl hover:border-primary/50 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={eq.id}
                        checked={selectedEquipment.includes(eq.id)}
                        onCheckedChange={() => toggleEquipment(eq.id)}
                        disabled={eq.qtyAvailable === 0 || currentStep < 5}
                      />
                      <Label htmlFor={eq.id} className="cursor-pointer">
                        <p className="font-semibold">{eq.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {eq.qtyAvailable} of {eq.qtyTotal} available
                        </p>
                      </Label>
                    </div>
                    <Badge
                      variant={eq.qtyAvailable > 0 ? "default" : "secondary"}
                      className={
                        eq.qtyAvailable > 0
                          ? "bg-green-500 hover:bg-green-600 text-white"
                          : "bg-gray-200 text-gray-600"
                      }
                    >
                      {eq.qtyAvailable > 0 ? "Available" : "Out of Stock"}
                    </Badge>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="equipment-notes">
                  Additional Notes (Optional)
                </Label>
                <Textarea
                  id="equipment-notes"
                  placeholder="Add any special requests or notes about equipment..."
                  value={equipmentNotes}
                  onChange={(e) => setEquipmentNotes(e.target.value)}
                  disabled={currentStep < 5}
                  className="min-h-24 resize-none transition-all duration-200 focus:scale-[1.01]"
                />
              </div>

              {currentStep === 5 && (
                <>
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Booking Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date:</span>
                        <span className="font-semibold">
                          {selectedDate?.toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-semibold">{selectedTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration:</span>
                        <span className="font-semibold">
                          {selectedDuration} hour(s)
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Court:</span>
                        <span className="font-semibold">
                          {
                            facility.courts.find((c) => c.id === selectedCourt)
                              ?.name
                          }
                        </span>
                      </div>
                      {selectedEquipment.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Equipment:
                          </span>
                          <span className="font-semibold">
                            {selectedEquipment.length} item(s)
                          </span>
                        </div>
                      )}
                      {equipmentNotes && (
                        <div className="pt-2 border-t">
                          <span className="text-muted-foreground">Notes:</span>
                          <p className="text-sm mt-1">{equipmentNotes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleConfirmBooking}
                    disabled={isConfirming}
                    className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
                    size="lg"
                  >
                    <CheckIcon className="h-4 w-4 mr-2" />
                    {isConfirming ? "Confirming..." : "Confirm Booking"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Layout Dialog */}
      <Dialog open={showLayoutDialog} onOpenChange={setShowLayoutDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Court Layout</DialogTitle>
          </DialogHeader>
          <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
            <Image
              src={layoutImage || "/placeholder.svg"}
              alt="Court Layout"
              fill
              className="object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Live availability by court and slot */}
      <Dialog
        open={showAvailabilityDialog}
        onOpenChange={setShowAvailabilityDialog}
      >
        <DialogContent className="!max-w-none w-[80vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 md:p-6 border-b">
            <div className="flex-1">
              <DialogTitle className="text-2xl md:text-4xl font-bold">
                {facility.name}
              </DialogTitle>
              <button
                onClick={() => {
                  setShowAvailabilityDialog(false);
                  setSelectedDate(undefined);
                }}
                className="flex items-center gap-2 mt-2 hover:text-primary transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <CalendarIcon className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
                <p className="text-sm md:text-base text-muted-foreground hover:text-primary">
                  {selectedDate?.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </button>
            </div>
          </div>

          <div className="p-4 md:p-8 space-y-4 md:space-y-6 overflow-y-auto max-h-[calc(95vh-140px)]">
            <div className="flex items-center gap-3 md:gap-6 text-xs md:text-sm">
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-border bg-background rounded" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2">
                <div className="w-3 h-3 md:w-4 md:h-4 bg-primary rounded" />
                <span>Unavailable</span>
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto overflow-y-visible scrollbar-thin">
                <div className="inline-block min-w-full">
                  <div className="flex border-b bg-muted/50">
                    <div className="w-24 md:w-40 flex-shrink-0 p-2 md:p-3 font-semibold border-r sticky left-0 bg-muted/50 z-10 text-xs md:text-sm">
                      Court
                    </div>
                    {baseTimeSlots.map((slot) => (
                      <div
                        key={slot}
                        className="w-16 md:w-24 flex-shrink-0 p-1.5 md:p-2 text-center font-medium text-xs"
                      >
                        {slot}
                      </div>
                    ))}
                  </div>

                  {generateAvailabilityData().map((courtData) => (
                    <div
                      key={courtData.courtId}
                      className="flex border-b last:border-b-0 hover:bg-muted/30"
                    >
                      <div className="w-24 md:w-40 flex-shrink-0 p-2 md:p-3 font-medium border-r sticky left-0 bg-background z-10 text-xs md:text-sm flex items-center">
                        {courtData.courtName}
                      </div>
                      {baseTimeSlots.map((slot) => {
                        const status = courtData.availability[slot];
                        return (
                          <div
                            key={slot}
                            className={`w-16 md:w-24 h-10 md:h-14 flex-shrink-0 border-r last:border-r-0 transition-all duration-200 ${
                              status === "unavailable"
                                ? "bg-primary"
                                : "bg-background hover:bg-accent/50 cursor-pointer hover:scale-105"
                            }`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Button
              onClick={() => setShowAvailabilityDialog(false)}
              className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
              size="lg"
            >
              Select this date
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// components/reschedule-dialog.tsx
"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { notify } from "@/lib/toast";

type ExistingBooking = {
  id: string;
  startISO: string;
  endISO: string;
  status: "confirmed" | "cancelled" | "rescheduled";
};

interface RescheduleDialogProps {
  booking: {
    id: string;
    facilityId: string;
    facilityName: string;
    startISO: string;
    endISO: string;
    durationHours: number;
    facilityOpenTime?: string | null;
    facilityCloseTime?: string | null;
  } | null;
  existingBookings: ExistingBooking[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (newStartISO: string) => Promise<void>;
}

export function RescheduleDialog({
  booking,
  existingBookings,
  open,
  onOpenChange,
  onConfirm,
}: RescheduleDialogProps) {
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState<string>("");
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!booking || !open) return;

    const start = new Date(booking.startISO);
    setNewDate(start);

    const hours = String(start.getHours()).padStart(2, "0");
    // dialog only supports whole hours now
    setNewTime(`${hours}:00`);
  }, [booking, open]);

  if (!booking) return null;

  const openTime = booking.facilityOpenTime ?? "07:00";
  const closeTime = booking.facilityCloseTime ?? "22:00";

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

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
    aStart < bEnd && aEnd > bStart;

  // Whole hour slots, trimmed so end does not pass closing time
  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    const [startHour] = openTime.split(":").map(Number);
    const [endHour] = closeTime.split(":").map(Number);

    const latestStartHour = endHour - booking.durationHours;

    for (let hour = startHour; hour <= latestStartHour; hour += 1) {
      slots.push(`${hour.toString().padStart(2, "0")}:00`);
    }

    return slots;
  }, [openTime, closeTime, booking.durationHours]);

  // Only show free slots
  const availableSlots = useMemo(() => {
    if (!newDate) return [];

    const now = new Date();
    const isToday = sameDay(newDate, now);

    // Build a Date for the facility closing time on the selected day
    const closeDateTime = buildDateAtTime(newDate, closeTime);

    return timeSlots.filter((slot) => {
      const slotStart = buildDateAtTime(newDate, slot);

      // no past slots today
      if (isToday && slotStart <= now) {
        return false;
      }

      const slotEnd = addHours(slotStart, booking.durationHours);

      // do not allow slots that would end after closing time
      if (slotEnd > closeDateTime) {
        return false;
      }

      const clash = existingBookings.some((b) => {
        if (b.status === "cancelled") return false;

        const bStart = new Date(b.startISO);
        const bEnd = new Date(b.endISO);
        if (!sameDay(slotStart, bStart)) return false;

        return overlaps(slotStart, slotEnd, bStart, bEnd);
      });

      return !clash;
    });
  }, [timeSlots, newDate, booking.durationHours, existingBookings, closeTime]);

  const handleReschedule = async () => {
    if (!newDate || !newTime) return;

    const [hh, mm] = newTime.split(":").map(Number);
    const start = new Date(newDate);
    start.setHours(hh, mm, 0, 0);

    setIsConfirming(true);
    try {
      await onConfirm(start.toISOString());

      notify.success(
        `${
          booking.facilityName
        } rescheduled to ${start.toLocaleDateString()} at ${newTime}`
      );

      onOpenChange(false);
    } catch (err) {
      console.error(err);
      notify.error("Unable to reschedule. Please try a different time.");
    } finally {
      setIsConfirming(false);
    }
  };

  const originalStart = new Date(booking.startISO);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:w-full sm:max-w-md max-h-[90vh] p-4 sm:p-6 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
          <DialogDescription>{booking.facilityName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 sm:space-y-6 sm:py-4">
          <div>
            <label className="text-sm font-medium mb-3 block">
              Select new date
            </label>
            <Calendar
              mode="single"
              selected={newDate}
              onSelect={setNewDate}
              disabled={(date) =>
                date < new Date(new Date().setHours(0, 0, 0, 0))
              }
              className="rounded-xl border max-w-full"
            />
          </div>

          <Separator />

          <div>
            <label className="text-sm font-medium mb-3 block">
              Select new time
            </label>
            <Select value={newTime} onValueChange={setNewTime}>
              <SelectTrigger className="border-3 border-primary/20 focus:border-primary shadow-sm transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
                <SelectValue placeholder="Choose time slot" />
              </SelectTrigger>
              <SelectContent>
                {availableSlots.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    No available times on this date
                  </div>
                ) : (
                  availableSlots.map((slot) => (
                    <SelectItem
                      key={slot}
                      value={slot}
                      className="transition-all duration-200 cursor-pointer"
                    >
                      {slot}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/50 rounded-xl p-4 space-y-2">
            <h4 className="font-semibold text-sm">Current booking</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {originalStart.toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">
                  {originalStart.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  ({booking.durationHours}h)
                </span>
              </div>
            </div>
          </div>

          <Button
            onClick={handleReschedule}
            className="w-full transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:hover:scale-100"
            disabled={!newDate || !newTime || isConfirming}
          >
            {isConfirming ? "Confirming..." : "Confirm reschedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

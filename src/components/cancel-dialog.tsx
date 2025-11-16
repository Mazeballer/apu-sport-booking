"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { notify } from "@/lib/toast";

interface CancelDialogProps {
  booking: {
    id: string;
    facilityName: string;
    startISO: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Parent will call server action or API here
  onConfirm: () => Promise<void>;
}

export function CancelDialog({
  booking,
  open,
  onOpenChange,
  onConfirm,
}: CancelDialogProps) {
  if (!booking) return null;

  const start = new Date(booking.startISO);

  const handleCancel = async () => {
    try {
      await onConfirm();

      const date = start.toLocaleDateString();
      const time = start.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });

      onOpenChange(false);
    } catch (err) {
      console.error(err);
      notify.error("Please try again later.");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel booking?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel your booking for{" "}
            <strong>{booking.facilityName}</strong> on{" "}
            <strong>{start.toLocaleDateString()}</strong> at{" "}
            <strong>
              {start.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </strong>
            ?
            <br />
            <br />
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCancel}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Yes, cancel booking
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

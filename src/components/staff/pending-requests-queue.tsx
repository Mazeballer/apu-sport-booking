"use client";

import * as React from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  PackageIcon,
  CalendarIcon,
  MapPinIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
import { notify } from "@/lib/toast";
import {
  approveEquipmentRequest,
  denyEquipmentRequest,
} from "@/app/(protected)/staff/actions";

export type PendingRequest = {
  id: string;
  userEmail: string;
  equipmentName: string;
  facilityName: string;
  requestDate: string;
  notes: string | null;
};

type PendingRequestsQueueProps = {
  initialRequests: PendingRequest[];
};

export function PendingRequestsQueue({
  initialRequests,
}: PendingRequestsQueueProps) {
  const router = useRouter();
  const [pendingRequests, setPendingRequests] =
    React.useState<PendingRequest[]>(initialRequests);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);

  // useTransition so React knows this is a non urgent update
  const [isPending, startTransition] = useTransition();

  const handleApprove = (requestId: string) => {
    const request = pendingRequests.find((r) => r.id === requestId);
    if (!request) return;

    startTransition(async () => {
      try {
        setLoadingId(requestId);

        await approveEquipmentRequest(requestId);

        // Optimistic update on the client side
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
        notify.success("Equipment request approved");
        router.refresh();
      } catch (error) {
        console.error(error);
        notify.error("Could not approve this request. Please try again.");
      } finally {
        setLoadingId(null);
      }
    });
  };

  const handleDeny = (requestId: string) => {
    const request = pendingRequests.find((r) => r.id === requestId);
    if (!request) return;

    startTransition(async () => {
      try {
        setLoadingId(requestId);

        await denyEquipmentRequest(requestId);

        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

        notify.info("Equipment request denied");
        router.refresh();
      } catch (error) {
        console.error(error);

        notify.error("Could not deny this request. Please try again.");
      } finally {
        setLoadingId(null);
      }
    });
  };

  const isRowDisabled = (id: string) => loadingId === id || isPending;

  if (pendingRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <CheckIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">All caught up</h3>
        <p className="text-muted-foreground">
          No pending equipment requests at the moment.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Request date</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pendingRequests.map((request) => (
              <TableRow key={request.id}>
                <TableCell>
                  <div className="font-medium">{request.userEmail}</div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <PackageIcon className="h-4 w-4 text-primary" />
                    <span className="font-medium">{request.equipmentName}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {" "}
                  <div className="flex items-center gap-2">
                    <MapPinIcon className="h-4 w-4 text-primary" />
                    <p className="font-medium">{request.facilityName}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {new Date(request.requestDate).toLocaleDateString()}
                  </div>
                </TableCell>
                <TableCell>
                  {request.notes ? (
                    <span className="text-sm text-muted-foreground">
                      {request.notes}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      No notes
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRowDisabled(request.id)}
                      onClick={() => handleApprove(request.id)}
                      className="text-green-600 hover:text-green-700"
                    >
                      <CheckIcon className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isRowDisabled(request.id)}
                      onClick={() => handleDeny(request.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <XIcon className="h-4 w-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {pendingRequests.map((request) => (
          <Card key={request.id} className="p-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <PackageIcon className="h-5 w-5 text-primary" />
                  <h3 className="font-bold">{request.equipmentName}</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  {request.facilityName}
                </p>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Student</span>
                  <span className="font-medium">{request.userEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Request date</span>
                  <span className="font-medium">
                    {new Date(request.requestDate).toLocaleDateString()}
                  </span>
                </div>
                {request.notes && (
                  <div>
                    <span className="text-muted-foreground">Notes</span>
                    <p className="mt-1">{request.notes}</p>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-green-600 hover:text-green-700 bg-transparent"
                  disabled={isRowDisabled(request.id)}
                  onClick={() => handleApprove(request.id)}
                >
                  <CheckIcon className="h-4 w-4 mr-2" />
                  Approve
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-destructive hover:text-destructive bg-transparent"
                  disabled={isRowDisabled(request.id)}
                  onClick={() => handleDeny(request.id)}
                >
                  <XIcon className="h-4 w-4 mr-2" />
                  Deny
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

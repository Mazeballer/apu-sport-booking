// components/view-equipment-status.tsx
"use client";

import { AuthGuard } from "@/components/auth-guard";
import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageIcon, CalendarIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import type { EquipReqStatus } from "@prisma/client";
import type { EquipmentRequestForUI } from "@/app/(protected)/equipment-requests/page";

const statusColors: Record<EquipReqStatus, string> = {
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-700 border-green-500/20",
  denied: "bg-red-500/10 text-red-700 border-red-500/20",
  done: "bg-blue-500/10 text-blue-700 border-blue-500/20",
};

interface EquipmentRequestsClientProps {
  requests: EquipmentRequestForUI[];
}

export function EquipmentRequestsClient({
  requests,
}: EquipmentRequestsClientProps) {
  const hasRequests = requests.length > 0;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-background">
        <Navbar />

        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Equipment Requests</h1>
            <p className="text-muted-foreground text-lg">
              Track your equipment rental requests and their status
            </p>
          </div>

          {!hasRequests ? (
            <Card className="rounded-2xl shadow-md">
              <CardContent className="py-16 text-center">
                <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
                  <PackageIcon className="w-12 h-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">
                  No equipment requests
                </h3>
                <p className="text-muted-foreground">
                  You can request equipment when booking a facility or from the
                  equipment desk
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Desktop Table View */}
              <Card className="hidden md:block rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Your Requests</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Equipment</TableHead>
                        <TableHead>Facility</TableHead>
                        <TableHead>Booking Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Requested On</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => {
                        const bookingDate = new Date(request.bookingDateISO);
                        const createdAt = new Date(request.createdAtISO);

                        const label =
                          request.status === "done"
                            ? "Completed"
                            : request.status.charAt(0).toUpperCase() +
                              request.status.slice(1);

                        const equipmentLabel =
                          request.equipmentNames.length === 1
                            ? request.equipmentNames[0]
                            : `${request.equipmentNames[0]} + ${
                                request.equipmentNames.length - 1
                              } more`;

                        return (
                          <TableRow key={request.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <PackageIcon className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-medium">
                                  {equipmentLabel}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <MapPinIcon className="h-4 w-4 text-primary" />
                                <p className="font-medium">
                                  {request.facilityName}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {bookingDate.toLocaleDateString()}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={statusColors[request.status]}
                              >
                                {label}
                              </Badge>
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
                            <TableCell>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {createdAt.toLocaleDateString()}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4">
                {requests.map((request) => {
                  const bookingDate = new Date(request.bookingDateISO);
                  const createdAt = new Date(request.createdAtISO);

                  const label =
                    request.status === "done"
                      ? "Completed"
                      : request.status.charAt(0).toUpperCase() +
                        request.status.slice(1);

                  const equipmentLabel =
                    request.equipmentNames.length === 1
                      ? request.equipmentNames[0]
                      : `${request.equipmentNames[0]} + ${
                          request.equipmentNames.length - 1
                        } more`;

                  return (
                    <Card
                      key={request.id}
                      className="rounded-2xl shadow-md bg-card"
                    >
                      <CardContent className="pt-6">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <PackageIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h3 className="font-bold">{equipmentLabel}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {request.facilityName}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={statusColors[request.status]}
                            >
                              {label}
                            </Badge>
                          </div>

                          <Separator />

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Booking Date
                              </p>
                              <div className="flex items-center gap-2 font-medium">
                                <CalendarIcon className="h-4 w-4 text-primary" />
                                {bookingDate.toLocaleDateString()}
                              </div>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">
                                Requested On
                              </p>
                              <div className="flex items-center gap-2 font-medium">
                                <ClockIcon className="h-4 w-4 text-primary" />
                                {createdAt.toLocaleDateString()}
                              </div>
                            </div>
                          </div>

                          {request.notes && (
                            <>
                              <Separator />
                              <div>
                                <p className="text-sm text-muted-foreground mb-1">
                                  Notes
                                </p>
                                <p className="text-sm">{request.notes}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}

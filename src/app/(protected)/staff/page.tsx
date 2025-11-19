import { prisma } from "@/lib/prisma";
import { requireStaffOrAdmin } from "@/lib/authz";

import { Navbar } from "@/components/navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  PendingRequestsQueue,
  type PendingRequest,
} from "@/components/staff/pending-requests-queue";
import { IssueReturnFlow } from "@/components/staff/issue-return-flow";
import { InventoryList } from "@/components/staff/inventory-list";
import { BookingsCalendar } from "@/components/staff/bookings-calendar";

import {
  ClipboardListIcon,
  PackageIcon,
  CalendarIcon,
  ArrowLeftRightIcon,
} from "lucide-react";

export default async function StaffPage() {
  await requireStaffOrAdmin();

  const [
    facilities,
    equipment,
    pendingRequestRows,
    approvedRequestRows,
    issuedItemsRaw,
  ] = await Promise.all([
    prisma.facility.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.equipment.findMany({
      select: {
        id: true,
        name: true,
        facilityId: true,
        qtyTotal: true,
        qtyAvailable: true,
        facility: {
          select: { name: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.equipmentRequest.findMany({
      where: { status: "pending" },
      include: {
        booking: {
          include: {
            user: true,
            facility: true,
          },
        },
        items: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.equipmentRequest.findMany({
      where: { status: "approved" },
      include: {
        booking: {
          include: {
            user: true,
            facility: true,
          },
        },
        items: {
          include: {
            equipment: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.equipmentRequestItem.findMany({
      where: {
        issuedAt: { not: null },
        dismissed: false,
      },
      include: {
        equipment: {
          include: { facility: true },
        },
        request: {
          include: {
            booking: {
              include: {
                user: true,
              },
            },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
      take: 100,
    }),
  ]);

  const pendingRequests: PendingRequest[] = pendingRequestRows.map((req) => ({
    id: req.id,
    userEmail: req.booking.user.email,
    facilityName: req.booking.facility.name,
    requestDate: req.createdAt.toISOString(),
    notes: req.note,
    equipmentName:
      req.items.length > 0
        ? req.items.map((item) => `${item.equipment.name}`).join(", ")
        : "No equipment items",
  }));

  // For IssueReturnFlow

  const equipmentOptions = equipment.map((eq) => ({
    id: eq.id,
    name: eq.name,
    qtyAvailable: eq.qtyAvailable,
    qtyTotal: eq.qtyTotal,
    facilityId: eq.facilityId,
    facilityName: eq.facility.name,
  }));

  type ApprovedRequestRow = {
    id: string;
    userEmail: string;
    facilityName: string;
    items: {
      equipmentId: string;
      equipmentName: string;
      qtyRequested: number;
    }[];
  };

  const approvedRequests: ApprovedRequestRow[] = approvedRequestRows
    .map((req) => {
      const unissuedItems = req.items.filter((item) => item.issuedAt === null);

      if (unissuedItems.length === 0) {
        return null;
      }

      return {
        id: req.id,
        userEmail: req.booking.user.email,
        facilityName: req.booking.facility.name,
        items: unissuedItems.map((item) => ({
          equipmentId: item.equipmentId,
          equipmentName: item.equipment.name,
          qtyRequested: item.qty,
        })),
      };
    })
    .filter((req): req is ApprovedRequestRow => req !== null);

  const issuedItems = issuedItemsRaw
    .filter((i) => i.qtyReturned < i.qty)
    .map((item) => ({
      id: item.id, // equipmentRequestItem id
      requestId: item.requestId,
      userEmail: item.request.booking.user.email,
      equipmentId: item.equipmentId,
      equipmentName: item.equipment.name,
      facilityName: item.equipment.facility.name,
      quantityBorrowed: item.qty,
      quantityReturned: item.qtyReturned,
    }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Equipment Desk</h1>
          <p className="text-muted-foreground text-lg">
            Manage equipment requests, inventory, and bookings
          </p>
        </div>

        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="w-full h-auto border-2 bg-card p-1 lg:grid lg:grid-cols-4 flex overflow-x-auto">
            <TabsTrigger
              value="requests"
              className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
            >
              <ClipboardListIcon className="h-4 w-4" />
              <span className="text-xs lg:text-sm">Requests</span>
            </TabsTrigger>

            <TabsTrigger
              value="issue-return"
              className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
            >
              <ArrowLeftRightIcon className="h-4 w-4" />
              <span className="text-xs lg:text-sm">Issue/Return</span>
            </TabsTrigger>

            <TabsTrigger
              value="inventory"
              className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
            >
              <PackageIcon className="h-4 w-4" />
              <span className="text-xs lg:text-sm">Inventory</span>
            </TabsTrigger>

            <TabsTrigger
              value="calendar"
              className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
            >
              <CalendarIcon className="h-4 w-4" />
              <span className="text-xs lg:text-sm">Bookings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <Card className="rounded-2xl shadow-md border-2">
              <CardHeader>
                <CardTitle>Pending Equipment Requests</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Review and approve equipment rental requests
                </p>
              </CardHeader>
              <CardContent>
                <PendingRequestsQueue initialRequests={pendingRequests} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="issue-return">
            <Card className="rounded-2xl shadow-md border-2">
              <CardHeader>
                <CardTitle>Issue &amp; Return Equipment</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Process equipment checkouts and returns
                </p>
              </CardHeader>
              <CardContent>
                <IssueReturnFlow
                  equipmentOptions={equipmentOptions}
                  approvedRequests={approvedRequests}
                  issuedItems={issuedItems}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="inventory">
            <Card className="rounded-2xl shadow-md border-2">
              <CardHeader>
                <CardTitle>Equipment Inventory</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View and manage equipment stock levels
                </p>
              </CardHeader>
              <CardContent>
                <InventoryList facilities={facilities} equipment={equipment} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar">
            <Card className="rounded-2xl shadow-md border-2">
              <CardHeader>
                <CardTitle>Facility Bookings Calendar</CardTitle>
                <p className="text-sm text-muted-foreground">
                  View all facility bookings (read only)
                </p>
              </CardHeader>
              <CardContent>
                <BookingsCalendar />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

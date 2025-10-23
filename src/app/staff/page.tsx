'use client';

import { AuthGuard } from '@/components/auth-guard';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PendingRequestsQueue } from '@/components/staff/pending-requests-queue';
import { IssueReturnFlow } from '@/components/staff/issue-return-flow';
import { InventoryList } from '@/components/staff/inventory-list';
import { BookingsCalendar } from '@/components/staff/bookings-calendar';
import { getUserRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  ClipboardListIcon,
  PackageIcon,
  CalendarIcon,
  ArrowLeftRightIcon,
} from 'lucide-react';

export default function StaffPage() {
  const router = useRouter();
  const role = getUserRole();

  useEffect(() => {
    if (role !== 'staff' && role !== 'admin') {
      router.push('/');
    }
  }, [role, router]);

  if (role !== 'staff' && role !== 'admin') {
    return null;
  }

  return (
    <AuthGuard>
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
                  <PendingRequestsQueue />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="issue-return">
              <Card className="rounded-2xl shadow-md border-2">
                <CardHeader>
                  <CardTitle>Issue & Return Equipment</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Process equipment checkouts and returns
                  </p>
                </CardHeader>
                <CardContent>
                  <IssueReturnFlow />
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
                  <InventoryList />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="calendar">
              <Card className="rounded-2xl shadow-md border-2">
                <CardHeader>
                  <CardTitle>Facility Bookings Calendar</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    View all facility bookings (read-only)
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
    </AuthGuard>
  );
}

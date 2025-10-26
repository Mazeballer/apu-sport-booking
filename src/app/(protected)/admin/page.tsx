import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FacilitiesManagement } from '@/components/admin/facilities-management';
import { OperatingHoursManagement } from '@/components/admin/operating-hours-management';
import { EquipmentManagement } from '@/components/admin/equipment-management';
import { EquipmentStatus } from '@/components/admin/equipment-status';
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard';
import { UserManagement } from '@/components/admin/user-management';
import { Navbar } from '@/components/navbar';
import { Prisma, Role as PrismaRole } from '@prisma/client';
import {
  BuildingIcon,
  ClockIcon,
  PackageIcon,
  TrendingUpIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string; query?: string }>;
}) {
  // 1) Server-side auth (session) + role gate (admin only)
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/admin');

  const me =
    (await prisma.user.findUnique({
      where: { authId: user.id },
      select: { role: true },
    })) ??
    (user.email
      ? await prisma.user.findUnique({
          where: { email: user.email },
          select: { role: true },
        })
      : null);

  if (!me || me.role !== 'admin') {
    redirect('/'); // not authorized
  }

  // 2) Preload users for the Users tab (SSR)
  const params = await searchParams;
  const pageSize = 20;
  const initialPage = Math.max(1, Number(params?.page || 1));
  const initialQuery = (params?.query || '').trim();

  let where: Prisma.UserWhereInput | undefined;

  if (initialQuery.length > 0) {
    // if the query literally matches a role, allow role filter too
    const roleFromQuery = (['admin', 'staff', 'student'] as const).find(
      (r) => r === initialQuery.toLowerCase()
    ) as PrismaRole | undefined;

    where = {
      OR: [
        {
          email: {
            contains: initialQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        {
          name: {
            contains: initialQuery,
            mode: Prisma.QueryMode.insensitive,
          },
        },
        ...(roleFromQuery
          ? ([{ role: roleFromQuery }] as Prisma.UserWhereInput[])
          : []),
      ],
    };
  } else {
    where = undefined;
  }

  const [initialUsers, initialTotal] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (initialPage - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  // Make dates serializable for client props
  const initialUsersSerializable = initialUsers.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  // 3) Render
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground text-lg font-medium">
              Manage facilities, equipment, and system settings
            </p>
          </div>

          <Tabs defaultValue="facilities" className="space-y-6">
            <TabsList className="w-full h-auto border-2 lg:grid lg:grid-cols-6 flex overflow-x-auto p-1">
              <TabsTrigger
                value="analytics"
                className="py-3 px-3 hidden lg:flex lg:gap-2 data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap rounded-lg"
              >
                <TrendingUpIcon className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>

              <TabsTrigger
                value="facilities"
                className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
              >
                <BuildingIcon className="h-4 w-4" />
                <span className="text-xs lg:text-sm">Facilities</span>
              </TabsTrigger>

              <TabsTrigger
                value="hours"
                className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
              >
                <ClockIcon className="h-4 w-4" />
                <span className="text-xs lg:text-sm">Hours</span>
              </TabsTrigger>

              <TabsTrigger
                value="equipment"
                className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
              >
                <PackageIcon className="h-4 w-4" />
                <span className="text-xs lg:text-sm">Inventory</span>
              </TabsTrigger>

              <TabsTrigger
                value="equipment-status"
                className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
              >
                <WrenchIcon className="h-4 w-4" />
                <span className="text-xs lg:text-sm">Status</span>
              </TabsTrigger>

              <TabsTrigger
                value="users"
                className="flex-col py-2 px-3 lg:flex-row lg:gap-2 lg:py-3 flex data-[state=active]:!bg-primary data-[state=active]:!text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0 rounded-lg"
              >
                <UsersIcon className="h-4 w-4" />
                <span className="text-xs lg:text-sm">Users</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="hidden lg:block">
              <AnalyticsDashboard />
            </TabsContent>

            <TabsContent value="facilities">
              <Card className="rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Facilities Management</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Add, edit, or remove sports facilities
                  </p>
                </CardHeader>
                <CardContent>
                  <FacilitiesManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="hours">
              <Card className="rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Operating Hours</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage facility schedules
                  </p>
                </CardHeader>
                <CardContent>
                  <OperatingHoursManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equipment">
              <Card className="rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Equipment Inventory</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage equipment stock and availability
                  </p>
                </CardHeader>
                <CardContent>
                  <EquipmentManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="equipment-status">
              <Card className="rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>Equipment Status</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Track overdue returns, damaged equipment, and lost items
                  </p>
                </CardHeader>
                <CardContent>
                  <EquipmentStatus />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card className="rounded-2xl shadow-md">
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <p className="text-sm text-muted-foreground font-medium">
                    Create accounts and manage user roles
                  </p>
                </CardHeader>
                <CardContent>
                  <UserManagement
                    initialUsers={initialUsersSerializable}
                    initialTotal={initialTotal}
                    initialQuery={initialQuery}
                    initialPage={initialPage}
                    pageSize={pageSize}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}

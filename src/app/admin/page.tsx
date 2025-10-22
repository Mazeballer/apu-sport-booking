'use client';

import { AuthGuard } from '@/components/auth-guard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FacilitiesManagement } from '@/components/admin/facilities-management';
import { OperatingHoursManagement } from '@/components/admin/operating-hours-management';
import { EquipmentManagement } from '@/components/admin/equipment-management';
import { EquipmentStatus } from '@/components/admin/equipment-status';
import { AnalyticsDashboard } from '@/components/admin/analytics-dashboard';
import { UserManagement } from '@/components/admin/user-management';
import { getUserRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  BuildingIcon,
  ClockIcon,
  PackageIcon,
  TrendingUpIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react';
import { Navbar } from '@/components/navbar';

export default function AdminPage() {
  const router = useRouter();
  const role = getUserRole();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (role !== 'admin') {
      router.push('/');
    }
  }, [role, router]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (role !== 'admin') {
    return null;
  }

  return (
    <AuthGuard>
      <Navbar />
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-muted-foreground text-lg font-medium">
              Manage facilities, equipment, and system settings
            </p>
          </div>

          <Tabs
            defaultValue={isMobile ? 'facilities' : 'analytics'}
            className="space-y-6"
          >
            <TabsList className="w-full h-auto border-2 lg:grid lg:grid-cols-6 flex overflow-x-auto">
              <TabsTrigger
                value="analytics"
                className="gap-2 py-3 hidden lg:flex data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap"
              >
                <TrendingUpIcon className="h-4 w-4" />
                <span>Analytics</span>
              </TabsTrigger>
              <TabsTrigger
                value="facilities"
                className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0"
              >
                <BuildingIcon className="h-4 w-4" />
                <span>Facilities</span>
              </TabsTrigger>
              <TabsTrigger
                value="hours"
                className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0"
              >
                <ClockIcon className="h-4 w-4" />
                <span>Hours</span>
              </TabsTrigger>
              <TabsTrigger
                value="equipment"
                className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0"
              >
                <PackageIcon className="h-4 w-4" />
                <span>Inventory</span>
              </TabsTrigger>
              <TabsTrigger
                value="equipment-status"
                className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0"
              >
                <WrenchIcon className="h-4 w-4" />
                <span>Status</span>
              </TabsTrigger>
              <TabsTrigger
                value="users"
                className="gap-2 py-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-semibold whitespace-nowrap flex-shrink-0"
              >
                <UsersIcon className="h-4 w-4" />
                <span>Users</span>
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
                  <CardTitle>Operating Hours & Blackouts</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Manage facility schedules and maintenance periods
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
                    Track overdue returns, damaged equipment, and lost items by
                    students
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
                  <UserManagement />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </AuthGuard>
  );
}

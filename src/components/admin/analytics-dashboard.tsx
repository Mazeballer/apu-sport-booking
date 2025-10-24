'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { facilities, bookings, equipment } from '@/lib/data';
import {
  TrendingUpIcon,
  BuildingIcon,
  PackageIcon,
  ActivityIcon,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

export function AnalyticsDashboard() {
  // Calculate metrics
  const totalBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const activeFacilities = facilities.filter(
    (f) => f.status === 'active'
  ).length;
  const totalFacilities = facilities.length;
  const totalEquipmentItems = equipment.reduce(
    (sum, eq) => sum + eq.qtyTotal,
    0
  );
  const availableEquipment = equipment.reduce(
    (sum, eq) => sum + eq.qtyAvailable,
    0
  );
  const utilizationRate =
    totalEquipmentItems > 0
      ? Math.round(
          ((totalEquipmentItems - availableEquipment) / totalEquipmentItems) *
            100
        )
      : 0;

  // Facility usage distribution (pie chart data)
  const facilityUsageData = facilities.map((facility) => {
    const facilityBookings = bookings.filter(
      (b) => b.facilityId === facility.id && b.status === 'confirmed'
    ).length;
    return {
      name: facility.name.split(' ')[0], // Short name
      value: facilityBookings,
      fullName: facility.name,
    };
  });

  const weeklyTrendData = [
    { day: 'Mon', bookings: 12 },
    { day: 'Tue', bookings: 19 },
    { day: 'Wed', bookings: 15 },
    { day: 'Thu', bookings: 22 },
    { day: 'Fri', bookings: 28 },
    { day: 'Sat', bookings: 35 },
    { day: 'Sun', bookings: 30 },
  ];

  // Equipment usage overview (bar chart data)
  const equipmentUsageData = equipment.slice(0, 4).map((eq) => ({
    name: eq.name,
    inUse: eq.qtyTotal - eq.qtyAvailable,
    available: eq.qtyAvailable,
    total: eq.qtyTotal,
  }));

  const FACILITY_COLORS = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#8b5cf6',
    '#ef4444',
    '#06b6d4',
  ];

  const EQUIPMENT_COLORS = {
    inUse: '#2563eb', // Darker blue for better visibility
    available: '#6b7280', // Changed from #d1d5db to #6b7280 for much better visibility in light mode
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-lg border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground font-bold">
              Total Bookings
            </CardTitle>
            <TrendingUpIcon className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-primary text-4xl">
              {totalBookings}
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-semibold">
              <TrendingUpIcon className="h-3 w-3" />
              +12% from last week
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground font-bold">
              Active Facilities
            </CardTitle>
            <BuildingIcon className="h-4 w-4 text-purple-700" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-primary text-4xl">
              {activeFacilities}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              Out of {totalFacilities} total
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground font-bold">
              Equipment Available
            </CardTitle>
            <PackageIcon className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-primary text-4xl">
              {availableEquipment}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {totalEquipmentItems} total items
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-lg border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground font-bold">
              Utilization Rate
            </CardTitle>
            <ActivityIcon className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-primary text-4xl">
              {utilizationRate}%
            </div>
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1 font-semibold">
              <TrendingUpIcon className="h-3 w-3" />
              Excellent performance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-lg border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUpIcon className="h-5 w-5" />
              Weekly Booking Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                bookings: {
                  label: 'Bookings',
                  color: '#3b82f6',
                },
              }}
              className="h-[280px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeklyTrendData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="bookings"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#3b82f6' }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="rounded-lg border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BuildingIcon className="h-5 w-5" />
              Facility Usage Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={facilityUsageData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      `${entry.name} ${(
                        (entry.value / totalBookings) *
                        100
                      ).toFixed(1)}%`
                    }
                    outerRadius={90}
                    dataKey="value"
                  >
                    {facilityUsageData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={FACILITY_COLORS[index % FACILITY_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-lg border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PackageIcon className="h-5 w-5" />
            Equipment Usage Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              inUse: {
                label: 'In Use',
                color: EQUIPMENT_COLORS.inUse,
              },
              available: {
                label: 'Available',
                color: EQUIPMENT_COLORS.available,
              },
            }}
            className="h-[300px] w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={equipmentUsageData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#d1d5db" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 13, fill: '#374151' }}
                />
                <YAxis tick={{ fontSize: 13, fill: '#374151' }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend wrapperStyle={{ fontSize: '14px', fontWeight: 600 }} />
                <Bar
                  dataKey="inUse"
                  stackId="a"
                  fill={EQUIPMENT_COLORS.inUse}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="available"
                  stackId="a"
                  fill={EQUIPMENT_COLORS.available}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

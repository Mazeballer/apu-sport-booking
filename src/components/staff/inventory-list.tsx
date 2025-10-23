'use client';

import { cn } from '@/lib/utils';

import { equipment, facilities } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PackageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

function getAvailabilityVariant(
  percent: number
): 'success' | 'warning' | 'danger' | 'critical' {
  if (percent >= 70) return 'success';
  if (percent >= 40) return 'warning';
  if (percent >= 10) return 'danger';
  return 'critical';
}

function getAvailabilityTextColor(percent: number): string {
  if (percent >= 70) return 'text-emerald-700 dark:text-emerald-400';
  if (percent >= 40) return 'text-amber-700 dark:text-amber-400';
  if (percent >= 10) return 'text-orange-700 dark:text-orange-400';
  return 'text-rose-600 dark:text-rose-400';
}

export function InventoryList() {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipment</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Total Stock</TableHead>
              <TableHead>Availability</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {equipment.map((eq) => {
              const facility = facilities.find((f) => f.id === eq.facilityId);
              const availabilityPercent = (eq.qtyAvailable / eq.qtyTotal) * 100;

              return (
                <TableRow key={eq.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PackageIcon className="h-4 w-4 text-primary" />
                      <span className="font-medium">{eq.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{facility?.name}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        eq.qtyAvailable === 0
                          ? 'destructive'
                          : eq.qtyAvailable < 3
                          ? 'secondary'
                          : 'default'
                      }
                    >
                      {eq.qtyAvailable}
                    </Badge>
                  </TableCell>
                  <TableCell>{eq.qtyTotal}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Progress
                        value={availabilityPercent}
                        variant={getAvailabilityVariant(availabilityPercent)}
                        className="w-24"
                      />
                      <span
                        className={cn(
                          'text-sm font-medium',
                          getAvailabilityTextColor(availabilityPercent)
                        )}
                      >
                        {Math.round(availabilityPercent)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {equipment.map((eq) => {
          const facility = facilities.find((f) => f.id === eq.facilityId);
          const availabilityPercent = (eq.qtyAvailable / eq.qtyTotal) * 100;

          return (
            <Card key={eq.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <PackageIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold">{eq.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {facility?.name}
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Available</p>
                    <Badge
                      variant={
                        eq.qtyAvailable === 0
                          ? 'destructive'
                          : eq.qtyAvailable < 3
                          ? 'secondary'
                          : 'default'
                      }
                    >
                      {eq.qtyAvailable}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Total Stock</p>
                    <p className="font-medium">{eq.qtyTotal}</p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2 text-sm">
                    <span className="text-muted-foreground">Availability</span>
                    <span
                      className={cn(
                        'font-medium',
                        getAvailabilityTextColor(availabilityPercent)
                      )}
                    >
                      {Math.round(availabilityPercent)}%
                    </span>
                  </div>
                  <Progress
                    value={availabilityPercent}
                    variant={getAvailabilityVariant(availabilityPercent)}
                  />
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

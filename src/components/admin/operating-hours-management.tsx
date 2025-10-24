'use client';

import { facilities } from '@/lib/data';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { ClockIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export function OperatingHoursManagement() {
  const { toast } = useToast();

  const handleUpdate = (facilityId: string, start: string, end: string) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (facility) {
      facility.operatingHours = { start, end };

      toast({
        title: 'Hours Updated',
        description: `Operating hours for ${facility.name} have been updated.`,
      });
    }
  };

  return (
    <div className="space-y-4">
      {facilities.map((facility) => (
        <Card key={facility.id} className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <ClockIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold">{facility.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {facility.location}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor={`start-${facility.id}`}>Opening Time</Label>
                <Input
                  id={`start-${facility.id}`}
                  type="time"
                  defaultValue={facility.operatingHours.start}
                  onChange={(e) => {
                    facility.operatingHours.start = e.target.value;
                  }}
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor={`end-${facility.id}`}>Closing Time</Label>
                <Input
                  id={`end-${facility.id}`}
                  type="time"
                  defaultValue={facility.operatingHours.end}
                  onChange={(e) => {
                    facility.operatingHours.end = e.target.value;
                  }}
                  className="border-3 border-primary/20 focus:border-primary shadow-sm"
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={() =>
                handleUpdate(
                  facility.id,
                  facility.operatingHours.start,
                  facility.operatingHours.end
                )
              }
            >
              Save Changes
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

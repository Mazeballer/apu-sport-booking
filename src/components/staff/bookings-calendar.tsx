'use client';

import { bookings, facilities } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, ClockIcon, MapPinIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

export function BookingsCalendar() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filterMode, setFilterMode] = useState<'all' | 'today' | 'custom'>(
    'all'
  );

  const confirmedBookings = bookings
    .filter((b) => b.status === 'confirmed')
    .sort((a, b) => a.date.localeCompare(b.date));

  const filteredBookings = confirmedBookings.filter((booking) => {
    if (filterMode === 'all') return true;

    if (filterMode === 'today') {
      const today = new Date();
      const bookingDate = new Date(booking.date);
      return (
        bookingDate.getDate() === today.getDate() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getFullYear() === today.getFullYear()
      );
    }

    if (filterMode === 'custom' && selectedDate) {
      const bookingDate = new Date(booking.date);
      return (
        bookingDate.getDate() === selectedDate.getDate() &&
        bookingDate.getMonth() === selectedDate.getMonth() &&
        bookingDate.getFullYear() === selectedDate.getFullYear()
      );
    }

    return true;
  });

  const handleTodayFilter = () => {
    setFilterMode('today');
    setSelectedDate(undefined);
  };

  const handleAllFilter = () => {
    setFilterMode('all');
    setSelectedDate(undefined);
  };

  const handleCustomDate = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setFilterMode('custom');
    }
  };

  if (confirmedBookings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <CalendarIcon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No bookings scheduled</h3>
        <p className="text-muted-foreground">
          There are no confirmed bookings at the moment
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterMode === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={handleAllFilter}
        >
          All Bookings
        </Button>
        <Button
          variant={filterMode === 'today' ? 'default' : 'outline'}
          size="sm"
          onClick={handleTodayFilter}
        >
          Today
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filterMode === 'custom' ? 'default' : 'outline'}
              size="sm"
              className={cn('justify-start text-left font-normal')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? selectedDate.toLocaleDateString() : 'Pick a date'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCustomDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
        {filterMode !== 'all' && (
          <Badge variant="secondary" className="ml-2">
            {filteredBookings.length} booking
            {filteredBookings.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <CalendarIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
          <p className="text-muted-foreground">
            {filterMode === 'today'
              ? 'There are no bookings scheduled for today'
              : 'There are no bookings for the selected date'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Equipment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBookings.map((booking) => {
                  const facility = facilities.find(
                    (f) => f.id === booking.facilityId
                  );

                  return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{facility?.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {facility?.location}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{booking.userEmail}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                          {new Date(booking.date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ClockIcon className="h-4 w-4 text-primary" />
                          {booking.startTime}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20"
                        >
                          {booking.duration}h
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {booking.equipment.length > 0 ? (
                          <div className="text-sm">
                            {booking.equipment.join(', ')}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            None
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredBookings.map((booking) => {
              const facility = facilities.find(
                (f) => f.id === booking.facilityId
              );

              return (
                <Card key={booking.id} className="p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-bold text-lg mb-1">
                        {facility?.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPinIcon className="h-4 w-4" />
                        {facility?.location}
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Student</span>
                        <span className="font-medium">{booking.userEmail}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Date</span>
                        <span className="font-medium">
                          {new Date(booking.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time</span>
                        <span className="font-medium">{booking.startTime}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Duration</span>
                        <Badge
                          variant="secondary"
                          className="bg-primary/10 text-primary border-primary/20"
                        >
                          {booking.duration}h
                        </Badge>
                      </div>
                      {booking.equipment.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Equipment
                          </span>
                          <span className="font-medium">
                            {booking.equipment.length} items
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

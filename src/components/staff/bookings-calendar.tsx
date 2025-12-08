"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ClockIcon, MapPinIcon, SearchIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type EquipmentItem = {
  name: string;
  qty: number;
};

export type CalendarBooking = {
  id: string;
  userEmail: string;
  facilityName: string;
  facilityLocation: string;
  start: string; // ISO string
  end: string; // ISO string
  equipment: EquipmentItem[];
};

type BookingsCalendarProps = {
  bookings: CalendarBooking[];
};

export function BookingsCalendar({ bookings }: BookingsCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [filterMode, setFilterMode] = useState<"all" | "today" | "custom">(
    "all"
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Decorate bookings with date, startTime, duration for display and filtering
  const confirmedBookings = bookings
    .map((b) => {
      const startDate = new Date(b.start);
      const endDate = new Date(b.end);
      const durationHours =
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      return {
        ...b,
        date: startDate.toISOString(),
        startTime: startDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        duration: Number(durationHours.toFixed(1)),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const filteredBookings = confirmedBookings.filter((booking) => {
    // Date filter
    let dateMatch = true;
    if (filterMode === "today") {
      const today = new Date();
      const bookingDate = new Date(booking.date);
      dateMatch =
        bookingDate.getDate() === today.getDate() &&
        bookingDate.getMonth() === today.getMonth() &&
        bookingDate.getFullYear() === today.getFullYear();
    } else if (filterMode === "custom" && selectedDate) {
      const bookingDate = new Date(booking.date);
      dateMatch =
        bookingDate.getDate() === selectedDate.getDate() &&
        bookingDate.getMonth() === selectedDate.getMonth() &&
        bookingDate.getFullYear() === selectedDate.getFullYear();
    }

    // Search filter
    let searchMatch = true;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      searchMatch =
        booking.facilityName.toLowerCase().includes(query) ||
        booking.facilityLocation.toLowerCase().includes(query) ||
        booking.userEmail.toLowerCase().includes(query) ||
        booking.equipment.some((eq) => eq.name.toLowerCase().includes(query));
    }

    return dateMatch && searchMatch;
  });

  const handleTodayFilter = () => {
    setFilterMode("today");
    setSelectedDate(undefined);
  };

  const handleAllFilter = () => {
    setFilterMode("all");
    setSelectedDate(undefined);
  };

  const handleCustomDate = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      setFilterMode("custom");
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
      {/* Search Bar */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by facility, location, student email, or equipment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 transition-all duration-200 focus:scale-[1.01]"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={filterMode === "all" ? "default" : "outline"}
          size="sm"
          onClick={handleAllFilter}
          className="transition-all duration-200 hover:scale-105 active:scale-95"
        >
          All Bookings
        </Button>
        <Button
          variant={filterMode === "today" ? "default" : "outline"}
          size="sm"
          onClick={handleTodayFilter}
          className="transition-all duration-200 hover:scale-105 active:scale-95"
        >
          Today
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={filterMode === "custom" ? "default" : "outline"}
              size="sm"
              className={cn(
                "justify-start text-left font-normal transition-all duration-200 hover:scale-105 active:scale-95"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {selectedDate ? selectedDate.toLocaleDateString() : "Pick a date"}
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
        {(filterMode !== "all" || searchQuery.trim()) && (
          <Badge variant="secondary" className="ml-2">
            {filteredBookings.length} booking
            {filteredBookings.length !== 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {filteredBookings.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <SearchIcon className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
          <p className="text-muted-foreground">
            {searchQuery.trim()
              ? `No results match "${searchQuery}"`
              : filterMode === "today"
              ? "There are no bookings scheduled for today"
              : "There are no bookings for the selected date"}
          </p>
          {searchQuery.trim() && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="mt-4 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              Clear search
            </Button>
          )}
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
                {filteredBookings.map((booking) => (
                  <TableRow
                    key={booking.id}
                    className="transition-colors duration-200"
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{booking.facilityName}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.facilityLocation}
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
                          {booking.equipment
                            .map((e) => `${e.name} (${e.qty})`)
                            .join(", ")}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          None
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredBookings.map((booking) => (
              <Card
                key={booking.id}
                className="p-4 transition-all duration-200 hover:shadow-lg"
              >
                <div className="space-y-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      {booking.facilityName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPinIcon className="h-4 w-4" />
                      {booking.facilityLocation}
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
                        <span className="text-muted-foreground">Equipment</span>
                        <span className="font-medium">
                          {booking.equipment
                            .map((e) => `${e.name} (${e.qty})`)
                            .join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

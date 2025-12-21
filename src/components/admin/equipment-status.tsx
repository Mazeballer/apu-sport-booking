"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle,
  PackageX,
  Clock,
  CheckCircle,
  Search,
  X,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { EquipReturnCondition } from "@prisma/client";
import { dismissEquipmentStatusItem } from "@/app/(protected)/admin/status/actions";
import { notify } from "@/lib/toast";

export interface EquipmentStatusRow {
  id: string;
  userEmail: string;
  equipmentName: string;
  facilityName: string;
  quantityBorrowed: number;
  quantityReturned: number;
  issuedAt: string | null;
  returnedAt: string | null;
  condition: EquipReturnCondition | null;
  damageNotes: string | null;
  dismissed: boolean;
}

interface EquipmentStatusProps {
  rows?: EquipmentStatusRow[];
}

export function EquipmentStatus({ rows = [] }: EquipmentStatusProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const filterRequests = (requests: EquipmentStatusRow[]) => {
    if (!searchQuery.trim()) return requests;
    return requests.filter((req) =>
      req.userEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const today = new Date();

  const daysBetween = (iso: string | null) => {
    if (!iso) return 0;
    const d = new Date(iso);
    return Math.floor((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  };

  const overdueEquipment = rows.filter((req) => {
    if (req.dismissed) return false;
    if (!req.issuedAt) return false;
    if (req.condition !== null) return false;
    if (req.quantityReturned >= req.quantityBorrowed) return false;

    const daysSinceIssue = daysBetween(req.issuedAt);
    return daysSinceIssue > 7;
  });

  const damagedEquipment = rows.filter(
    (req) => !req.dismissed && req.condition === "damaged"
  );

  const lostEquipment = rows.filter(
    (req) => !req.dismissed && req.condition === "lost"
  );

  // History includes dismissed even if condition is null
  const returnHistory = rows.filter(
    (req) => req.condition !== null || req.dismissed
  );

  const getConditionBadge = (condition?: EquipReturnCondition | null) => {
    switch (condition) {
      case "good":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-green-300 dark:border-green-700"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Good
          </Badge>
        );
      case "damaged":
        return (
          <Badge
            variant="secondary"
            className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Damaged
          </Badge>
        );
      case "lost":
        return (
          <Badge
            variant="secondary"
            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700"
          >
            <PackageX className="h-3 w-3 mr-1" />
            Lost
          </Badge>
        );
      case "not_returned":
        return (
          <Badge
            variant="secondary"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700"
          >
            <Clock className="h-3 w-3 mr-1" />
            Not returned
          </Badge>
        );
      default:
        return <Badge variant="secondary">-</Badge>;
    }
  };

  const calculateDaysOverdue = (issuedAt: string | null) => {
    const daysSince = daysBetween(issuedAt);
    return Math.max(0, daysSince - 7);
  };

  const handleDismiss = (id: string) => {
    startTransition(async () => {
      try {
        await dismissEquipmentStatusItem(id);
        notify.success("Item dismissed from status view.");
        router.refresh();
      } catch {
        notify.error("Could not dismiss item.");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by student email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 md:h-10 border-3 border-primary/20 focus:border-primary shadow-sm"
        />
      </div>

      <Tabs defaultValue="overdue" className="w-full">
        <TabsList className="w-full grid grid-cols-2 md:grid-cols-4 bg-muted/30 p-1 h-auto gap-2 md:gap-1">
          <TabsTrigger
            value="overdue"
            className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 transition-all min-h-[44px]"
          >
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">
              Overdue ({filterRequests(overdueEquipment).length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="damaged"
            className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 transition-all min-h-[44px]"
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">
              Damaged ({filterRequests(damagedEquipment).length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="lost"
            className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 transition-all min-h-[44px]"
          >
            <PackageX className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">
              Lost ({filterRequests(lostEquipment).length})
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="flex items-center justify-center gap-1.5 text-sm md:text-sm px-3 py-2.5 md:py-2 data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 data-[state=active]:border-blue-500 data-[state=active]:border-2 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-100 dark:data-[state=active]:border-blue-500 transition-all min-h-[44px]"
          >
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span className="whitespace-nowrap">
              History ({filterRequests(returnHistory).length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* Overdue */}
        <TabsContent value="overdue" className="space-y-4 mt-4">
          {filterRequests(overdueEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No overdue equipment</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filterRequests(overdueEquipment).map((req) => {
                const daysOverdue = calculateDaysOverdue(req.issuedAt);
                return (
                  <Card key={req.id} className="shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Student
                          </p>
                          <p className="font-semibold text-sm break-all mt-1">
                            {req.userEmail}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleDismiss(req.id)}
                          disabled={isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Equipment
                          </p>
                          <p className="font-semibold text-sm mt-1">
                            {req.equipmentName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Facility
                          </p>
                          <p className="font-semibold text-sm mt-1">
                            {req.facilityName}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Borrowed
                          </p>
                          <p className="font-bold text-base mt-1">
                            {req.quantityBorrowed}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Outstanding
                          </p>
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700 font-bold mt-1"
                          >
                            {req.quantityBorrowed - req.quantityReturned}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Issued Date
                          </p>
                          <p className="font-semibold text-sm mt-1">
                            {req.issuedAt
                              ? new Date(req.issuedAt).toLocaleDateString()
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Days Overdue
                          </p>
                          <Badge
                            variant="destructive"
                            className="font-bold mt-1"
                          >
                            {daysOverdue} days
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-foreground">
                      Student Email
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Equipment
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Facility
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Qty Borrowed
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Qty Outstanding
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Issued Date
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Days Overdue
                    </TableHead>
                    <TableHead className="font-semibold text-foreground">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filterRequests(overdueEquipment).map((req) => {
                    const daysOverdue = calculateDaysOverdue(req.issuedAt);
                    return (
                      <TableRow key={req.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {req.userEmail}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.equipmentName}
                        </TableCell>
                        <TableCell>{req.facilityName}</TableCell>
                        <TableCell className="font-medium">
                          {req.quantityBorrowed}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700 font-semibold"
                          >
                            {req.quantityBorrowed - req.quantityReturned}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {req.issuedAt
                            ? new Date(req.issuedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="destructive"
                            className="font-semibold"
                          >
                            {daysOverdue} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDismiss(req.id)}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* Damaged */}
        <TabsContent value="damaged" className="space-y-4 mt-4">
          {filterRequests(damagedEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No damaged equipment reported</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filterRequests(damagedEquipment).map((req) => (
                <Card key={req.id} className="shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Student
                        </p>
                        <p className="font-semibold text-sm break-all mt-1">
                          {req.userEmail}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDismiss(req.id)}
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Equipment
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.equipmentName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Facility
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.facilityName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Qty Damaged
                        </p>
                        <Badge
                          variant="secondary"
                          className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700 font-bold mt-1"
                        >
                          {req.quantityReturned}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Returned Date
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Damage Notes
                      </p>
                      <p className="text-sm mt-1 leading-relaxed whitespace-normal break-words">
                        {req.damageNotes || "No notes provided"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-foreground w-[200px]">
                        Student Email
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Equipment
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Facility
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[100px]">
                        Qty Damaged
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[400px]">
                        Damage Notes
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[130px]">
                        Returned Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[90px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRequests(damagedEquipment).map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {req.userEmail}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.equipmentName}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.facilityName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border-orange-300 dark:border-orange-700 font-semibold"
                          >
                            {req.quantityReturned}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[400px] whitespace-normal break-words">
                          {req.damageNotes || "No notes provided"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDismiss(req.id)}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Lost */}
        <TabsContent value="lost" className="space-y-4 mt-4">
          {filterRequests(lostEquipment).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <PackageX className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No lost equipment reported</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filterRequests(lostEquipment).map((req) => (
                <Card key={req.id} className="shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Student
                        </p>
                        <p className="font-semibold text-sm break-all mt-1">
                          {req.userEmail}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDismiss(req.id)}
                        disabled={isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Equipment
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.equipmentName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Facility
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.facilityName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Qty Lost
                        </p>
                        <Badge
                          variant="secondary"
                          className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700 font-bold mt-1"
                        >
                          {req.quantityReturned}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Reported Date
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Notes
                      </p>
                      <p className="text-sm mt-1 leading-relaxed whitespace-normal break-words">
                        {req.damageNotes || "No notes provided"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-foreground w-[200px]">
                        Student Email
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Equipment
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Facility
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[100px]">
                        Qty Lost
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[400px]">
                        Notes
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[130px]">
                        Reported Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[90px]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRequests(lostEquipment).map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {req.userEmail}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.equipmentName}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.facilityName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-red-300 dark:border-red-700 font-semibold"
                          >
                            {req.quantityReturned}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium max-w-[400px] whitespace-normal break-words">
                          {req.damageNotes || "No notes provided"}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDismiss(req.id)}
                            disabled={isPending}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {filterRequests(returnHistory).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No return history yet</p>
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {filterRequests(returnHistory).map((req) => (
                <Card key={req.id} className="shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Student
                      </p>
                      <p className="font-semibold text-sm break-all mt-1">
                        {req.userEmail}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Equipment
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.equipmentName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Facility
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.facilityName}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Qty Returned
                        </p>
                        <p className="font-bold text-base mt-1">
                          {req.quantityReturned}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Condition
                        </p>
                        <div className="mt-1">
                          {getConditionBadge(req.condition)}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Returned Date
                        </p>
                        <p className="font-semibold text-sm mt-1">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </p>
                      </div>
                    </div>
                    {req.damageNotes && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Notes
                        </p>
                        <p className="text-sm mt-1 leading-relaxed whitespace-normal break-words">
                          {req.damageNotes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-semibold text-foreground w-[200px]">
                        Student Email
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Equipment
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[150px]">
                        Facility
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[100px]">
                        Qty Returned
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[120px]">
                        Condition
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[130px]">
                        Returned Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground w-[400px]">
                        Notes
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRequests(returnHistory).map((req) => (
                      <TableRow key={req.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          {req.userEmail}
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.equipmentName}
                        </TableCell>
                        <TableCell>{req.facilityName}</TableCell>
                        <TableCell className="font-medium">
                          {req.quantityReturned}
                        </TableCell>
                        <TableCell>
                          {getConditionBadge(req.condition)}
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">
                          {req.returnedAt
                            ? new Date(req.returnedAt).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell className="font-medium max-w-[400px] whitespace-normal break-words">
                          {req.damageNotes || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
